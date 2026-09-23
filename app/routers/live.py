# main.py
import base64
import hashlib
import hmac
import json
from datetime import datetime
from typing import List, Optional

import requests
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter, Request, Query
from fastapi.responses import JSONResponse


import os

from sqlalchemy import desc, asc
from sqlalchemy.orm import Session

from crud.partnerQR import get_txn_by_client_txn_id, create_wallet_transaction, update_transaction_with_partner_response
from models.models import User, LiveWebhookPhonePeLog, WalletTransaction, MerchantSettings, india_tz, Wallet
from schemas.merchant import WalletTransactionListResponse, WalletTransactionOutApi, UpdateStatusRequest
from schemas.partnerQR import CreateOrderRequest
from utils.authenticate import user_required
from utils.database import get_db
import httpx
router = APIRouter()
key= "51a7e93c-d526-4c7e-8f19-0397d19531ed"
EKQR_URL = os.getenv("EKQR_URL", "https://api.ekqr.in/api/v2/create_order")
#API_KEY = os.getenv("EKQR_API_KEY", "51a7e93c-d526-4c7e-8f19-0397d19531ed")
API_KEY = os.getenv("EKQR_API_KEY", "16498153-c114-4650-a7a6-e4f5ce636766")
# If API requires some header or auth, set here (e.g., X-API-KEY)
EKQR_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}
PHONEPE_SECRET = os.getenv("PHONEPE_WEBHOOK_SECRET")  # set this if you want verification

@router.post("/create_order")
def create_order(payload: CreateOrderRequest, db: Session = Depends(get_db),
                 current_user = Depends(user_required)):
    # 1) Strong validation already done by Pydantic schema.
    # 2) Prevent duplicate client_txn_id

    existing = get_txn_by_client_txn_id(db, payload.order_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="client_txn_id already exists")

    # 3) Map to DB model and create initial transaction record
    # Choose a user_id to attach to (merchant). Here we pick the first merchant user or you can require merchant_id in payload
    merchant_user = db.query(User).filter(User.id==current_user.id, User.role == 2).first()
    if not merchant_user:
        # fallback: use a default system user id or error
        raise HTTPException(status_code=500, detail="No merchant user found in the system. Please configure a merchant user.")

    amount_float = float(payload.amount)
    wt, ti = create_wallet_transaction(
        db=db,
        user_id=current_user.id,
        amount=amount_float,
        client_txn_id=payload.order_id,
        customer={
            "name": payload.customer_name,
            "email": payload.customer_email,
            "mobile": payload.customer_mobile
        },
        p_info=payload.p_info
    )

    # 4) Call external API
    try:

        body = payload.dict()
        body["client_txn_id"] = body.pop("order_id")
        body["key"] = API_KEY
        # If backend expects amount as integer or string without decimals, you can transform here
        # Send request (synchronous)
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(EKQR_URL, json=body, headers=EKQR_HEADERS)
            resp.raise_for_status()
            partner_json = resp.json()
    except httpx.HTTPStatusError as ex:
        # update transaction as failed and return sensible message
        partner_json = {"status": False, "msg": f"Partner returned error: {ex.response.status_code}"}
        update_transaction_with_partner_response(db, wt, ti, partner_json, success=False)
        raise HTTPException(status_code=502, detail="Failed to create order at payment gateway")
    except Exception as ex:
        partner_json = {"status": False, "msg": f"Error calling partner: {str(ex)}"}
        update_transaction_with_partner_response(db, wt, ti, partner_json, success=False)
        raise HTTPException(status_code=502, detail="Error contacting payment gateway")

    # 5) Handle partner response
    success = bool(partner_json.get("status") is True)
    update_transaction_with_partner_response(db, wt, ti, partner_json, success=success)

    if success:
        # Return partner data to caller with our own order token/reference if needed
        return JSONResponse(status_code=200, content={
            "status": True,
            "msg": "Order Created",
            "data": {
                "client_txn_id": partner_json["data"].get("order_id"),
                "payment_url": partner_json["data"].get("payment_url"),
                #"upi_id_hash": partner_json["data"].get("upi_id_hash"),
                #"upi_intent": partner_json["data"].get("upi_intent"),
                "session_id": partner_json["data"].get("session_id"),
                #"is_utr_required": partner_json["data"].get("is_utr_required", False)
            }
        })
    else:
        raise HTTPException(status_code=400, detail=partner_json.get("msg", "Partner returned failure"))


def _get_remote_addr(request: Request) -> str:
    # trust X-Forwarded-For if present (nginx/proxy). Adjust according to your infra.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # take first IP in the list
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
def _round2(x: float) -> float:
    return float(f"{x:.2f}")
def verify_hmac_signature(secret: str, body: bytes, header_sig: str) -> bool:
    """
    Try to verify header_sig against HMAC-SHA256 of body using secret.
    Many providers provide either hex or base64 encoding, so we try both.
    """
    if not header_sig:
        return False

    # compute raw hex digest
    mac = hmac.new(secret.encode("utf-8"), body, digestmod=hashlib.sha256)
    hex_digest = mac.hexdigest()
    # compare hex (case-insensitive)
    try:
        if hmac.compare_digest(hex_digest.lower(), header_sig.lower()):
            return True
    except Exception:
        pass

    # try base64
    try:
        b64 = base64.b64encode(mac.digest()).decode()
        if hmac.compare_digest(b64, header_sig):
            return True
    except Exception:
        pass

    return False

