from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status,  Request
from sqlalchemy.orm import Session

from crud.gateway.gatepay import initiate_getepay_payin, normalize_getepay_webhook
from crud.gateway.live_payin import get_or_create_customer, create_payin_wallet_txn, create_provider_instrument
from crud.gateway.phonepe import initiate_phonepe_payin, normalize_phonepe_webhook
from crud.gateway.templamart import (
    initiate_templamart_payin, normalize_templamart_webhook,
    get_templamart_ticket_sizes, initiate_templamart_upi_intent,
)
from crud.gateway.gurutvapay import (
    initiate_gurutvapay_payin, normalize_gurutvapay_webhook,
    get_gurutvapay_ticket_sizes, initiate_gurutvapay_upi_intent,
)
from crud.webhook.handler import process_payin_webhook
from schemas.live_payin import PaymentRequest
from utils.database import get_db
from utils.authenticate import user_required
from utils.email_validation import enforce_customer_email
from models.models import User, ProviderCredential, WalletTransaction, TransactionTypeEnum, TransactionInstrument, \
    Wallet, india_tz

router = APIRouter(prefix="/live/payin", tags=["Live PayIn"])


@router.post("/webhook/templamart")
async def templamart_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Dedicated Templamart webhook endpoint."""
    payload = await request.json()
    normalized = normalize_templamart_webhook(payload)
    return process_payin_webhook(db, "templamart", payload, normalized)


@router.post("/webhook/gurutvapay")
async def gurutvapay_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Dedicated GurutvaPay webhook endpoint."""
    payload = await request.json()
    normalized = normalize_gurutvapay_webhook(payload)
    return process_payin_webhook(db, "gurutvapay", payload, normalized)


@router.get("/ticket-sizes")
def get_ticket_sizes(
    db: Session = Depends(get_db),
    current_user: User = Depends(user_required),
):
    """
    Fetch available ticket sizes for the merchant's active PayIn provider.
    Providers that don't use ticket sizes return ticket_size_required: false.
    """
    merchant_id = current_user.id

    credential = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == merchant_id,
            ProviderCredential.is_active_payIn == True
        )
        .first()
    )
    if not credential:
        raise HTTPException(400, "No active PayIn provider")

    provider_code = credential.provider.code.lower()

    context = {
        "db": db,
        "merchant_id": merchant_id,
        "client_id": credential.client_id,
        "secret_key": credential.secret_key,
    }

    try:
        match provider_code:
            case "templamart":
                return get_templamart_ticket_sizes(context)
            case "gurutvapay":
                return get_gurutvapay_ticket_sizes(context)
            case _:
                return {
                    "provider": provider_code,
                    "ticket_sizes": [],
                    "ticket_size_required": False,
                    "message": f"{provider_code} does not require ticket sizes — any amount accepted",
                }
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch ticket sizes: {str(e)}")


