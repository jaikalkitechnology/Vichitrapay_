"""
MizorPay Payout Gateway Integration

Base URL: https://payout.mizorpay.in/api
Auth: Token-Id + Secret-Key headers (no login required)

Endpoints:
  POST /payment-initiate-bulk-v3  — initiate payout (single or bulk)
  POST /payout/check-status       — check txn status
  GET  /check-balance             — check wallet balance

Callback: POST to configured webhook URL with payout status
"""

import logging
import uuid

import requests
from sqlalchemy.orm import Session

from models.models import PayOutLog, india_tz
from datetime import datetime

log = logging.getLogger(__name__)

MIZORPAY_BASE = "https://payout.mizorpay.in/api"
MIZORPAY_INITIATE_URL = f"{MIZORPAY_BASE}/payment-initiate-bulk-v3"
MIZORPAY_STATUS_URL = f"{MIZORPAY_BASE}/payout/check-status"
MIZORPAY_BALANCE_URL = f"{MIZORPAY_BASE}/check-balance"

MIZORPAY_TOKEN_ID = "CRETOKENhqLZv8XhlX0RLeXwIOfHvj2GTDyBJfq0PT83jjbBYtVEqV7vJGKmmywd4NqS"
MIZORPAY_SECRET_KEY = "CREKEYsCyz54krnFnTlKrNaRzZrVJN1ZFEor24glEarGzfrxIvQRZokzRTnh11uUvFULRU8SKwQjUjh54ihHpZIPU8tsyM8xtmffaeRfMf"


def _headers():
    return {
        "Accept": "application/json",
        "Token-Id": MIZORPAY_TOKEN_ID,
        "Secret-Key": MIZORPAY_SECRET_KEY,
        "Content-Type": "application/json",
    }


def _save_payout_log(db: Session, *, user_id: str, order_id: str,
                     request_payload=None, response_payload=None,
                     status="pending", error_message=None):
    if not db:
        return
    try:
        entry = PayOutLog(
            user_id=user_id,
            order_id=order_id,
            request_payload=str(request_payload) if request_payload else None,
            response_payload=str(response_payload) if response_payload else None,
            status=status,
            error_message=error_message,
            created_at=datetime.now(india_tz),
            updated_at=datetime.now(india_tz),
        )
        db.add(entry)
        db.flush()
    except Exception as exc:
        log.warning("Failed to save MizorPay PayOutLog: %s", exc)


def initiate_mizorpay_payout(ctx: dict, db: Session = None) -> dict:
    """
    Initiate payout via MizorPay bulk API (single transaction).
    """
    raw_id = ctx.get("order_id", uuid.uuid4().hex[:16].upper())
    txn_id = "VICHITRAPAY" + "".join(c for c in raw_id if c.isalnum())

    payload = [
        {
            "bank_name": ctx.get("branch", "") or ctx.get("bank_name", ""),
            "account_number": ctx.get("accountno", ""),
            "confirm_account_number": ctx.get("accountno", ""),
            "ifsc_code": ctx.get("ifsc", ""),
            "beneficiary_name": ctx.get("name", ""),
            "amount": int(float(ctx.get("amount", 0))),
            "email": ctx.get("email", "payout@neopayment.in"),
            "mobile": ctx.get("mobile", "9999999999"),
            "transaction_id": txn_id,
        }
    ]

    user_id = ctx.get("user_id", ctx.get("merchant_id", ""))

    try:
        resp = requests.post(
            MIZORPAY_INITIATE_URL,
            json=payload,
            headers=_headers(),
            timeout=45,
        )
    except Exception as exc:
        if db:
            _save_payout_log(db, user_id=user_id, order_id=txn_id,
                             request_payload=payload, status="error",
                             error_message=str(exc))
        raise RuntimeError(f"MizorPay payout request error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    success_count = body.get("success", 0)
    is_ok = success_count > 0

    if db:
        _save_payout_log(db, user_id=user_id, order_id=txn_id,
                         request_payload=payload, response_payload=body,
                         status="pending" if is_ok else "failed",
                         error_message=None if is_ok else str(body.get("errors", resp.text)))

    if not is_ok:
        errors = body.get("errors", [])
        # parse error into readable message
        msg_parts = []
        for err in errors:
            if isinstance(err, dict):
                for field, msgs in err.items():
                    if isinstance(msgs, list):
                        msg_parts.append(f"{field}: {', '.join(msgs)}")
                    else:
                        msg_parts.append(f"{field}: {msgs}")
            else:
                msg_parts.append(str(err))
        err_msg = "; ".join(msg_parts) if msg_parts else resp.text
        return {
            "provider": "mizorpay",
            "status": "FAILED",
            "provider_txn_id": txn_id,
            "request_id": txn_id,
            "amount": ctx.get("amount"),
            "utr": None,
            "error": err_msg,
            "raw": body,
        }

    successful = body.get("successful", [])
    provider_txn_id = successful[0].get("transaction_id", txn_id) if successful else txn_id

    return {
        "provider": "mizorpay",
        "status": "PENDING",
        "provider_txn_id": provider_txn_id,
        "request_id": txn_id,
        "amount": ctx.get("amount"),
        "utr": None,
        "raw": body,
    }


def check_mizorpay_status(txn_id: str, db: Session = None) -> dict:
    """Check payout status from MizorPay."""
    payload = {"txn_id": txn_id}

    try:
        resp = requests.post(
            MIZORPAY_STATUS_URL,
            json=payload,
            headers=_headers(),
            timeout=30,
        )
        body = resp.json()
    except Exception as exc:
        raise RuntimeError(f"MizorPay status check error: {exc}")

    payout = body.get("payout", {})
    raw_status = str(payout.get("status", "")).upper()

    if raw_status == "SUCCESS":
        status = "SUCCESS"
    elif raw_status in ("FAILED", "REJECTED"):
        status = "FAILED"
    else:
        status = raw_status or "PENDING"

    return {
        "provider": "mizorpay",
        "txn_id": payout.get("txn_id") or txn_id,
        "mizor_pay_txn_id": payout.get("mizor_pay_txn_id"),
        "utr": payout.get("utr"),
        "status": status,
        "amount": payout.get("amount"),
        "refund_status": payout.get("refund_status"),
        "message": payout.get("message"),
        "raw": body,
    }


def get_mizorpay_balance(db: Session = None) -> dict:
    """Get MizorPay payout wallet balance."""
    try:
        resp = requests.get(
            MIZORPAY_BALANCE_URL,
            headers=_headers(),
            timeout=30,
        )
        body = resp.json()
    except Exception as exc:
        raise RuntimeError(f"MizorPay balance check error: {exc}")

    return {
        "provider": "mizorpay",
        "balance": body.get("balance"),
        "raw": body,
    }


def normalize_mizorpay_webhook(payload: dict) -> dict:
    """
    Normalize MizorPay callback payload.
    { "payout": { "status": "SUCCESS", "txn_id": "...", "utr": "...", "amount": "..." } }
    """
    payout = payload.get("payout", {})
    raw_status = str(payout.get("status", "")).upper()

    if raw_status == "SUCCESS":
        status = "success"
    elif raw_status in ("FAILED", "REJECTED"):
        status = "failed"
    else:
        status = "pending"

    return {
        "order_id": payout.get("txn_id"),
        "provider_txn_id": payout.get("txn_id"),
        "utr": payout.get("utr"),
        "status": status,
        "amount": payout.get("amount"),
        "refunded": payout.get("refunded"),
    }
