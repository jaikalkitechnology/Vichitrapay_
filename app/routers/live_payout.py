import logging
import time

import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from decimal import Decimal

from crud.gateway.live_payout import calculate_payout_charges
from crud.gateway.torus import initiate_torus_payout
from crud.gateway.universepay import initiate_universepay_payout
from crud.gateway.zeepay import (
    initiate_zeepay_payout, normalize_zeepay_webhook, check_zeepay_txn_status,
)
from crud.gateway.grv_payout import (
    initiate_grv_payout, check_grv_payout_status, get_grv_payout_balance,
)
from crud.gateway.mizorpay import (
    initiate_mizorpay_payout, check_mizorpay_status,
    get_mizorpay_balance, normalize_mizorpay_webhook,
)
from schemas.live_payout import PayoutRequest
from utils.database import get_db
from utils.authenticate import user_required
from models.models import (
    WalletTransaction,
    TransactionInstrument,
    PayOutWallet,
    MerchantSettings,
    TransactionTypeEnum,
    credit_debitTypeEnum,
    InstrumentType,
    ProviderCredential,
    WebhookLog,
    WebhookDeliveryLog,
    india_tz,
)
from datetime import datetime

log = logging.getLogger(__name__)
MERCHANT_WEBHOOK_TIMEOUT = 10


router = APIRouter(prefix="/live/payout", tags=["Live Payout"])


