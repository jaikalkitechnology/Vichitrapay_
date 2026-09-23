"""
GurutvaPay Payout Gateway Integration

Base URL: https://api.gurutvapay.com
Login:    POST /live/login (form-urlencoded)
Initiate: POST /live/payout/initiate (Bearer token, JSON)
Status:   POST /live/payout/status-check (Bearer token, JSON)
Balance:  GET  /live/payout/balance (Bearer token)
"""

import logging
import time
import threading
import uuid

import requests
from sqlalchemy.orm import Session

from models.models import PayOutLog, india_tz
from datetime import datetime

log = logging.getLogger(__name__)

BASE_URL = "https://api.gurutvapay.com"
LOGIN_URL = f"{BASE_URL}/live/login"
INITIATE_URL = f"{BASE_URL}/live/payout/initiate"
STATUS_URL = f"{BASE_URL}/live/payout/status-check"
BALANCE_URL = f"{BASE_URL}/live/payout/balance"

GRV_USERNAME = "neopayment_it"
GRV_PASSWORD = "Neo@Pass123"
GRV_CLIENT_ID = "live_4b47cac8-3d3e-4a23-8501-186cc422436a"
GRV_CLIENT_SECRET = "live_066b2cc7-d450-47a0-80a5-c8d74f85422e"


# ──────────────────────────────────────────────
#  Token cache
# ──────────────────────────────────────────────
_token_cache = {}
_token_lock = threading.Lock()
TOKEN_REFRESH_MARGIN = 300


def _get_cached_token(db: Session = None, merchant_id=None) -> str:
    now = time.time()
    cache_key = GRV_USERNAME

    with _token_lock:
        cached = _token_cache.get(cache_key)
        if cached and cached["expires_at"] > now + TOKEN_REFRESH_MARGIN:
            return cached["token"]

    token, expires_at = _login(db, merchant_id=merchant_id)

    with _token_lock:
        _token_cache[cache_key] = {"token": token, "expires_at": expires_at}

    return token


# ──────────────────────────────────────────────
#  Logging
# ──────────────────────────────────────────────

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
        log.warning("Failed to save GRV PayOutLog: %s", exc)


# ──────────────────────────────────────────────
#  API helpers
# ──────────────────────────────────────────────

def _login(db: Session = None, merchant_id=None) -> tuple:
    try:
        resp = requests.post(
            LOGIN_URL,
            data={
                "username": GRV_USERNAME,
                "password": GRV_PASSWORD,
                "client_id": GRV_CLIENT_ID,
                "client_secret": GRV_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
    except Exception as exc:
        raise RuntimeError(f"GRV payout login error: {exc}")

    if resp.status_code != 200:
        raise RuntimeError(f"GRV payout login failed ({resp.status_code}): {resp.text}")

    body = resp.json()
    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"GRV payout login missing access_token: {body}")

    expires_at = body.get("expires_at")
    if isinstance(expires_at, (int, float)) and expires_at > 1_000_000_000:
        pass
    elif body.get("expires_in"):
        expires_at = time.time() + int(body["expires_in"])
    else:
        expires_at = time.time() + 3600

    return token, float(expires_at)


def initiate_grv_payout(ctx: dict, db: Session = None) -> dict:
    """
    Initiate payout via GurutvaPay.

    ctx keys: order_id, amount, ifsc, accountno, name, paymode,
              branch/bank_name, user_id
    """
    token = _get_cached_token(db)
    merchant_order_id = ctx.get("order_id", f"ORD_{uuid.uuid4().hex[:12].upper()}")
    idem_key = str(uuid.uuid4())

    payload = {
        "amount": float(ctx.get("amount", 0)),
        "txn_type": ctx.get("paymode", "IMPS"),
        "account_type": ctx.get("account_type", "saving").lower(),
        "account_holder_name": ctx.get("name", ""),
        "account_no": ctx.get("accountno", ""),
        "ifsc": ctx.get("ifsc", ""),
        "bank_name": ctx.get("branch", "") or ctx.get("bank_name", ""),
        "email": ctx.get("email", "payout@neopayment.in"),
        "mobile": ctx.get("mobile", "9999999999"),
        "merchantOrderId": merchant_order_id,
    }

    user_id = ctx.get("user_id", ctx.get("merchant_id", ""))
    log_payload = {k: v for k, v in payload.items()}

    try:
        resp = requests.post(
            INITIATE_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Idempotency-Key": idem_key,
            },
            timeout=45,
        )
    except Exception as exc:
        if db:
            _save_payout_log(db, user_id=user_id, order_id=merchant_order_id,
                             request_payload=log_payload, status="error",
                             error_message=str(exc))
        raise RuntimeError(f"GRV payout initiate error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    is_ok = resp.status_code == 200
    if db:
        _save_payout_log(db, user_id=user_id, order_id=merchant_order_id,
                         request_payload=log_payload, response_payload=body,
                         status="pending" if is_ok else "failed",
                         error_message=None if is_ok else body.get("detail", resp.text))

    if not is_ok:
        raise RuntimeError(f"GRV payout failed ({resp.status_code}): {resp.text}")

    return {
        "provider": "grv_payout",
        "status": "PENDING",
        "provider_txn_id": body.get("merchantOrderId") or body.get("txn_id") or merchant_order_id,
        "request_id": merchant_order_id,
        "amount": ctx.get("amount"),
        "utr": body.get("utr"),
        "raw": body,
    }


def check_grv_payout_status(merchant_order_id: str, db: Session = None) -> dict:
    """Check payout status from GurutvaPay."""
    token = _get_cached_token(db)

    try:
        resp = requests.post(
            STATUS_URL,
            json={"merchantOrderId": merchant_order_id},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        body = resp.json()
    except Exception as exc:
        raise RuntimeError(f"GRV payout status error: {exc}")

    raw_status = str(body.get("status") or body.get("txn_status") or "").upper()
    if raw_status in ("SUCCESS", "COMPLETED"):
        status = "SUCCESS"
    elif raw_status in ("FAILED", "FAILURE", "REVERSED"):
        status = "FAILED"
    else:
        status = raw_status or "PENDING"

    return {
        "provider": "grv_payout",
        "txn_id": body.get("merchantOrderId") or merchant_order_id,
        "utr": body.get("utr"),
        "status": status,
        "amount": body.get("amount"),
        "raw": body,
    }


def get_grv_payout_balance(db: Session = None) -> dict:
    """Get payout wallet balance from GurutvaPay."""
    token = _get_cached_token(db)

    try:
        resp = requests.get(
            BALANCE_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        body = resp.json()
    except Exception as exc:
        raise RuntimeError(f"GRV payout balance error: {exc}")

    balance = (
        body.get("balance")
        or body.get("available_balance")
        or body.get("availableBalance")
        or body.get("amount")
    )

    return {
        "provider": "grv_payout",
        "balance": balance,
        "raw": body,
    }
