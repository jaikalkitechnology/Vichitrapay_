"""
Central webhook processor — handles inbound provider webhooks,
updates wallet/transaction state, and forwards to merchant webhook URL.

Designed to handle high throughput: each step is isolated so a merchant
delivery failure never blocks the provider ACK.
"""
import logging
import time
from datetime import datetime

import requests
from sqlalchemy.orm import Session

from models.models import (
    WalletTransaction, TransactionTypeEnum, TransactionInstrument,
    Wallet, MerchantSettings, WebhookLog, WebhookDeliveryLog, india_tz,
)

log = logging.getLogger(__name__)

MERCHANT_WEBHOOK_TIMEOUT = 10  # seconds
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAYS = [0, 2, 5]  # seconds between attempts


def process_payin_webhook(
    db: Session,
    provider: str,
    raw_payload: dict,
    normalized: dict,
) -> dict:
    """
    Central payin webhook processor for ALL providers.

    1. Log inbound webhook
    2. Find & update wallet transaction
    3. Credit wallet on success
    4. Forward to merchant webhook URL (with retries)
    5. Log every delivery attempt

    Returns a dict suitable as the HTTP response to the provider.
    """

    order_id = normalized.get("order_id")
    provider_status = normalized.get("status", "failed")

    # ── 1. Create webhook log entry (immediately, so we never lose data) ──
    wh_log = WebhookLog(
        provider=provider,
        order_id=order_id,
        received_payload=raw_payload,
        normalized_payload=normalized,
        provider_status=provider_status,
    )
    db.add(wh_log)
    db.flush()

    # ── 2. Find wallet transaction ──
    wt = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.order_id == order_id,
            WalletTransaction.transaction_type == TransactionTypeEnum.PayIn,
        )
        .first()
    )

    if not wt:
        wh_log.error_message = "Transaction not found"
        db.commit()
        return {"success": False, "message": "Transaction not found"}

    wh_log.merchant_id = wt.user_id
    wh_log.wallet_txn_id = wt.id

    # ── 3. Idempotency — already processed ──
    if wt.status == "success":
        _create_delivery_log(db, wh_log, wt, delivery_status="skipped",
                             error_message="Already processed")
        db.commit()
        return {"success": True, "message": "Already processed"}

    # ── 4. Update instrument ──
    instrument = (
        db.query(TransactionInstrument)
        .filter(TransactionInstrument.wallet_transaction_id == wt.id)
        .first()
    )
    if instrument:
        instrument.status = provider_status
        instrument.txn_id = normalized.get("provider_txn_id")
        instrument.provider_response = raw_payload

    # ── 5. Handle success / failure ──
    if provider_status == "success":
        wallet = (
            db.query(Wallet)
            .filter(Wallet.user_id == wt.user_id)
            .with_for_update()
            .first()
        )
        if not wallet:
            wallet = Wallet(user_id=wt.user_id, balance=0.0)
            db.add(wallet)
            db.flush()

        # ── 5a. Fetch merchant payInCharges and calculate deductions ──
        amount = float(normalized["amount"])
        settings = (
            db.query(MerchantSettings)
            .filter(MerchantSettings.id == wt.user_id)
            .first()
        )

        payin_pct = float(settings.payInCharges) if settings and settings.payInCharges else 0.0
        charges = round(amount * payin_pct / 100, 2)       # platform fee
        gst = round(charges * 18 / 100, 2)                 # 18% GST on charges
        settle_amount = round(amount - charges - gst, 2)    # merchant receives this

        wallet.balance += settle_amount
        wallet.last_updated = datetime.now(india_tz)

        wt.status = "success"
        wt.txn_id = normalized.get("provider_txn_id")
        wt.utr = normalized.get("utr")
        wt.amount = amount
        wt.charges = charges
        wt.gst = gst
        wt.settle_amount = settle_amount
        wt.balance_amount = wallet.balance
        wt.description = "PayIn successful"
    else:
        wt.status = "failed"
        wt.description = "PayIn failed"

    db.flush()

    # ── 6. Forward to merchant webhook (with retries + delivery log) ──
    _forward_to_merchant(db, wh_log, wt)

    db.commit()
    return {"success": True}


def _build_merchant_payload(wt: WalletTransaction) -> dict:
    """Build the standard payload sent to merchant webhook."""
    return {
        "event": "payin.completed" if wt.status == "success" else "payin.failed",
        "merchantOrderId": wt.order_id,
        "txn_id": wt.txn_id,
        "utr": wt.utr,
        "amount": float(wt.amount or 0),
        "charges": float(wt.charges or 0),
        "gst": float(wt.gst or 0),
        "settle_amount": float(wt.settle_amount or 0),
        "status": wt.status,
        "description": wt.description,
        "balance": float(wt.balance_amount or 0),
    }


