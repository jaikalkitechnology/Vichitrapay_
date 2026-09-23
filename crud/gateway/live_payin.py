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