# @router.post("/webhook", status_code=200)
# async def receive_phonepe_webhook(request: Request, db: Session = Depends(get_db)):
#     """
#     Primary endpoint to receive PhonePe webhook.
#     - Reads raw body bytes.
#     - Tries to parse JSON for storage.
#     - Optionally verifies HMAC if PHONEPE_WEBHOOK_SECRET is set and header X-PhonePe-Signature is present.
#     """
#     body_bytes = await request.body()
#     remote_ip = _get_remote_addr(request)
#     headers = {k: v for k, v in request.headers.items()}
#
#     # parse JSON if possible
#     parsed_json = None
#     parsed_error = None
#     if body_bytes:
#         try:
#             parsed_json = json.loads(body_bytes.decode("utf-8"))
#         except Exception as ex:
#             parsed_error = str(ex)
#
#     # verify signature if configured
#     header_sig = request.headers.get("x-phonepe-signature") or request.headers.get("x-phonepe-signature".lower()) or request.headers.get("X-PhonePe-Signature")
#     is_authorized = False
#     verification_reason = None
#
#     if PHONEPE_SECRET:
#         if header_sig:
#             try:
#                 is_authorized = verify_hmac_signature(PHONEPE_SECRET, body_bytes, header_sig)
#                 verification_reason = "signature matched" if is_authorized else "signature mismatch"
#             except Exception as ex:
#                 verification_reason = f"signature verification error: {ex}"
#                 is_authorized = False
#         else:
#             verification_reason = "no signature header present"
#             is_authorized = False
#     else:
#         # If you want to accept all webhooks when no secret is set, change the behavior here:
#         # is_authorized = True
#         verification_reason = "no webhook secret configured (PHONEPE_WEBHOOK_SECRET unset)"
#         is_authorized = False
#
#     status_str = "authorized" if is_authorized else "unauthorized"
#
#     # Save to DB
#     try:
#         log = LiveWebhookPhonePeLog(
#             received_data=parsed_json if parsed_json is not None else None,
#             headers=headers,
#             source_ip=remote_ip,
#             status=status_str,
#             reason=json.dumps({
#                 "verification": verification_reason,
#                 "parse_error": parsed_error
#             })
#         )
#         db.add(log)
#         db.commit()
#         db.refresh(log)
#     except Exception as ex:
#         # If DB write fails, still return 200 to the sender but log internally.
#         # You might want to raise alert/monitoring here.
#         # Return 500 if you prefer the webhook sender to retry.
#         return JSONResponse(status_code=500, content={
#             "status": False,
#             "msg": "failed to save webhook log",
#             "error": str(ex)
#         })
#
#     # Respond quickly. Some providers require an exact response body; PhonePe accepts 200 OK.
#     return {"status": True, "msg": "received", "log_id": log.id, "authorized": is_authorized}