def _create_delivery_log(db: Session, wh_log: WebhookLog, wt: WalletTransaction,
                         *, webhook_url=None, request_payload=None,
                         response_status_code=None, response_body=None,
                         response_time_ms=None, delivery_status="pending",
                         attempt_number=1, error_message=None) -> WebhookDeliveryLog:
    """Create a single delivery attempt log row."""
    entry = WebhookDeliveryLog(
        webhook_log_id=wh_log.id,
        merchant_id=wt.user_id,
        order_id=wt.order_id,
        webhook_url=webhook_url,
        request_payload=request_payload,
        request_headers={"Content-Type": "application/json"},
        response_status_code=response_status_code,
        response_body=response_body,
        response_time_ms=response_time_ms,
        delivery_status=delivery_status,
        attempt_number=attempt_number,
        error_message=error_message,
        delivered_at=datetime.now(india_tz) if delivery_status == "delivered" else None,
    )
    db.add(entry)
    db.flush()
    return entry


def _forward_to_merchant(db: Session, wh_log: WebhookLog, wt: WalletTransaction):
    """
    Look up merchant webhook URL from MerchantSettings and POST the
    normalized result. Retries up to MAX_RETRY_ATTEMPTS times.
    Every attempt is logged to webhook_delivery_logs.
    Failures never block the provider ACK.
    """
    settings = (
        db.query(MerchantSettings)
        .filter(MerchantSettings.id == wt.user_id)
        .first()
    )

    webhook_url = settings.webhook if settings else None

    if not webhook_url:
        _create_delivery_log(db, wh_log, wt, delivery_status="no_url",
                             error_message="No webhook URL configured for merchant")
        log.info("No merchant webhook URL for user %s", wt.user_id)
        return

    merchant_payload = _build_merchant_payload(wt)

    for attempt in range(1, MAX_RETRY_ATTEMPTS + 1):
        # delay before retry (first attempt = 0 delay)
        if attempt > 1 and attempt - 1 < len(RETRY_DELAYS):
            time.sleep(RETRY_DELAYS[attempt - 1])

        start_ms = time.monotonic()

        try:
            resp = requests.post(
                webhook_url,
                json=merchant_payload,
                headers={"Content-Type": "application/json"},
                timeout=MERCHANT_WEBHOOK_TIMEOUT,
            )
            elapsed_ms = int((time.monotonic() - start_ms) * 1000)

            # parse response body
            try:
                resp_body = resp.json()
            except Exception:
                resp_body = {"raw": resp.text[:1000]}

            if resp.status_code < 400:
                # ── delivered successfully ──
                _create_delivery_log(
                    db, wh_log, wt,
                    webhook_url=webhook_url,
                    request_payload=merchant_payload,
                    response_status_code=resp.status_code,
                    response_body=resp_body,
                    response_time_ms=elapsed_ms,
                    delivery_status="delivered",
                    attempt_number=attempt,
                )
                log.info("Webhook delivered for %s → %s (attempt %d, %dms)",
                         wt.order_id, webhook_url, attempt, elapsed_ms)
                return  # success — stop retrying
            else:
                # ── merchant returned error status ──
                _create_delivery_log(
                    db, wh_log, wt,
                    webhook_url=webhook_url,
                    request_payload=merchant_payload,
                    response_status_code=resp.status_code,
                    response_body=resp_body,
                    response_time_ms=elapsed_ms,
                    delivery_status="failed",
                    attempt_number=attempt,
                    error_message=f"Merchant returned HTTP {resp.status_code}",
                )
                log.warning("Webhook failed for %s → %s (attempt %d, HTTP %d)",
                            wt.order_id, webhook_url, attempt, resp.status_code)

        except requests.exceptions.Timeout:
            elapsed_ms = int((time.monotonic() - start_ms) * 1000)
            _create_delivery_log(
                db, wh_log, wt,
                webhook_url=webhook_url,
                request_payload=merchant_payload,
                response_time_ms=elapsed_ms,
                delivery_status="timeout",
                attempt_number=attempt,
                error_message=f"Timed out after {MERCHANT_WEBHOOK_TIMEOUT}s",
            )
            log.warning("Webhook timeout for %s → %s (attempt %d)",
                        wt.order_id, webhook_url, attempt)

        except requests.exceptions.ConnectionError as exc:
            elapsed_ms = int((time.monotonic() - start_ms) * 1000)
            _create_delivery_log(
                db, wh_log, wt,
                webhook_url=webhook_url,
                request_payload=merchant_payload,
                response_time_ms=elapsed_ms,
                delivery_status="failed",
                attempt_number=attempt,
                error_message=f"Connection error: {str(exc)[:300]}",
            )
            log.warning("Webhook connection error for %s → %s (attempt %d)",
                        wt.order_id, webhook_url, attempt)

        except Exception as exc:
            elapsed_ms = int((time.monotonic() - start_ms) * 1000)
            _create_delivery_log(
                db, wh_log, wt,
                webhook_url=webhook_url,
                request_payload=merchant_payload,
                response_time_ms=elapsed_ms,
                delivery_status="failed",
                attempt_number=attempt,
                error_message=str(exc)[:500],
            )
            log.exception("Webhook unexpected error for %s → %s (attempt %d)",
                          wt.order_id, webhook_url, attempt)

    # all retries exhausted
    log.error("Webhook delivery exhausted all %d attempts for %s → %s",
              MAX_RETRY_ATTEMPTS, wt.order_id, webhook_url)