def _forward_payout_to_merchant(db: Session, wt: WalletTransaction):
    """Forward payout result to merchant's webhook_payout URL."""
    settings = (
        db.query(MerchantSettings)
        .filter(MerchantSettings.id == wt.user_id)
        .first()
    )
    webhook_url = settings.webhook_payout if settings else None
    if not webhook_url:
        return

    merchant_payload = {
        "event": "payout.completed" if wt.status == "success" else "payout.failed",
        "order_id": wt.order_id,
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

    for attempt in range(1, 4):
        if attempt > 1:
            time.sleep(attempt)
        try:
            resp = http_requests.post(
                webhook_url,
                json=merchant_payload,
                headers={"Content-Type": "application/json"},
                timeout=MERCHANT_WEBHOOK_TIMEOUT,
            )
            if resp.status_code < 400:
                log.info("Payout webhook delivered for %s → %s (attempt %d)",
                         wt.order_id, webhook_url, attempt)
                return
            log.warning("Payout webhook failed for %s → %s (HTTP %d, attempt %d)",
                        wt.order_id, webhook_url, resp.status_code, attempt)
        except Exception as exc:
            log.warning("Payout webhook error for %s → %s (attempt %d): %s",
                        wt.order_id, webhook_url, attempt, exc)


@router.post("/webhook/mizorpay")
async def mizorpay_payout_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    MizorPay payout callback.
    Payload: { "payout": { "status", "txn_id", "utr", "amount", "refunded" } }
    """
    payload = await request.json()
    normalized = normalize_mizorpay_webhook(payload)

    order_id = normalized.get("order_id")
    new_status = normalized.get("status")

    from sqlalchemy import or_
    wt = db.query(WalletTransaction).filter(
        WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
        or_(
            WalletTransaction.order_id == order_id,
            WalletTransaction.txn_id == order_id,
            WalletTransaction.reference_id == order_id,
        ),
    ).first()

    if not wt:
        return {"success": False, "message": "Transaction not found"}

    if wt.status == "success":
        return {"success": True, "message": "Already processed"}

    inst = db.query(TransactionInstrument).filter(
        TransactionInstrument.wallet_transaction_id == wt.id
    ).first()

    if new_status == "success":
        wt.status = "success"
        wt.utr = normalized.get("utr")
        if inst:
            inst.status = "success"
            inst.provider_response = payload

    elif new_status == "failed":
        wallet = db.query(PayOutWallet).filter(
            PayOutWallet.user_id == wt.user_id
        ).with_for_update().first()
        if wallet:
            wallet.balance += float(wt.settle_amount or wt.amount)
        wt.status = "failed"
        if inst:
            inst.status = "failed"
            inst.provider_response = payload

    db.flush()
    _forward_payout_to_merchant(db, wt)
    db.commit()

    return {"success": True}


@router.post("/webhook/grv")
async def grv_payout_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    GurutvaPay payout webhook callback.
    Payload: { event_name, txn_id, grp_id, merchantOrderId, status, amount, charge, gst, description }
    """
    payload = await request.json()

    merchant_order_id = payload.get("merchantOrderId")
    raw_status = str(payload.get("status", "")).lower()

    if raw_status in ("success", "completed"):
        new_status = "success"
    elif raw_status in ("failed", "failure", "reversed"):
        new_status = "failed"
    else:
        new_status = "pending"

    from sqlalchemy import or_
    wt = db.query(WalletTransaction).filter(
        WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
        or_(
            WalletTransaction.order_id == merchant_order_id,
            WalletTransaction.reference_id == merchant_order_id,
            WalletTransaction.txn_id == payload.get("txn_id"),
        ),
    ).first()

    if not wt:
        return {"success": False, "message": "Transaction not found"}

    if wt.status == "success":
        return {"success": True, "message": "Already processed"}

    inst = db.query(TransactionInstrument).filter(
        TransactionInstrument.wallet_transaction_id == wt.id
    ).first()

    if new_status == "success":
        wt.status = "success"
        wt.utr = payload.get("utr")
        wt.txn_id = payload.get("txn_id") or wt.txn_id
        if inst:
            inst.status = "success"
            inst.provider_response = payload

    elif new_status == "failed":
        wallet = db.query(PayOutWallet).filter(
            PayOutWallet.user_id == wt.user_id
        ).with_for_update().first()

        if wallet:
            wallet.balance += float(wt.settle_amount or wt.amount)

        wt.status = "failed"
        wt.description = payload.get("description") or wt.description
        if inst:
            inst.status = "failed"
            inst.provider_response = payload

    db.flush()
    _forward_payout_to_merchant(db, wt)
    db.commit()

    return {"success": True}


@router.get("/webhook/zeepay")
async def zeepay_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Zeepay callback — GET with query params:
    ?txnid=X&requestid=Y&servicetxnid={UTR}&status=Z&desc=D
    """
    params = dict(request.query_params)
    normalized = normalize_zeepay_webhook(params)

    request_id = normalized.get("order_id")        # this is the NEO_xxx requestid
    zeepay_txnid = normalized.get("provider_txn_id")  # W260629... txnid
    new_status = normalized.get("status")

    # Search by reference_id (requestid) first, then by txn_id (zeepay txnid)
    from sqlalchemy import or_
    wt = db.query(WalletTransaction).filter(
        WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
        or_(
            WalletTransaction.reference_id == request_id,
            WalletTransaction.txn_id == zeepay_txnid,
        ),
    ).first()

    if not wt:
        return {"success": False, "message": "Transaction not found"}

    if wt.status == "success":
        return {"success": True, "message": "Already processed"}

    inst = db.query(TransactionInstrument).filter(
        TransactionInstrument.wallet_transaction_id == wt.id
    ).first()

    if new_status == "success":
        wt.status = "success"
        wt.utr = normalized.get("utr")
        wt.txn_id = normalized.get("provider_txn_id")
        if inst:
            inst.status = "success"
            inst.txn_id = normalized.get("provider_txn_id")
            inst.provider_response = params

    elif new_status == "failed":
        wallet = db.query(PayOutWallet).filter(
            PayOutWallet.user_id == wt.user_id
        ).with_for_update().first()

        if wallet:
            wallet.balance += float(wt.settle_amount or wt.amount)

        wt.status = "failed"
        wt.description = normalized.get("description") or "Payout failed"
        if inst:
            inst.status = "failed"
            inst.provider_response = params

    db.flush()

    # Forward to merchant webhook_payout
    _forward_payout_to_merchant(db, wt)

    db.commit()
    return {"success": True}



@router.post("/initiate")
def initiate_payout(
    payload: PayoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    merchant_id = current_user.id
    amount = Decimal(payload.amount)

    # --------------------------------------------------
    # 1️⃣ FETCH SETTINGS
    # --------------------------------------------------
    settings = db.query(MerchantSettings).filter(
        MerchantSettings.id == merchant_id
    ).first()

    if not settings:
        raise HTTPException(400, "Merchant settings not configured")

    # --------------------------------------------------
    # 1a. IP WHITELIST CHECK
    # --------------------------------------------------
    if settings.ip:
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
        allowed_ips = [ip.strip() for ip in settings.ip.split(",") if ip.strip()]
        if allowed_ips and client_ip not in allowed_ips:
            raise HTTPException(403, f"IP {client_ip} is not whitelisted")

    # --------------------------------------------------
    # 2️⃣ CALCULATE CHARGES
    # --------------------------------------------------
    charges, gst, total_debit = calculate_payout_charges(amount, settings)

    # --------------------------------------------------
    # 3️⃣ LOCK PAYOUT WALLET & CHECK BALANCE
    # --------------------------------------------------
    wallet = (
        db.query(PayOutWallet)
        .filter(PayOutWallet.user_id == merchant_id)
        .with_for_update()
        .first()
    )

    if not wallet or Decimal(str(wallet.balance)) < total_debit:
        raise HTTPException(400, "Insufficient payout wallet balance")

    # --------------------------------------------------
    # 4️⃣ DEBIT WALLET (PENDING)
    # --------------------------------------------------
    wallet.balance = float(Decimal(str(wallet.balance)) - total_debit)

    # --------------------------------------------------
    # 5️⃣ CREATE WALLET TRANSACTION
    # --------------------------------------------------
    desc = (
        f"BANK PAYOUT | A/C:{payload.accountno} | IFSC:{payload.ifsc} | "
        f"NAME:{payload.name} | MODE:{payload.paymode.value}"
    )

    wt = WalletTransaction(
        user_id=merchant_id,
        transaction_type=TransactionTypeEnum.PayOut,
        credit_debit=credit_debitTypeEnum.debit,
        order_id=payload.order_id,
        amount=float(amount),
        charges=float(charges),
        gst=float(gst),
        settle_amount=float(total_debit),
        balance_amount=wallet.balance,
        status="pending",
        description=desc,
    )
    db.add(wt)
    db.flush()

    # --------------------------------------------------
    # 6️⃣ CREATE INSTRUMENT
    # --------------------------------------------------
    inst = TransactionInstrument(
        wallet_transaction_id=wt.id,
        instrument_type=InstrumentType.BANK,
        status="pending",
    )
    db.add(inst)
    db.flush()

    # --------------------------------------------------
    # 7️⃣ PROVIDER CASE MATCH
    # --------------------------------------------------
    ctx = payload.dict()
    ctx.update({
        "wallet_txn_id": wt.id,
        "amount": payload.amount,
    })

    # Resolve provider from active PayOut credential
    credential = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == merchant_id,
            ProviderCredential.is_active_payOut == True,
        )
        .first()
    )
    provider = credential.provider.code.lower() if credential else "universepay"

    ctx["user_id"] = merchant_id

    match provider:
        case "universepay":
            resp = initiate_universepay_payout(ctx)
        case "torus":
            resp = initiate_torus_payout(ctx)
        case "zeepay" | "zeepays":
            resp = initiate_zeepay_payout(ctx, db=db)
        case "grv_payout" | "gurutvapay_payout":
            resp = initiate_grv_payout(ctx, db=db)
        case "mizorpay":
            resp = initiate_mizorpay_payout(ctx, db=db)
        case _:
            raise HTTPException(400, f"Unsupported payout provider: {provider}")

    # Check if provider returned an error
    if resp.get("error") or resp.get("status") == "FAILED":
        # refund wallet since we already debited
        wallet.balance = float(Decimal(str(wallet.balance)) + total_debit)
        wt.status = "failed"
        wt.description = resp.get("error") or "Provider rejected the payout"
        inst.provider_response = resp
        db.commit()
        raise HTTPException(400, resp.get("error") or "Payout rejected by provider")

    inst.txn_id = resp.get("provider_txn_id")
    inst.provider_response = resp
    wt.txn_id = resp.get("provider_txn_id")
    wt.reference_id = resp.get("request_id")
    if resp.get("utr"):
        wt.utr = resp["utr"]

    db.commit()

    return {
        "success": True,
        "order_id": payload.order_id,
        "debit_amount": str(total_debit),
        "provider": provider,
        "status": "pending",
    }


@router.post("/txns/status")
def check_payout_status(
    order_id: str = Query(..., description="Order ID, txn ID, or merchantOrderId"),
    db: Session = Depends(get_db),
    current_user=Depends(user_required),
):
    """
    Unified payout status check — auto-detects provider from the
    WalletTransaction and queries the correct upstream API.
    """
    from sqlalchemy import or_

    # Find the transaction
    wt = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
            WalletTransaction.user_id == current_user.id,
            or_(
                WalletTransaction.order_id == order_id,
                WalletTransaction.reference_id == order_id,
                WalletTransaction.txn_id == order_id,
            ),
        )
        .first()
    )

    if not wt:
        raise HTTPException(404, "Payout transaction not found")

    if wt.status in ("success", "failed"):
        return {
            "provider": "local",
            "txn_id": wt.txn_id,
            "order_id": wt.order_id,
            "utr": wt.utr,
            "status": wt.status.upper(),
            "amount": wt.amount,
            "message": f"Already {wt.status}",
        }

    # Resolve provider from credential
    credential = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == current_user.id,
            ProviderCredential.is_active_payOut == True,
        )
        .first()
    )
    provider = credential.provider.code.lower() if credential else ""

    # Query upstream
    result = None
    if provider in ("zeepay", "zeepays") and wt.txn_id:
        result = check_zeepay_txn_status(wt.txn_id, db=db, user_id=current_user.id)
    elif provider in ("grv_payout", "gurutvapay_payout"):
        lookup_id = wt.order_id or wt.reference_id or wt.txn_id
        result = check_grv_payout_status(lookup_id, db=db)
    elif provider == "mizorpay":
        lookup_id = wt.order_id or wt.txn_id
        result = check_mizorpay_status(lookup_id, db=db)
    else:
        raise HTTPException(400, f"Status check not supported for provider: {provider}")

    # Auto-update transaction
    upstream_status = result.get("status", "").upper()
    if upstream_status in ("SUCCESS", "COMPLETED"):
        wt.status = "success"
        wt.utr = result.get("utr") or wt.utr
        db.commit()
    elif upstream_status in ("FAILED", "FAILURE", "REVERSED"):
        wt.status = "failed"
        wallet = (
            db.query(PayOutWallet)
            .filter(PayOutWallet.user_id == wt.user_id)
            .with_for_update()
            .first()
        )
        if wallet:
            wallet.balance += float(wt.settle_amount or wt.amount)
        db.commit()

    return result


@router.get("/balance/grv")
def grv_balance(
    db: Session = Depends(get_db),
    current_user=Depends(user_required),
):
    """Get GurutvaPay payout wallet balance."""
    return get_grv_payout_balance(db=db)


@router.get("/balance/mizorpay")
def mizorpay_balance(
    db: Session = Depends(get_db),
    current_user=Depends(user_required),
):
    """Get MizorPay payout wallet balance."""
    return get_mizorpay_balance(db=db)
