"""
GurutvaPay Payment Gateway Integration

Base URL: https://api.gurutvapay.com
Login:    POST /live/login (form-urlencoded: username, password, client_id, client_secret)
Payment:  POST /live/initiate-payment (Bearer token, JSON)
UPI QR:   POST /live/upi/qrcode/{token} (JSON: fingerprint, userAgent)
"""

import hashlib
import logging
import time
import threading

import requests
from sqlalchemy.orm import Session

from models.models import TemplamartApiLog

log = logging.getLogger(__name__)

BASE_URL = "https://api.gurutvapay.com"
LOGIN_URL = f"{BASE_URL}/live/login"
INITIATE_URL = f"{BASE_URL}/live/initiate-payment"
UPI_QR_URL = f"{BASE_URL}/live/upi/qrcode"

GURUTVAPAY_USERNAME = "neopayment_it"
GURUTVAPAY_PASSWORD = "Neo@Pass123"
GURUTVAPAY_CLIENT_ID = "live_4b47cac8-3d3e-4a23-8501-186cc422436a"
GURUTVAPAY_CLIENT_SECRET = "live_066b2cc7-d450-47a0-80a5-c8d74f85422e"


# ──────────────────────────────────────────────
#  Token cache
# ──────────────────────────────────────────────
_token_cache = {}
_token_lock = threading.Lock()
TOKEN_REFRESH_MARGIN = 300


def _get_cached_token(db: Session, merchant_id=None) -> str:
    now = time.time()
    cache_key = GURUTVAPAY_USERNAME

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

def _save_log(db: Session, *, merchant_id=None, order_id=None, endpoint: str,
              request_payload=None, response_payload=None, http_status=None,
              status="success", error_message=None):
    try:
        entry = TemplamartApiLog(
            merchant_id=merchant_id,
            order_id=order_id,
            endpoint=f"gurutvapay:{endpoint}",
            request_payload=request_payload,
            response_payload=response_payload,
            http_status=http_status,
            status=status,
            error_message=error_message,
        )
        db.add(entry)
        db.flush()
    except Exception as exc:
        log.warning("Failed to save GurutvaPay log: %s", exc)


# ──────────────────────────────────────────────
#  API helpers
# ──────────────────────────────────────────────

def _login(db: Session, merchant_id=None) -> tuple:
    req_data = {"username": GURUTVAPAY_USERNAME, "password": "***",
                "client_id": GURUTVAPAY_CLIENT_ID, "client_secret": "***"}

    try:
        resp = requests.post(
            LOGIN_URL,
            data={
                "username": GURUTVAPAY_USERNAME,
                "password": GURUTVAPAY_PASSWORD,
                "client_id": GURUTVAPAY_CLIENT_ID,
                "client_secret": GURUTVAPAY_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, endpoint="login",
                  request_payload=req_data, status="error",
                  error_message=str(exc))
        raise RuntimeError(f"GurutvaPay login error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    _save_log(db, merchant_id=merchant_id, endpoint="login",
              request_payload=req_data, response_payload=body,
              http_status=resp.status_code,
              status="success" if resp.status_code == 200 else "failed",
              error_message=None if resp.status_code == 200 else resp.text)

    if resp.status_code != 200:
        raise RuntimeError(f"GurutvaPay login failed ({resp.status_code}): {resp.text}")

    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"GurutvaPay login missing access_token: {body}")

    expires_at = body.get("expires_at")
    if isinstance(expires_at, (int, float)) and expires_at > 1_000_000_000:
        pass
    elif body.get("expires_in"):
        expires_at = time.time() + int(body["expires_in"])
    else:
        expires_at = time.time() + 3600

    return token, float(expires_at)


def _initiate_payment(db: Session, token: str, payload: dict,
                      merchant_id=None, order_id=None) -> dict:
    try:
        resp = requests.post(
            INITIATE_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=45,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, order_id=order_id,
                  endpoint="initiate-payment", request_payload=payload,
                  status="error", error_message=str(exc))
        raise RuntimeError(f"GurutvaPay initiate-payment error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    _save_log(db, merchant_id=merchant_id, order_id=order_id,
              endpoint="initiate-payment", request_payload=payload,
              response_payload=body, http_status=resp.status_code,
              status="success" if resp.status_code == 200 else "failed",
              error_message=None if resp.status_code == 200 else resp.text)

    if resp.status_code != 200:
        raise RuntimeError(f"GurutvaPay initiate-payment failed ({resp.status_code}): {resp.text}")

    return body


