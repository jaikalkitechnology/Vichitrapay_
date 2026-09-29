import uuid
from datetime import datetime

from sqlalchemy.orm import Session
from models.models import LiveCustomer, india_tz


def get_or_create_customer(db: Session, customer_data: dict) -> LiveCustomer:
    """
    Avoid duplicate customer by email + phone
    """
    customer = (
        db.query(LiveCustomer)
        .filter(
            LiveCustomer.email == customer_data["email"],
            LiveCustomer.phone == customer_data["phone"]
        )
        .first()
    )

    if customer:
        return customer

    customer = LiveCustomer(
        name=customer_data["buyer_name"],
        email=customer_data["email"],
        phone=customer_data["phone"],
        address1=customer_data.get("address1"),
        address2=customer_data.get("address2"),
    )
    db.add(customer)
    db.flush()  # get customer.id

    return customer


from sqlalchemy.orm import Session
from models.models import WalletTransaction, TransactionTypeEnum, credit_debitTypeEnum

def create_payin_wallet_txn(
    db: Session,
    merchant_id: str,
    customer_id: str,
    amount: float,
    merchant_order_id: str,
):
    txn = WalletTransaction(
        user_id=merchant_id,
        transaction_type=TransactionTypeEnum.PayIn,
        credit_debit=credit_debitTypeEnum.credit,
        order_id=merchant_order_id,
        status="pending",
        amount=amount,
        customer_id=customer_id,
        description="PayIn initiated",
    )
    db.add(txn)
    db.flush()  # get txn.id

    return txn


from sqlalchemy.orm import Session
from models.models import TransactionInstrument, InstrumentType

def create_provider_instrument(
    db: Session,
    wallet_txn_id: int,
    provider_code: str,
):
    """
    Create a mock provider instrument entry at initiation time.
    Real values will be updated after provider response / webhook.
    """

    mock_txn_id = f"{provider_code.upper()}_{uuid.uuid4().hex[:12]}"
    mock_order_token = uuid.uuid4().hex

    # Mock intent / redirect URL (frontend-safe)
    mock_intent_url = f"https://mock.{provider_code}.com/pay/{mock_txn_id}"

    inst = TransactionInstrument(
        wallet_transaction_id=wallet_txn_id,

        # ---- CORE ----
        instrument_type= 'UPI_INTENT',
        status="pending",
        txn_id=mock_txn_id,
        provider_order_token=mock_order_token,

        # ---- UPI MOCK ----
        upi_vpa=None,
        upi_number=None,
        intent_url=mock_intent_url,
        qr_data=None,

        # ---- REDIRECT ----
        has_redirect=True,
        redirect_url=mock_intent_url,

        # ---- TELEMETRY (optional mock) ----
        browser_fingerprint=None,
        user_agent=None,

        # ---- PROVIDER DEBUG ----
        provider_response={
            "provider": provider_code,
            "stage": "initiated",
            "mock": True,
            "created_at": datetime.now(india_tz).isoformat(),
        },
        meta={
            "source": "payin_initiate",
            "provider": provider_code,
            "note": "Mock instrument created before provider response"
        },
    )

    db.add(inst)
    db.flush()  # ensures inst.id is available

    return inst



from typing import Optional
from models.models import MerchantTspSetting, ProviderCredential, TspDirectionEnum, TspProvider, TspStatusEnum


def get_active_payin_credential(db: Session, merchant_id: str) -> Optional[ProviderCredential]:
    """
    The provider credential a merchant's PayIn goes through.

    1. The merchant's enabled Pay-in mappings (admin → TSP Mappings, "Pay-in" switch), default
       route first (lowest priority), provider active — the first one that has credentials.
    2. Otherwise a credential with "Service enabled" (is_active_payIn) switched on, as before.
    """
    mapped = (
        db.query(ProviderCredential)
        .join(
            MerchantTspSetting,
            (MerchantTspSetting.merchant_id == ProviderCredential.merchant_id)
            & (MerchantTspSetting.provider_id == ProviderCredential.provider_id),
        )
        .join(TspProvider, TspProvider.id == ProviderCredential.provider_id)
        .filter(
            ProviderCredential.merchant_id == merchant_id,
            MerchantTspSetting.enabled == True,  # noqa: E712
            MerchantTspSetting.direction.in_([TspDirectionEnum.PAYIN, TspDirectionEnum.BOTH]),
            TspProvider.status == TspStatusEnum.active,
        )
        .order_by(MerchantTspSetting.priority.asc(), MerchantTspSetting.id.asc())
        .first()
    )
    if mapped:
        return mapped
    return (
        db.query(ProviderCredential)
        .filter(ProviderCredential.merchant_id == merchant_id, ProviderCredential.is_active_payIn == True)  # noqa: E712
        .first()
    )


def record_request_origin(instrument: TransactionInstrument, request) -> None:
    """Save who called the PayIn API (client IP, calling domain, user agent) on the instrument,
    for the admin System Logs → Payment Instrument Logs page."""
    if request is None:
        return
    h = request.headers
    ip = (h.get("x-forwarded-for", "").split(",")[0].strip() or h.get("x-real-ip")
          or (request.client.host if request.client else None))
    origin = h.get("origin") or h.get("referer") or ""
    domain = None
    if origin.startswith("http"):
        parts = origin.split("/")
        domain = f"{parts[0]}//{parts[2]}" if len(parts) > 2 else origin
    instrument.meta = {**(instrument.meta or {}), "client_ip": ip, "domain": domain}
    instrument.user_agent = h.get("user-agent")