@router.post("/upi-intent")
def initiate_upi_intent(
    payload: PaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(user_required),
):
    """
    Initiate UPI Intent PayIn — returns intent_url and qr_data
    for direct UPI payment without redirect.
    """
    merchant_id = current_user.id

    if not current_user.kyc_verified:
        raise HTTPException(403, "KYC not completed")

    enforce_customer_email(db, merchant_id, payload.customer.email)

    credential = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == merchant_id,
            ProviderCredential.is_active_payIn == True
        )
        .first()
    )
    if not credential:
        raise HTTPException(400, "No active PayIn provider")

    provider_code = credential.provider.code.lower()

    try:
        from crud.gateway.live_payin import get_or_create_customer, create_payin_wallet_txn, create_provider_instrument

        customer = get_or_create_customer(db, payload.customer.dict())

        wallet_txn = create_payin_wallet_txn(
            db=db,
            merchant_id=merchant_id,
            customer_id=customer.id,
            amount=payload.amount,
            merchant_order_id=payload.merchantOrderId,
        )

        instrument = create_provider_instrument(
            db=db,
            wallet_txn_id=wallet_txn.id,
            provider_code=provider_code,
        )

        context = {
            "db": db,
            "wallet_txn_id": wallet_txn.id,
            "instrument_id": instrument.id,
            "merchant_id": merchant_id,
            "merchant_order_id": payload.merchantOrderId,
            "amount": payload.amount,
            "channel": payload.channel,
            "purpose": payload.purpose,
            "customer": payload.customer.dict(),
            "client_id": credential.client_id,
            "secret_key": credential.secret_key,
            "salt_key1": credential.salt_key1,
            "salt_key2": credential.salt_key2,
            "salt_key3": credential.salt_key3,
            "payin_mid": credential.payIn_mid,
        }

        match provider_code:
            case "templamart":
                provider_resp = initiate_templamart_upi_intent(context)
            case "gurutvapay":
                provider_resp = initiate_gurutvapay_upi_intent(context)
            case _:
                raise HTTPException(400, f"UPI Intent not supported for {provider_code}")

        instrument.provider_response = provider_resp
        db.commit()

        return {
            "success": True,
            "provider": provider_code,
            "merchantOrderId": payload.merchantOrderId,
            #"txn_id": wallet_txn.id,
            #"payment_url": provider_resp.get("payment_url"),
            "intent_url": provider_resp.get("intent_url"),
            #"qr_data": provider_resp.get("qr_data"),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"UPI Intent initiation failed: {str(e)}")


@router.post("/initiate-payment")
def initiate_gurutvapay_payment(
    payload: PaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(user_required),
):
    """
    Dedicated GurutvaPay initiate-payment endpoint.
    Bypasses TSP lookup — always uses GurutvaPay gateway.
    """
    merchant_id = current_user.id

    if not current_user.kyc_verified:
        raise HTTPException(403, "KYC not completed")

    enforce_customer_email(db, merchant_id, payload.customer.email)

    # IP whitelist check
    from models.models import MerchantSettings as MS
    ms = db.query(MS).filter(MS.id == merchant_id).first()
    if ms and ms.ip:
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
        allowed_ips = [ip.strip() for ip in ms.ip.split(",") if ip.strip()]
        if allowed_ips and client_ip not in allowed_ips:
            raise HTTPException(403, f"IP {client_ip} is not whitelisted")

    try:
        customer = get_or_create_customer(db, payload.customer.dict())

        wallet_txn = create_payin_wallet_txn(
            db=db,
            merchant_id=merchant_id,
            customer_id=customer.id,
            amount=payload.amount,
            merchant_order_id=payload.merchantOrderId,
        )

        instrument = create_provider_instrument(
            db=db,
            wallet_txn_id=wallet_txn.id,
            provider_code="gurutvapay",
        )

        context = {
            "db": db,
            "wallet_txn_id": wallet_txn.id,
            "instrument_id": instrument.id,
            "merchant_id": merchant_id,
            "merchant_order_id": payload.merchantOrderId,
            "amount": payload.amount,
            "channel": payload.channel,
            "purpose": payload.purpose,
            "customer": payload.customer.dict(),
        }

        provider_resp = initiate_gurutvapay_payin(context)

        instrument.provider_response = provider_resp
        db.commit()

        return {
            "success": True,
            "provider": "gurutvapay",
            "merchantOrderId": payload.merchantOrderId,
            "payment_url": provider_resp.get("payment_url"),
            "payment_token": provider_resp.get("payment_token"),
            "amount": provider_resp.get("amount"),
            "status": provider_resp.get("status"),
            "expires_in": provider_resp.get("expires_in"),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"GurutvaPay initiation failed: {str(e)}")


@router.post("/initiate")
def initiate_live_payin(
    payload: PaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(user_required),
):
    merchant_id = current_user.id

    # 1️⃣ KYC CHECK
    if not current_user.kyc_verified:
        raise HTTPException(403, "KYC not completed")

    enforce_customer_email(db, merchant_id, payload.customer.email)

    # 1a. IP WHITELIST CHECK
    from models.models import MerchantSettings as MS
    ms = db.query(MS).filter(MS.id == merchant_id).first()
    if ms and ms.ip:
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
        allowed_ips = [ip.strip() for ip in ms.ip.split(",") if ip.strip()]
        if allowed_ips and client_ip not in allowed_ips:
            raise HTTPException(403, f"IP {client_ip} is not whitelisted")

    # 2️⃣ FETCH ACTIVE PAYIN PROVIDER
    credential = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.merchant_id == merchant_id,
            ProviderCredential.is_active_payIn == True
        )
        .first()
    )
    if not credential:
        raise HTTPException(400, "No active PayIn provider")

    provider_code = credential.provider.code.lower()

    try:
        # --------------------------------------------------
        # 3️⃣ CUSTOMER UPSERT
        # --------------------------------------------------
        customer = get_or_create_customer(db, payload.customer.dict())

        # --------------------------------------------------
        # 4️⃣ CREATE WALLET TRANSACTION (PENDING)
        # --------------------------------------------------
        wallet_txn = create_payin_wallet_txn(
            db=db,
            merchant_id=merchant_id,
            customer_id=customer.id,
            amount=payload.amount,
            merchant_order_id=payload.merchantOrderId,
        )

        # --------------------------------------------------
        # 5️⃣ CREATE PROVIDER INSTRUMENT ENTRY
        # --------------------------------------------------
        instrument = create_provider_instrument(
            db=db,
            wallet_txn_id=wallet_txn.id,
            provider_code=provider_code,
        )

        # --------------------------------------------------
        # 6️⃣ BUILD PROVIDER CONTEXT
        # --------------------------------------------------
        context = {
            "db": db,
            "wallet_txn_id": wallet_txn.id,
            "instrument_id": instrument.id,
            "merchant_id": merchant_id,
            "merchant_order_id": payload.merchantOrderId,
            "amount": payload.amount,
            "channel": payload.channel,
            "purpose": payload.purpose,
            "customer": payload.customer.dict(),

            # credentials
            "client_id": credential.client_id,
            "secret_key": credential.secret_key,
            "salt_key1": credential.salt_key1,
            "salt_key2": credential.salt_key2,
            "salt_key3": credential.salt_key3,
            "payin_mid": credential.payIn_mid,
        }

        # --------------------------------------------------
        # 7️⃣ PROVIDER CASE MATCH
        # --------------------------------------------------
        match provider_code:
            case "phonepe":
                provider_resp = initiate_phonepe_payin(context)
            case "gatepay" | "getepay":
                provider_resp = initiate_getepay_payin(context)
            case "templamart":
                provider_resp = initiate_templamart_payin(context)
            case "gurutvapay":
                provider_resp = initiate_gurutvapay_payin(context)
            case _:
                raise HTTPException(400, "Unsupported provider")

        # --------------------------------------------------
        # 8️⃣ UPDATE INSTRUMENT LOG
        # --------------------------------------------------
        instrument.provider_response = provider_resp
        db.commit()

        return {
            "success": True,
            "provider": provider_code,
            "merchantOrderId": payload.merchantOrderId,
            #"txn_id": f"NEO900160{wallet_txn.id}",
            "payment_url": provider_resp.get("payment_url"),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"PayIn initiation failed: {str(e)}")


@router.get("/txns/status")
def check_payin_status(
    order_id: str = None,
    merchantOrderId: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(user_required),
):
    """
    Check PayIn transaction status by order_id or merchantOrderId.
    Returns current status from WalletTransaction.
    """
    lookup = order_id or merchantOrderId
    if not lookup:
        raise HTTPException(400, "order_id or merchantOrderId is required")

    from sqlalchemy import or_
    wt = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.user_id == current_user.id,
            WalletTransaction.transaction_type == TransactionTypeEnum.PayIn,
            or_(
                WalletTransaction.order_id == lookup,
                WalletTransaction.txn_id == lookup,
                WalletTransaction.reference_id == lookup,
            ),
        )
        .first()
    )

    if not wt:
        raise HTTPException(404, "Transaction not found")

    return {
        "success": True,
        "merchantOrderId": wt.order_id,
        "txn_id": wt.txn_id,
        "utr": wt.utr,
        "amount": wt.amount,
        "charges": wt.charges,
        "gst": wt.gst,
        "settle_amount": wt.settle_amount,
        "status": wt.status,
        "created_at": wt.created_at.isoformat() if wt.created_at else None,
    }
