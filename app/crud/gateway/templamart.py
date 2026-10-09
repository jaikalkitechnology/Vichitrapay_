import hashlib
import logging
import time
import threading

import requests
from sqlalchemy.orm import Session

from models.models import TemplamartApiLog

log = logging.getLogger(__name__)

BASE_URL = "https://api.templamart.com"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"
TICKET_SIZE_URL = f"{BASE_URL}/api/v1/payments/async/ticket-sizes"
CREATE_PAYMENT_URL = f"{BASE_URL}/api/v1/payments/async/create-payment"
UPI_INTENT_URL = f"{BASE_URL}/api/v1/payments/async/initiate-upi-intent"


# ──────────────────────────────────────────────
#  Token cache — one login shared across requests
# ──────────────────────────────────────────────
_token_cache = {}  # { username: { "token": str, "expires_at": float } }
_token_lock = threading.Lock()
TOKEN_REFRESH_MARGIN = 300  # refresh 5 min before expiry


def _get_cached_token(db: Session, username: str, password: str, merchant_id=None) -> str:
    """Return a valid access_token, reusing cached token if not expired."""
    now = time.time()

    with _token_lock:
        cached = _token_cache.get(username)
        if cached and cached["expires_at"] > now + TOKEN_REFRESH_MARGIN:
            return cached["token"]

    # login required (outside lock so we don't block other threads)
    token, expires_at = _login(db, username, password, merchant_id=merchant_id)

    with _token_lock:
        _token_cache[username] = {"token": token, "expires_at": expires_at}

    return token


# ──────────────────────────────────────────────
#  Logging helper
# ──────────────────────────────────────────────

def _save_log(db: Session, *, merchant_id=None, order_id=None, endpoint: str,
              request_payload=None, response_payload=None, http_status=None,
              status="success", error_message=None):
    try:
        entry = TemplamartApiLog(
            merchant_id=merchant_id,
            order_id=order_id,
            endpoint=endpoint,
            request_payload=request_payload,
            response_payload=response_payload,
            http_status=http_status,
            status=status,
            error_message=error_message,
        )
        db.add(entry)
        db.flush()
    except Exception as exc:
        log.warning("Failed to save TemplamartApiLog: %s", exc)


# ──────────────────────────────────────────────
#  API helpers
# ──────────────────────────────────────────────

def _login(db: Session, username: str, password: str, merchant_id=None) -> tuple:
    """Authenticate and return (access_token, expires_at_epoch)."""
    req_data = {"username": username, "password": "***"}

    try:
        resp = requests.post(
            LOGIN_URL,
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, endpoint="login",
                  request_payload=req_data, status="error",
                  error_message=str(exc))
        raise RuntimeError(f"Templamart login request error: {exc}")

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
        raise RuntimeError(f"Templamart login failed ({resp.status_code}): {resp.text}")

    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"Templamart login response missing access_token: {body}")

    # parse expiry — use expires_at (epoch) or expires_in (seconds)
    expires_at = body.get("expires_at")
    if isinstance(expires_at, (int, float)) and expires_at > 1_000_000_000:
        pass  # already epoch
    elif body.get("expires_in"):
        expires_at = time.time() + int(body["expires_in"])
    else:
        expires_at = time.time() + 3600  # default 1 hour

    return token, float(expires_at)


def _get_ticket_sizes(db: Session, token: str, merchant_id=None) -> list:
    try:
        resp = requests.get(
            TICKET_SIZE_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, endpoint="ticket-sizes",
                  status="error", error_message=str(exc))
        raise RuntimeError(f"Templamart ticket-sizes request error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    _save_log(db, merchant_id=merchant_id, endpoint="ticket-sizes",
              response_payload=body, http_status=resp.status_code,
              status="success" if resp.status_code == 200 else "failed",
              error_message=None if resp.status_code == 200 else resp.text)

    if resp.status_code != 200:
        raise RuntimeError(f"Templamart ticket-sizes failed ({resp.status_code}): {resp.text}")

    return body.get("ticket_sizes", [])


def _create_payment(db: Session, token: str, payload: dict,
                    merchant_id=None, order_id=None) -> dict:
    try:
        resp = requests.post(
            CREATE_PAYMENT_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=45,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, order_id=order_id,
                  endpoint="create-payment", request_payload=payload,
                  status="error", error_message=str(exc))
        raise RuntimeError(f"Templamart create-payment request error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    _save_log(db, merchant_id=merchant_id, order_id=order_id,
              endpoint="create-payment", request_payload=payload,
              response_payload=body, http_status=resp.status_code,
              status="success" if resp.status_code == 200 else "failed",
              error_message=None if resp.status_code == 200 else resp.text)

    if resp.status_code != 200:
        raise RuntimeError(f"Templamart create-payment failed ({resp.status_code}): {resp.text}")

    return body


def _create_upi_intent(db: Session, token: str, payload: dict,
                       merchant_id=None, order_id=None) -> dict:
    try:
        resp = requests.post(
            UPI_INTENT_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=45,
        )
    except Exception as exc:
        _save_log(db, merchant_id=merchant_id, order_id=order_id,
                  endpoint="upi-intent", request_payload=payload,
                  status="error", error_message=str(exc))
        raise RuntimeError(f"Templamart upi-intent request error: {exc}")

    try:
        body = resp.json()
    except Exception:
        body = {"raw_text": resp.text}

    _save_log(db, merchant_id=merchant_id, order_id=order_id,
              endpoint="upi-intent", request_payload=payload,
              response_payload=body, http_status=resp.status_code,
              status="success" if resp.status_code == 200 else "failed",
              error_message=None if resp.status_code == 200 else resp.text)

    if resp.status_code != 200:
        raise RuntimeError(f"Templamart upi-intent failed ({resp.status_code}): {resp.text}")

    return body


