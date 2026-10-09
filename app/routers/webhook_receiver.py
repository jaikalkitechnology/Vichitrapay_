"""
Vichitrapay's own webhook receiver.

POST /api/v1/webhook         — receives a payment result (no login: Vichitrapay posts without one),
                               saves it, replies 200. Set it as a merchant's Webhook URL.
GET  /api/v1/webhook         — admin: list every received webhook, success and failed, with totals.
GET  /api/v1/webhook/{id}    — admin: one webhook with its full payload and headers.
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import String, case, cast, func, or_
from sqlalchemy.orm import Session

from models.models import TransactionTypeEnum, WalletTransaction, WebhookReceipt
from utils.authenticate import admin_required
from utils.database import get_db

router = APIRouter(prefix="/api/v1/webhook", tags=["Vichitrapay Webhook Receiver"])

MAX_BODY_BYTES = 64 * 1024
KEEP_HEADERS = ("content-type", "user-agent", "x-forwarded-for", "x-real-ip")


def _num(v) -> Optional[float]:
    try:
        return float(v) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None


def _status_of(p: dict) -> Optional[str]:
    s = str(p.get("status") or "").lower()
    if s in ("success", "failed"):
        return s
    ev = str(p.get("event") or "").lower()
    if ev.endswith("completed") or ev.endswith("success"):
        return "success"
    if ev.endswith("failed"):
        return "failed"
    return s or None


@router.post("")
@router.post("/", include_in_schema=False)
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(413, "Webhook body too large (max 64 KB)")
    try:
        payload = json.loads(raw or b"{}")
    except ValueError:
        payload = {"raw": raw.decode("utf-8", "replace")}
    p = payload if isinstance(payload, dict) else {"value": payload}

    order_id = p.get("merchantOrderId") or p.get("order_id")
    merchant_id = None
    if order_id:
        wt = (db.query(WalletTransaction.user_id)
              .filter(WalletTransaction.order_id == str(order_id), WalletTransaction.transaction_type == TransactionTypeEnum.PayIn)
              .first())
        merchant_id = wt[0] if wt else None

    h = request.headers
    ip = h.get("x-forwarded-for", "").split(",")[0].strip() or h.get("x-real-ip") or (request.client.host if request.client else None)
    row = WebhookReceipt(
        merchant_id=merchant_id,
        order_id=str(order_id)[:255] if order_id else None,
        event=str(p.get("event"))[:64] if p.get("event") else None,
        status=_status_of(p),
        amount=_num(p.get("amount")),
        settle_amount=_num(p.get("settle_amount")),
        utr=str(p.get("utr"))[:100] if p.get("utr") else None,
        txn_id=str(p.get("txn_id"))[:255] if p.get("txn_id") else None,
        payload=payload,
        headers={k: v for k, v in h.items() if k.lower() in KEEP_HEADERS},
        source_ip=ip,
    )
    db.add(row)
    db.commit()
    return {"received": True, "id": row.id, "merchantOrderId": order_id}


def _day(v: Optional[str]) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.strptime(v[:10], "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, f"Invalid date {v!r}, use YYYY-MM-DD")


@router.get("", dependencies=[Depends(admin_required)])
def list_received(
    search: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    R = WebhookReceipt
    f = []
    start, end = _day(from_date), _day(to_date)
    if start:
        f.append(R.created_at >= start)
    if end:
        f.append(R.created_at < end + timedelta(days=1))
    if search:
        s = f"%{search.strip()}%"
        f.append(or_(cast(R.id, String).like(s), R.order_id.like(s), R.merchant_id.like(s), R.utr.like(s),
                     R.txn_id.like(s), R.source_ip.like(s), R.event.like(s)))
    base = db.query(R).filter(*f)

    ok, bad = R.status == "success", R.status == "failed"
    totals = base.with_entities(
        func.count(R.id),
        func.coalesce(func.sum(case((ok, 1), else_=0)), 0),
        func.coalesce(func.sum(case((bad, 1), else_=0)), 0),
        func.coalesce(func.sum(case((ok, R.amount), else_=0)), 0),
    ).one()

    q = base.filter(R.status == status) if status else base
    total = q.order_by(None).count()
    rows = q.order_by(R.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "summary": {"total": int(totals[0]), "success": int(totals[1]), "failed": int(totals[2]),
                    "success_amount": round(float(totals[3] or 0), 2)},
        "items": [
            {"id": r.id, "merchant_id": r.merchant_id, "order_id": r.order_id, "event": r.event, "status": r.status,
             "amount": r.amount, "settle_amount": r.settle_amount, "utr": r.utr, "source_ip": r.source_ip,
             "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in rows
        ],
        "total": int(total), "page": page, "per_page": per_page,
        "statuses": sorted({v for (v,) in db.query(R.status).filter(R.status.isnot(None)).distinct().all() if v}),
    }


@router.get("/{receipt_id}", dependencies=[Depends(admin_required)])
def get_received(receipt_id: int, db: Session = Depends(get_db)):
    r = db.query(WebhookReceipt).filter(WebhookReceipt.id == receipt_id).first()
    if not r:
        raise HTTPException(404, "Webhook not found")
    return {
        "id": r.id,
        "payload": r.payload,
        "merchant_id": r.merchant_id,
        "status": r.status,
        "headers": r.headers,
        "source_ip": r.source_ip,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
