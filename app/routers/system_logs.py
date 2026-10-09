"""
Admin → System Logs: PhonePe webhook logs, outgoing merchant webhook deliveries and
payment instrument logs. Lists are paginated and light; `/{id}` returns the full payloads.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from models.models import (
    LiveWebhookPhonePeLog, TemplamartApiLog, TransactionInstrument, WalletTransaction, WebhookDeliveryLog, WebhookLog,
)
from crud.gateway import templamart as tm
from utils.authenticate import admin_required
from utils.database import get_db

router = APIRouter(prefix="/api/v1/admin/logs", tags=["Admin System Logs"], dependencies=[Depends(admin_required)])

IST = timedelta(hours=5, minutes=30)  # transaction_instruments.created_at is stored in UTC, the others in IST


def _day(v: Optional[str]) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.strptime(v[:10], "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, f"Invalid date {v!r}, use YYYY-MM-DD")


def _date_filters(col, from_date, to_date, shift: timedelta = timedelta(0)) -> list:
    f, start, end = [], _day(from_date), _day(to_date)
    if start:
        f.append(col >= start - shift)
    if end:
        f.append(col < end + timedelta(days=1) - shift)
    return f


def _iso(d: Optional[datetime], shift: timedelta = timedelta(0)) -> Optional[str]:
    return (d + shift).isoformat() if d else None


def _page(q, page: int, per_page: int, order_col):
    total = q.order_by(None).count()
    rows = q.order_by(order_col.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return rows, int(total)


def _distinct(db: Session, col) -> list:
    return sorted({v for (v,) in db.query(col).filter(col.isnot(None)).distinct().all() if v})


# ── PhonePe webhook logs ────────────────────────────────────────────────
@router.get("/phonepe-webhooks")
def phonepe_webhooks(
    search: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    L = LiveWebhookPhonePeLog
    q = db.query(L).filter(*_date_filters(L.created_at, from_date, to_date))
    if status:
        q = q.filter(L.status == status)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(cast(L.id, String).like(s), L.source_ip.like(s), L.reason.like(s)))
    rows, total = _page(q, page, per_page, L.id)
    return {
        "items": [
            {"id": r.id, "source_ip": r.source_ip, "status": r.status, "reason": r.reason,
             "has_data": r.received_data is not None, "created_at": _iso(r.created_at)}
            for r in rows
        ],
        "total": total, "page": page, "per_page": per_page,
        "statuses": _distinct(db, L.status),
    }


@router.get("/phonepe-webhooks/{log_id}")
def phonepe_webhook(log_id: int, db: Session = Depends(get_db)):
    r = db.query(LiveWebhookPhonePeLog).filter(LiveWebhookPhonePeLog.id == log_id).first()
    if not r:
        raise HTTPException(404, "Log not found")
    return {
        "id": r.id,
        "request_payload": r.received_data,
        "headers": r.headers,
        "status": r.status,
        "reason": r.reason,
        "source_ip": r.source_ip,
        "created_at": _iso(r.created_at),
    }


# ── Outgoing merchant webhook deliveries ────────────────────────────────
@router.get("/webhook-deliveries")
def webhook_deliveries(
    search: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    D = WebhookDeliveryLog
    q = db.query(D).filter(*_date_filters(D.created_at, from_date, to_date))
    if status:
        q = q.filter(D.delivery_status == status)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(cast(D.id, String).like(s), D.merchant_id.like(s), D.webhook_url.like(s),
                         D.order_id.like(s), D.delivery_status.like(s), D.error_message.like(s)))
    rows, total = _page(q, page, per_page, D.id)
    return {
        "items": [
            {"id": r.id, "merchant_id": r.merchant_id, "order_id": r.order_id, "url": r.webhook_url,
             "http_status": r.response_status_code, "status": r.delivery_status, "attempt": r.attempt_number,
             "error": r.error_message, "response_time_ms": r.response_time_ms, "created_at": _iso(r.created_at)}
            for r in rows
        ],
        "total": total, "page": page, "per_page": per_page,
        "statuses": _distinct(db, D.delivery_status),
    }


@router.get("/webhook-deliveries/{log_id}")
def webhook_delivery(log_id: int, db: Session = Depends(get_db)):
    r = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.id == log_id).first()
    if not r:
        raise HTTPException(404, "Log not found")
    return {
        "id": r.id,
        "merchant_id": r.merchant_id,
        "order_id": r.order_id,
        "url": r.webhook_url,
        "request_payload": r.request_payload,
        "request_headers": r.request_headers,
        "response": {"code": r.response_status_code, "body": r.response_body, "time_ms": r.response_time_ms},
        "status": r.delivery_status,
        "attempt": r.attempt_number,
        "error": r.error_message,
        "created_at": _iso(r.created_at),
        "delivered_at": _iso(r.delivered_at),
    }


# ── Payment instrument logs ─────────────────────────────────────────────
def _meta(col, key):
    return col[key].as_string()


@router.get("/instruments")
def instruments(
    search: Optional[str] = None,
    tsp: Optional[str] = None,
    domain: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    I, W = TransactionInstrument, WalletTransaction
    tsp_col, dom_col, ip_col = _meta(I.meta, "provider"), _meta(I.meta, "domain"), _meta(I.meta, "client_ip")
    q = (
        db.query(I, W.user_id, W.order_id, W.amount)
        .join(W, W.id == I.wallet_transaction_id)
        .filter(*_date_filters(I.created_at, from_date, to_date, shift=IST))
    )
    if tsp:
        q = q.filter(tsp_col == tsp)
    if domain:
        q = q.filter(dom_col == domain)
    if status:
        q = q.filter(I.status == status)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(cast(I.id, String).like(s), W.user_id.like(s), W.order_id.like(s), I.txn_id.like(s),
                         tsp_col.like(s), dom_col.like(s), ip_col.like(s)))
    rows, total = _page(q, page, per_page, I.id)
    return {
        "items": [
            {"id": i.id, "merchant_id": mid, "order_id": oid, "amount": amt,
             "tsp": (i.meta or {}).get("provider"), "ip": (i.meta or {}).get("client_ip"),
             "domain": (i.meta or {}).get("domain"), "identity_key": i.browser_fingerprint or i.provider_order_token,
             "instrument_type": i.instrument_type.value if hasattr(i.instrument_type, "value") else i.instrument_type,
             "status": i.status, "created_at": _iso(i.created_at, IST)}
            for i, mid, oid, amt in rows
        ],
        "total": total, "page": page, "per_page": per_page,
        "statuses": _distinct(db, I.status),
        "tsps": _distinct(db, tsp_col),
        "domains": _distinct(db, dom_col),
    }


@router.get("/instruments/{log_id}")
def instrument(log_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(TransactionInstrument, WalletTransaction)
        .join(WalletTransaction, WalletTransaction.id == TransactionInstrument.wallet_transaction_id)
        .filter(TransactionInstrument.id == log_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Log not found")
    i, w = row
    meta = i.meta or {}
    templamart_request, server_request = _templamart_calls(db, w.order_id)
    return {
        "id": i.id,
        "request_payload": {
            "merchantId": w.user_id,
            "merchantOrderId": w.order_id,
            "tsp": meta.get("provider"),
            "instrumentType": i.instrument_type.value if hasattr(i.instrument_type, "value") else i.instrument_type,
            "amount": w.amount,
            "currency": "INR",
            "upiVpa": i.upi_vpa,
            "clientIp": meta.get("client_ip"),
            "domain": meta.get("domain"),
            "userAgent": i.user_agent,
        },
        "templamart_request": templamart_request,
        "response_payload": i.provider_response,
        "server_request_templamart": server_request,
        "status": i.status,
        "txn_id": i.txn_id,
        "identity_key": i.browser_fingerprint or i.provider_order_token,
        "meta": meta,
        "created_at": _iso(i.created_at, IST),
    }


TM_URLS = {"create-payment": tm.CREATE_PAYMENT_URL, "upi-intent": tm.UPI_INTENT_URL, "initiate-upi-intent": tm.UPI_INTENT_URL,
           "ticket-sizes": tm.TICKET_SIZE_URL, "login": tm.LOGIN_URL}


def _templamart_calls(db: Session, order_id: Optional[str]) -> tuple:
    """What Vichitrapay sent to Templamart for this order (templamart_api_logs) and the
    webhook(s) Templamart's server sent back (webhook_logs). {} when there are none."""
    if not order_id:
        return {}, {}

    def call(r: TemplamartApiLog) -> dict:
        return {
            "endpoint": r.endpoint,
            "url": TM_URLS.get(r.endpoint or ""),
            "request": r.request_payload,
            "response": r.response_payload,
            "http_status": r.http_status,
            "status": r.status,
            "error": r.error_message,
            "created_at": _iso(r.created_at),
        }

    def hook(r: WebhookLog) -> dict:
        return {
            "received_payload": r.received_payload,
            "normalized": r.normalized_payload,
            "provider_status": r.provider_status,
            "error": r.error_message,
            "received_at": _iso(r.created_at),
        }

    calls = db.query(TemplamartApiLog).filter(TemplamartApiLog.order_id == order_id).order_by(TemplamartApiLog.id.desc()).all()
    hooks = (db.query(WebhookLog).filter(WebhookLog.provider == "templamart", WebhookLog.order_id == order_id)
             .order_by(WebhookLog.id.desc()).all())
    sent = call(calls[0]) if calls else {}
    if len(calls) > 1:
        sent["earlier_calls"] = [call(r) for r in calls[1:]]
    back = hook(hooks[0]) if hooks else {}
    if len(hooks) > 1:
        back["earlier_webhooks"] = [hook(r) for r in hooks[1:]]
    return sent, back