TEMPLAMART_USERNAME = "janvi_traders"
TEMPLAMART_PASSWORD = "RT@janvi4321"


# ──────────────────────────────────────────────
#  Public functions used by the router
# ──────────────────────────────────────────────

def _build_payload(ctx: dict, amount: float) -> dict:
    customer = ctx.get("customer", {})
    return {
        "amount": amount,
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


def initiate_templamart_payin(ctx: dict) -> dict:
    """
    Templamart PayIn initiation:
      1. Get cached token (login only if expired)
      2. Create payment → return payment_link
    Passes the raw amount to Templamart — returns whatever API responds.
    """
    db: Session = ctx["db"]
    merchant_id = ctx.get("merchant_id")
    username = TEMPLAMART_USERNAME
    password = TEMPLAMART_PASSWORD

    token = _get_cached_token(db, username, password, merchant_id=merchant_id)
    amount = float(ctx["amount"])
    order_id = ctx["merchant_order_id"]
    payload = _build_payload(ctx, amount)

    data = _create_payment(db, token, payload,
                           merchant_id=merchant_id, order_id=order_id)

    return {
        "provider": "templa01",
        "status": "initiated",
        "txn_id": data.get("orderId"),
        "merchantOrderId": data.get("merchantOrderId"),
        "amount": data.get("amount"),
        "currency": "INR",
        "payment_url": data.get("payment_url"),
        "expires_at": data.get("expireAt"),
        "raw": data,
    }


def get_templamart_ticket_sizes(ctx: dict) -> dict:
    """Fetch available ticket sizes from Templamart."""
    db: Session = ctx["db"]
    merchant_id = ctx.get("merchant_id")
    username = TEMPLAMART_USERNAME
    password = TEMPLAMART_PASSWORD

    token = _get_cached_token(db, username, password, merchant_id=merchant_id)
    ticket_sizes = _get_ticket_sizes(db, token, merchant_id=merchant_id)

    return {
        "provider": "templamart",
        "ticket_sizes": ticket_sizes,
        "ticket_size_required": True,
    }


def initiate_templamart_upi_intent(ctx: dict) -> dict:
    """
    Templamart UPI Intent PayIn:
      1. Get cached token
      2. Create UPI intent payment → return intent_url / qr_data
    Passes the raw amount — returns whatever API responds.
    """
    db: Session = ctx["db"]
    merchant_id = ctx.get("merchant_id")
    username = TEMPLAMART_USERNAME
    password = TEMPLAMART_PASSWORD

    token = _get_cached_token(db, username, password, merchant_id=merchant_id)
    amount = float(ctx["amount"])
    order_id = ctx["merchant_order_id"]
    payload = _build_payload(ctx, amount)

    payload["fingerprint"] = hashlib.md5(
        f"{order_id}{merchant_id}{time.time()}".encode()
    ).hexdigest()
    payload["userAgent"] = (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.6312.99 Mobile Safari/537.36"
    )

    data = _create_upi_intent(db, token, payload,
                              merchant_id=merchant_id, order_id=order_id)

    return {
        "provider": "Templamart",
        "status": "initiated",
        "txn_id": data.get("orderId"),
        "merchant_order_id": data.get("merchantOrderId"),
        "amount": data.get("amount"),
        "currency": "INR",
        "payment_url": data.get("payment_link"),
        "intent_url": data.get("intentUrl") or data.get("intent_url"),
        "qr_data": data.get("qrData") or data.get("qr_data"),
        "expires_at": data.get("expireAt"),
        "raw": data,
    }


def normalize_templamart_webhook(payload: dict) -> dict:
    """
    Handles both Templamart webhook formats:

    Format A (flat — actual observed):
    {
      "event": "payment.success",
      "status": "success",
      "amount": 200.0,
      "merchantOrderId": "2032639728341401600",
      "transaction_id": "1824371673",
      "utr": "607391717789",
      ...
    }

    Format B (nested — documented):
    {
      "event": "pg.order.completed",
      "payload": {
        "state": "COMPLETED",
        "amount": 50000,           # in paise
        "merchantOrderId": "GRP739...",
        "paymentDetails": [
          { "transactionId": "OM251...", "rail": { "utr": "736258989655" } }
        ]
      }
    }
    """

    # Format B: nested payload
    if "payload" in payload and isinstance(payload.get("payload"), dict):
        inner = payload["payload"]
        status = "success" if inner.get("state") == "COMPLETED" else "failed"
        payment_details = inner.get("paymentDetails") or []
        provider_txn_id = None
        utr = None
        if payment_details:
            provider_txn_id = payment_details[0].get("transactionId")
            rail = payment_details[0].get("rail") or {}
            utr = rail.get("utr")
        return {
            "order_id": inner.get("merchantOrderId"),
            "provider_txn_id": provider_txn_id,
            "amount": inner.get("amount", 0) / 100,
            "status": status,
            "utr": utr,
        }

    # Format A: flat payload (actual webhook)
    raw_status = str(payload.get("status", "")).lower()
    event = str(payload.get("event", "")).lower()
    status = "success" if raw_status == "success" or event == "payment.success" else "failed"

    return {
        "order_id": payload.get("merchantOrderId"),
        "provider_txn_id": payload.get("transaction_id") or payload.get("order_id"),
        "amount": float(payload.get("amount", 0)),
        "status": status,
        "utr": payload.get("utr"),
    }