def _create_upi_qr(db: Session, token_value: str, fingerprint: str, user_agent: str,
                   merchant_id=None, order_id=None) -> dict:
    """POST /live/upi/qrcode/{token} with fingerprint + userAgent."""
    url = f"{UPI_QR_URL}/{token_value}"
    payload = {
        "fingerprint": fingerprint,
        "userAgent": user_agent,
    }

    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=45,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, order_id=order_id,
                  endpoint="upi-qrcode", request_payload=payload,
                  status="error", error_message=str(exc))
        raise RuntimeError(f"GurutvaPay UPI QR error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    _save_log(db, merchant_id=merchant_id, order_id=order_id,
              endpoint="upi-qrcode", request_payload=payload,
              response_payload=body, http_status=resp.status_code,
              status="success" if resp.status_code == 200 else "failed",
              error_message=None if resp.status_code == 200 else resp.text)

    if resp.status_code != 200:
        raise RuntimeError(f"GurutvaPay UPI QR failed ({resp.status_code}): {resp.text}")

    return body


# ──────────────────────────────────────────────
#  Public functions
# ──────────────────────────────────────────────

def _build_payload(ctx: dict) -> dict:
    customer = ctx.get("customer", {})
    return {
        "amount": float(ctx["amount"]),
        "merchantOrderId": ctx["merchant_order_id"],
        "channel": ctx.get("channel", "web"),
        "purpose": ctx.get("purpose", "Online Payment"),
        "customer": {
            "buyer_name": customer.get("buyer_name", ""),
            "email": customer.get("email", ""),
            "phone": customer.get("phone", ""),
            "address1": customer.get("address1", ""),
            "address2": customer.get("address2", ""),
        },
    }


def initiate_gurutvapay_payin(ctx: dict) -> dict:
    """
    GurutvaPay PayIn:
      1. Get cached token
      2. POST /live/initiate-payment
    """
    db: Session = ctx["db"]
    merchant_id = ctx.get("merchant_id")

    token = _get_cached_token(db, merchant_id=merchant_id)
    order_id = ctx["merchant_order_id"]
    payload = _build_payload(ctx)

    data = _initiate_payment(db, token, payload,
                             merchant_id=merchant_id, order_id=order_id)

    return {
        "provider": "gurutvapay",
        "status": "initiated",
        "txn_id": data.get("grd_id"),
        "merchant_order_id": data.get("grd_id"),
        "amount": data.get("amount"),
        "currency": "INR",
        "payment_url": data.get("payment_url"),
        "payment_token": data.get("token"),
        "expires_in": data.get("expires_in"),
        "raw": data,
    }


def initiate_gurutvapay_upi_intent(ctx: dict) -> dict:
    """
    GurutvaPay UPI Intent:
      1. Get cached token → initiate payment → get payment token
      2. POST /live/upi/qrcode/{token} with fingerprint + userAgent
    """
    db: Session = ctx["db"]
    merchant_id = ctx.get("merchant_id")

    token = _get_cached_token(db, merchant_id=merchant_id)
    order_id = ctx["merchant_order_id"]
    payload = _build_payload(ctx)

    # Step 1: initiate payment to get payment token
    payment_data = _initiate_payment(db, token, payload,
                                     merchant_id=merchant_id, order_id=order_id)

    payment_token = payment_data.get("token")
    if not payment_token:
        raise RuntimeError(f"GurutvaPay: no payment token in response: {payment_data}")

    # Step 2: call UPI QR with the payment token
    fingerprint = hashlib.md5(
        f"{order_id}{merchant_id}{time.time()}".encode()
    ).hexdigest()
    user_agent = (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.6312.99 Mobile Safari/537.36"
    )

    upi_data = _create_upi_qr(db, payment_token, fingerprint, user_agent,
                               merchant_id=merchant_id, order_id=order_id)

    intent_data = upi_data.get("data", {})

    return {
        "provider": "gurutvapay",
        "status": "initiated",
        "txn_id": intent_data.get("orderId") or payment_data.get("grd_id"),
        "merchant_order_id": payment_data.get("grd_id"),
        "amount": payment_data.get("amount"),
        "currency": "INR",
        "payment_url": payment_data.get("payment_url"),
        "intent_url": intent_data.get("intentUrl"),
        "order_token": intent_data.get("orderToken"),
        "raw": upi_data,
    }


def get_gurutvapay_ticket_sizes(ctx: dict) -> dict:
    """GurutvaPay does not require ticket sizes."""
    return {
        "provider": "gurutvapay",
        "ticket_sizes": [],
        "ticket_size_required": False,
        "message": "GurutvaPay accepts any amount — no ticket sizes required",
    }


def normalize_gurutvapay_webhook(payload: dict) -> dict:
    """
    Normalize GurutvaPay webhook payload.
    Expected format similar to templamart flat webhook.
    """
    raw_status = str(payload.get("status", "")).lower()
    event = str(payload.get("event", "")).lower()

    if raw_status == "success" or "completed" in event or "success" in event:
        status = "success"
    elif raw_status == "failed" or "failed" in event:
        status = "failed"
    else:
        status = "pending"

    return {
        "order_id": payload.get("merchantOrderId") or payload.get("grd_id"),
        "provider_txn_id": payload.get("transaction_id") or payload.get("txn_id") or payload.get("grd_id"),
        "amount": float(payload.get("amount", 0)),
        "status": status,
        "utr": payload.get("utr"),
    }
