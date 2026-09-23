"""
Zeepays Payout Gateway Integration

API Docs: https://documenter.getpostman.com/view/43054244/2sBXwsMW3i

Endpoints:
  POST https://www.zeepays.in/ws/v1/Fetch/txnstatus  — check txn status
  POST https://www.zeepays.in/ws/v1/Fetch/operator_list — list services
  POST https://www.zeepays.in/ws/v1/payout/initiate — initiate payout

Webhook (callback):
  GET {{callbackURL}}?txnid=&requestid=&servicetxnid={UTR}&status=&desc=
"""

import logging
import uuid
import time

import requests
from sqlalchemy.orm import Session

from models.models import PayOutLog, india_tz
from datetime import datetime

log = logging.getLogger(__name__)

ZEEPAY_BASE = "https://www.zeepays.in/ws/v1"
ZEEPAY_PAYOUT_URL = f"{ZEEPAY_BASE}/Action/Process_payout_action"
ZEEPAY_TXN_STATUS_URL = f"{ZEEPAY_BASE}/Fetch/txnstatus"
ZEEPAY_SERVICE_LIST_URL = f"{ZEEPAY_BASE}/Fetch/operator_list"

ZEEPAY_USERNAME = "a319c804ae7941489a77f129f9616163"
ZEEPAY_PASSWORD = "f6c0cb4441351adc6d17418c3336f4e1"
ZEEPAY_LAT = "28.5393282"
ZEEPAY_LONG = "77.2822436"


def _save_payout_log(db: Session, *, user_id: str, order_id: str,
                     request_payload=None, response_payload=None,
                     status="pending", error_message=None):
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
        log.warning("Failed to save PayOutLog: %s", exc)


def initiate_zeepay_payout(ctx: dict, db: Session = None) -> dict:
    """
    Initiate a bank payout via Zeepays API.

    ctx keys: order_id, amount, ifsc, accountno, name, paymode, remarks,
              wallet_txn_id, user_id (merchant_id)
    """
    request_id = f"NEO_{uuid.uuid4().hex[:16].upper()}"

    payload = {
        "username": ZEEPAY_USERNAME,
        "password": ZEEPAY_PASSWORD,
        "requestid": request_id,
        "lat": ZEEPAY_LAT,
        "long": ZEEPAY_LONG,
        "sender": "9999999999",
        "service": "PYT1",
        "sendername": ctx.get("name", "Merchant"),
        "request_type": "INITIATE TXN",
        "account": ctx.get("accountno", ""),
        "bankifsc": ctx.get("ifsc", ""),
        "benename": ctx.get("name", ""),
        "banksel": ctx.get("branch", "") or ctx.get("bank_name", ""),
        "mode": ctx.get("paymode", "IMPS"),
        "amount": str(ctx.get("amount", "0")),
    }

    user_id = ctx.get("user_id", ctx.get("merchant_id", ""))
    order_id = ctx.get("order_id", "")

    log_payload = {k: v for k, v in payload.items() if k != "password"}

    try:
        resp = requests.post(
            ZEEPAY_PAYOUT_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=45,
        )
    except Exception as exc:
        if db:
            _save_payout_log(db, user_id=user_id, order_id=order_id,
                             request_payload=log_payload, status="error",
                             error_message=str(exc))
        raise RuntimeError(f"Zeepay payout request error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    resp_code = body.get("Resp_code", "")
    is_success = resp_code == "RCS"
    status = "pending" if is_success else "failed"

    if db:
        _save_payout_log(db, user_id=user_id, order_id=order_id,
                         request_payload=log_payload, response_payload=body,
                         status=status,
                         error_message=None if is_success else body.get("Resp_desc"))

    if not is_success:
        raise RuntimeError(
            f"Zeepay payout failed: {body.get('Resp_desc', resp.text)}"
        )

    data = body.get("data", {})

    return {
        "provider": "zeepay",
        "status": "PENDING",
        "provider_txn_id": data.get("txnid", request_id),
        "request_id": request_id,
        "amount": ctx.get("amount"),
        "utr": data.get("utr"),
        "raw": body,
    }


def check_zeepay_txn_status(txn_id: str, db: Session = None, user_id: str = "") -> dict:
    """Check transaction status from Zeepays."""
    request_id = f"CHK_{uuid.uuid4().hex[:12].upper()}"

    payload = {
        "username": ZEEPAY_USERNAME,
        "password": ZEEPAY_PASSWORD,
        "requestid": request_id,
        "lat": ZEEPAY_LAT,
        "long": ZEEPAY_LONG,
        "txnid": txn_id,
    }

    try:
        resp = requests.post(
            ZEEPAY_TXN_STATUS_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        body = resp.json()
    except Exception as exc:
        raise RuntimeError(f"Zeepay status check error: {exc}")

    data = body.get("data", {})

    return {
        "provider": "zeepay",
        "txn_id": data.get("txnid"),
        "utr": data.get("utr"),
        "status": data.get("txnstatus", "").upper(),
        "amount": data.get("txnamt"),
        "raw": body,
    }


def normalize_zeepay_webhook(params: dict) -> dict:
    """
    Normalize Zeepay callback query params:
    ?txnid=X&requestid=Y&servicetxnid={UTR}&status=Z&desc=D
    """
    raw_status = str(params.get("status", "")).upper()

    if raw_status == "SUCCESS":
        status = "success"
    elif raw_status in ("FAILED", "FAILURE", "REVERSED"):
        status = "failed"
    else:
        status = "pending"

    return {
        "order_id": params.get("requestid"),
        "provider_txn_id": params.get("txnid"),
        "utr": params.get("servicetxnid"),
        "status": status,
        "description": params.get("desc", ""),
    }