@router.post("/webhook")
async def live_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        # ✅ Parse form-urlencoded data
        form_data = await request.form()
        payload = dict(form_data)  # application/x-www-form-urlencoded
        # ✅ Capture headers + IP
        headers = dict(request.headers)
        client_host = request.client.host if request.client else "unknown"

        # ✅ Save in DB
        log_entry = LiveWebhookPhonePeLog(
            received_data=payload,
            headers=headers,
            source_ip=client_host,
            status="authorized",
            reason=None,

        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        client_txn_id = payload.get("client_txn_id")
        status = (payload.get("status") or "").lower()
        upi_txn_id = payload.get("upi_txn_id")
        remark = payload.get("remark") or ""
        amount_str = payload.get("amount") or "0"
        try:
            amount = float(amount_str)
        except:
            amount = 0.0

        if not client_txn_id:
            raise HTTPException(status_code=400, detail="client_txn_id missing")
        tx: WalletTransaction | None = (
            db.query(WalletTransaction)
            .filter(WalletTransaction.order_id == client_txn_id)
            .first()
        )
        if not tx:
            # If you prefer to create one here, you can. Otherwise, fail.
            raise HTTPException(status_code=404, detail="Transaction not found for client_txn_id")

        # --- Optional: IP allow-list from MerchantSettings.ip ---
        settings: MerchantSettings | None = db.query(MerchantSettings).filter(
            MerchantSettings.id == tx.user_id
        ).first()
        wallet : Wallet | None = db.query(Wallet).filter(
            Wallet.user_id == tx.user_id
        ).first()
        already_success = (tx.status == "success")

        if status == "success" and not already_success:
            # charges % taken from settings.payInCharges; default 0 if no settings
            pay_in_pct = (settings.payInCharges if settings and settings.payInCharges is not None else 0.0)
            charges = _round2(amount * (pay_in_pct / 100.0))
            gst = _round2(charges * 0.18)  # 18% GST on charges
            settle_amount = _round2(amount - charges - gst)

            # If you want balance_amount = settle_amount for this single txn, set same
            balance_amount = settle_amount

            # Update transaction
            wallet.balance += settle_amount
            tx.status = "success"
            tx.amount = amount
            tx.charges = charges
            tx.gst = gst
            tx.settle_amount = settle_amount
            tx.balance_amount = balance_amount
            tx.txn_id = upi_txn_id
            #tx.updated_at = datetime.now(india_tz)

            db.add(tx)
            db.commit()
            db.refresh(tx)
        elif status != "success" and tx.status != "success":
            # Mark failure only if not already success
            tx.status = "failed"
            tx.amount = amount or tx.amount
            tx.remark = remark or tx.remark
            tx.updated_at = datetime.now(india_tz)
            db.add(tx)
            db.commit()
            db.refresh(tx)
        merchant_payload = {
            "order_id": tx.order_id,  # same as client_txn_id
            "status": tx.status,  # success/failure
            "amount": tx.amount,
            "charges": tx.charges,
            "gst": tx.gst,
            "settle_amount": tx.settle_amount,
            #"balance_amount": tx.balance_amount,
            "upi_txn_id": tx.txn_id,
        }

        # --- POST to merchant callback if configured ---

        if settings and settings.webhook:
            try:
                # You can send as JSON (recommended). If they need form-encoded, use data=merchant_payload
                r = requests.post(settings.webhook, json=merchant_payload, timeout=6)

            except Exception as e:
                merchant_cb_body = f"Error: {e}"

        return {"status": "ok", "message": "Webhook received", "log_id": log_entry.id, "data_dict":payload}

    except Exception as e:
        # In case of error
        log_entry = LiveWebhookPhonePeLog(
            received_data=None,
            headers=dict(request.headers),
            source_ip=request.client.host if request.client else "unknown",
            status="unauthorized",
            reason=str(e),

        )
        db.add(log_entry)
        db.commit()

        return {"status": "error", "message": str(e)}

@router.get("/webhook", response_model=List[dict])
def list_webhook_logs(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Paginated list of webhook logs (most recent first).
    Returns list of simple dicts (id, status, source_ip, created_at, snippet of received_data).
    """
    rows = db.query(LiveWebhookPhonePeLog).order_by(LiveWebhookPhonePeLog.id.desc()).offset(offset).limit(limit).all()
    result = []
    for r in rows:
        snippet = None
        try:
            if r.received_data:
                # make short preview
                snippet = r.received_data if isinstance(r.received_data, dict) else str(r.received_data)
                if isinstance(snippet, str) and len(snippet) > 200:
                    snippet = snippet[:200] + "..."
        except Exception:
            snippet = None
        result.append({
            "id": r.id,
            "status": r.status,
            "source_ip": r.source_ip,
            "created_at": (r.created_at.isoformat() if getattr(r, "created_at", None) else None),
            "received_preview": snippet
        })
    return result


@router.get("/get_webhook/{log_id}", response_model=dict)
def get_webhook_log(log_id: int, db: Session = Depends(get_db), current_user = Depends(user_required)):
    """
    Fetch one webhook log by ID.
    """
    row = db.query(LiveWebhookPhonePeLog).filter(LiveWebhookPhonePeLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Log not found")
    return {
        "id": row.id,
        "received_data": row.received_data,
        "headers": row.headers,
        "source_ip": row.source_ip,
        "status": row.status,
        "reason": row.reason,
        "created_at": row.created_at.isoformat() if row.created_at else None
    }



@router.get("/get-txn-report", response_model=WalletTransactionListResponse)
def list_wallet_transactions(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, description="Optional status filter"),
    sort_by: str = Query("created_at", description="Sort column", regex="^[a-zA-Z0-9_]+$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
current_user = Depends(user_required)
):
    """
    Paginated list of wallet transactions.
    Optional `status` query param filters by transaction.status.
    """
    q = db.query(WalletTransaction).filter(WalletTransaction.user_id==current_user.id)

    if status is not None:
        q = q.filter(WalletTransaction.status == status)

    # total count
    try:
        total = q.order_by(None).count()
    except Exception:
        total = 0

    # sorting (safe fallback to created_at)
    sort_col = getattr(WalletTransaction, sort_by, WalletTransaction.created_at)
    if sort_order == "desc":
        q = q.order_by(desc(sort_col))
    else:
        q = q.order_by(asc(sort_col))

    items = q.offset(offset).limit(limit).all()
    return WalletTransactionListResponse(total=total,items=items)


@router.get("/get-txn-report/status/{client_txn_id}", response_model=WalletTransactionOutApi)
def get_wallet_transaction(
    client_txn_id: str,
    db: Session = Depends(get_db),
current_user = Depends(user_required)
):
    """
    Fetch and return a single wallet transaction by its ID.
    Does NOT update anything.
    """
    tx = db.query(WalletTransaction).filter(WalletTransaction.user_id==current_user.id,WalletTransaction.order_id == client_txn_id).first()
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    return tx

