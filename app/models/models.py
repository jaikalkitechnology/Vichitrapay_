import random
import string
import uuid
from uuid import uuid4
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, Boolean, DateTime, Enum, Text, column, Date, JSON, BigInteger,
    UniqueConstraint
)

from sqlalchemy.orm import relationship, declarative_base, backref
from datetime import datetime, timezone
import pytz
import enum
# Set India time zone (IST)
india_tz = pytz.timezone('Asia/Kolkata')

Base = declarative_base()
user_token = str(uuid4())
ROLE_MAPPING = {
    'partner': 1,
    'admin': 3,
    'merchant': 2,
    "customer":4,
    "webhook":5
}
def generate_user_id(role):
    prefix = {
        1: 'PART',  # partner
        2: 'MER',   # merchant
        3: 'ADM',    # admin
        4: 'CUST',
        5: 'WHK'
    }[role]
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

def generate_cust_id():
    prefix = "cust"
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

# ✅ 1. User Table
class User(Base):
    __tablename__ = 'users'

    id = Column(String(20), primary_key=True, default=lambda: generate_user_id(ROLE_MAPPING['merchant']))
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)  # Hashed password
    view_password = Column(String(255), nullable=True)  # Plain text for admin view
    role = Column(Integer, nullable=False, default=ROLE_MAPPING['merchant'])  # Default to 'user'
    full_name = Column(String(150))
    company_name  = Column(String(250), nullable=True)
    phone_number = Column(String(15))
    user_token = Column(String(255), nullable=False, default=user_token)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    kyc_verified = Column(Boolean, default=False)
    wallet = relationship('Wallet', uselist=False, back_populates='user', cascade='all, delete')
    payout_wallet = relationship('PayOutWallet', uselist=False, back_populates='user', cascade='all, delete')
    wallet_transactions = relationship('WalletTransaction', back_populates='user', cascade='all, delete')
    payout_bank_accounts=relationship("PayoutBankAccount", back_populates="user", cascade="all, delete-orphan")
    txn_settled= relationship('TransactionSettled', back_populates='user', cascade='all, delete')
    settings = relationship('MerchantSettings', uselist=False, back_populates='user', cascade='all, delete')
    payout_topups = relationship(
        "PayoutTopUp",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="PayoutTopUp.user_id",  # <--- tell SQLAlchemy which FK to use
        passive_deletes=True,
        lazy="selectin",
    )

# ✅ 4. Wallet Table

class Wallet(Base):
    __tablename__ = 'wallet'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(20), ForeignKey('users.id', ondelete='CASCADE'), unique=True)
    balance = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=lambda: datetime.now(india_tz))

    # Relationship
    user = relationship('User', back_populates='wallet')
    #wallet_transactions = relationship('WalletTransaction', back_populates='wallet', cascade='all, delete')

# ✅ 5. Wallet Table
class PayOutWallet(Base):
    __tablename__ = 'payout_wallet'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(20), ForeignKey('users.id', ondelete='CASCADE'), unique=True)
    balance = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=lambda: datetime.now(india_tz))

    # Relationship
    user = relationship('User', back_populates='payout_wallet')
    #wallet_transactions = relationship('WalletTransaction', back_populates='payout_wallet', cascade='all, delete')




class LiveCustomer(Base):
    __tablename__ = "live_customers"

    id = Column(String(100), primary_key=True,  default=lambda: generate_user_id(ROLE_MAPPING['customer']))  # Integer PKs typically autoincrement
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    address1 = Column(String(255), nullable=True)
    address2 = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    wallet_transactions = relationship(
        "WalletTransaction",
        back_populates="live_customer"
    )


class TransactionTypeEnum(str, enum.Enum):
    PayIn = "PayIn"
    PayOut = "PayOut"
    Settled="Settled"
    PayInUAT = "PayInUAT"
    PayOutUAT = "PayOutUAT"
    validation_api = "Validation_api"
    UatRefund="UatRefund"
    LiveRefund = "LiveRefund"
# ✅ 5. Wallet Transaction Table

class credit_debitTypeEnum(str, enum.Enum):
    credit = "credit"
    debit = "debit"


class InstrumentType(str, enum.Enum):
    UPI_QR = "UPI_QR"
    UPI_COLLECT_VPA = "UPI_COLLECT_VPA"
    UPI_COLLECT_NUMBER = "UPI_COLLECT_NUMBER"
    UPI_INTENT = "UPI_INTENT"
    NET_BANKING = "NET_BANKING"
    CARD = "CARD"
    WALLET = "WALLET"
    BANK = "BANK"
# ✅ 5. Wallet Transaction Table
class WalletTransaction(Base):
    __tablename__ = 'wallet_transactions'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(20), ForeignKey('users.id', ondelete='CASCADE'))
    transaction_type = Column(Enum(TransactionTypeEnum), nullable=False)
    credit_debit = Column(Enum(credit_debitTypeEnum), nullable=False)  # 1 = credit, 2 = debit
    order_id = Column(String(255))
    order_token = Column(String(255))
    payIn_mode = Column(Text)
    status = Column(String(15), default="pending") # 1 = success, 2 = pending, 3 = failed
    #customer_id = Column(String(100), ForeignKey("customers.id"), nullable=True)
    customer_id = Column(String(100), ForeignKey("live_customers.id"), nullable=True)
    amount = Column(Float, nullable=False)
    settle_amount = Column(Float, default=0.0)
    balance_amount = Column(Float, default=0.0)
    charges = Column(Float, default=0.0)
    gst = Column(Float, default=0.0)
    reference_id = Column(Text,nullable=True)  # Order ID or payout reference
    txn_id = Column(String(100),nullable=True)
    utr = Column(String(100), nullable=True)
    description = Column(Text,nullable=True)
    instrument_mode = Column(String(255), nullable=True)
    api_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    refund_id = Column(String(255), nullable=True)
    # Relationship
    user = relationship('User', back_populates='wallet_transactions')
    live_customer = relationship(
        "LiveCustomer",
        back_populates="wallet_transactions"
    )

    instruments = relationship(
        "TransactionInstrument",
        back_populates="transaction",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )



class TransactionInstrument(Base):
    __tablename__ = "transaction_instruments"

    id = Column(Integer, primary_key=True, index=True)

    # Parent link
    wallet_transaction_id = Column(
        Integer,
        ForeignKey("wallet_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Core instrument fields
    instrument_type = Column(Enum(InstrumentType), nullable=False)   # UPI_QR, NET_BANKING, etc.
    txn_id = Column(String(255), nullable=True)                      # your internal txn id (or PG reference)
    provider_order_token = Column(String(255), nullable=True)        # e.g., PhonePe orderId/orderToken
    status = Column(String(20), default="pending", nullable=False)   # pending/success/failed

    # Optional fields per instrument
    # UPI
    upi_vpa = Column(String(255), nullable=True)
    upi_number = Column(String(30), nullable=True)
    intent_url = Column(Text, nullable=True)                         # UPI Intent deeplink
    qr_data = Column(Text, nullable=True)                            # base64 or URL (if you store it)

    # NetBanking / Card
    bank_id = Column(String(50), nullable=True)                      # e.g., "HDFC"
    card_network = Column(String(30), nullable=True)                 # e.g., "VISA", "MASTERCARD"

    # Redirects
    has_redirect = Column(Boolean, default=False, nullable=False)
    redirect_url = Column(Text, nullable=True)

    # Telemetry (from browser)
    browser_fingerprint = Column(String(32), nullable=True, index=True)  # 32-hex
    user_agent = Column(Text, nullable=True)

    # Free-form provider payload for audits/debug
    provider_response = Column(JSON, nullable=True)                  # store last init response if needed
    meta = Column(JSON, nullable=True)                               # anything else (key/values)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship back to parent
    transaction = relationship("WalletTransaction", back_populates="instruments")

class PayoutBankAccount(Base):
    __tablename__ = 'payout_bank_accounts'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"))

    account_holder_name = Column(String(100), nullable=False)
    account_number = Column(String(30), nullable=False)
    ifsc_code = Column(String(20), nullable=False)
    bank_name = Column(String(100), nullable=True)
    bank_branch = Column(String(100), nullable=True)
    account_type = Column(String(20), nullable=True)
    bank_address = Column(String(255), nullable=True)
    is_validate = Column(Boolean, default=False)

    user = relationship("User", back_populates="payout_bank_accounts")

class TransactionSettled(Base):
    __tablename__ = 'transactions_settled'

    id = Column(Integer, primary_key=True, index=True)
    txn_id = Column(String(250), unique=True, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String(250), default="success")
    txn_type=Column(String(250), default="debit")
    settled_date = Column(DateTime, nullable=True)
    created_date = Column(DateTime, default=lambda: datetime.now(india_tz))

    user_id = Column(String(20), ForeignKey("users.id",  ondelete="CASCADE"))
    user = relationship("User", back_populates="txn_settled")


class MerchantSettings(Base):
    __tablename__ = "merchants_settings"
    id = Column(String(20), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, unique=True)
    payInCharges=Column(Float, nullable=False)
    payOutCharges = Column(Float, nullable=False)
    payOutChargesFlat = Column(Float, nullable=False)
    webhook =  Column(String(250))
    webhook_payout = Column(String(250))
    ip = Column(String(250))
    user = relationship('User', back_populates='settings')


class LiveWebhookPhonePeLog(Base):
    __tablename__ = "live_webhook_Phonepe_logs"

    id = Column(Integer, primary_key=True, index=True)
    received_data = Column(JSON, nullable=True)
    headers = Column(JSON, nullable=True)
    source_ip = Column(String(50))
    status = Column(String(20))   # "authorized" / "unauthorized"
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))



from sqlalchemy import Enum as SAEnum
import enum

class TopUpStatusEnum(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    failed = "failed"
    cancelled = "cancelled"

class TopUpInstrumentEnum(str, enum.Enum):
    bank = "bank"
    upi = "upi"
    netbanking = "netbanking"
    card = "card"
    other = "other"

class PayoutTopUp(Base):
    __tablename__ = "payout_topups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Merchant-provided details (payer)
    payer_name = Column(String(200), nullable=True)            # optional
    payer_account_number = Column(String(50), nullable=True)   # the number they say they transferred from
    payer_vpa_or_number = Column(String(50), nullable=True)    # for UPI number/VPA field if needed
    payer_bank_name = Column(String(100), nullable=True)

    # System/displayed beneficiary (the account number you showed on UI)
    beneficiary_account_number = Column(String(50), nullable=True)
    beneficiary_ifsc = Column(String(20), nullable=True)
    beneficiary_bank_name = Column(String(100), nullable=True)

    # Transfer details
    amount = Column(Float, nullable=False)
    instrument = Column(SAEnum(TopUpInstrumentEnum), default=TopUpInstrumentEnum.bank, nullable=False)
    utr_or_txn_id = Column(String(200), nullable=True, index=True)  # UTR / bank txn id / PG txn id
    reference_note = Column(String(255), nullable=True)             # optional remark / note user gave

    # Receipt / proof
    receipt_url = Column(Text, nullable=True)   # store file path or object-store URL
    receipt_mime = Column(String(50), nullable=True)

    # status & audit
    status = Column(SAEnum(TopUpStatusEnum), default=TopUpStatusEnum.pending, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    updated_at = Column(DateTime, default=lambda: datetime.now(india_tz), onupdate=lambda: datetime.now(india_tz))
    verified_by = Column(String(20), ForeignKey("users.id"), nullable=True)  # admin who verified
    verified_at = Column(DateTime, nullable=True)
    admin_notes = Column(Text, nullable=True)

    # relations
    #user = relationship("User", backref=backref("payout_topups", cascade="all, delete-orphan"))
    user = relationship(
        "User",
        back_populates="payout_topups",
        foreign_keys=[user_id],  # <--- explicit here too (helps readability)
        lazy="joined",
    )

    # separate relationship for the admin who verified the topup
    verified_by_user = relationship(
        "User",
        foreign_keys=[verified_by],
        lazy="joined",
        uselist=False,
    )
class DisplayAccount(Base):
    __tablename__ = "display_account"

    id = Column(Integer, primary_key=True, index=True)
    account_holder_name = Column(String(100), nullable=True)
    beneficiary_account_number = Column(String(50), nullable=True)
    beneficiary_ifsc = Column(String(20), nullable=True)
    beneficiary_bank_name = Column(String(100), nullable=True)
    # status & audit
    is_validate = Column(Boolean, default=False)


class PayOutLog(Base):
    __tablename__ = "pay_out_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(String(255), nullable=True, index=True)

    # store request & response as JSON string (Text)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)

    status = Column(String(32), default="pending")  # pending / success / failed / error
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # relationship back to user if you want ORM traversal
    user = relationship("User", backref="payout_logs")


class TemplamartApiLog(Base):
    __tablename__ = "templamart_api_logs"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    order_id = Column(String(255), nullable=True, index=True)
    endpoint = Column(String(255), nullable=True)          # login / ticket-sizes / create-payment
    request_payload = Column(JSON, nullable=True)
    response_payload = Column(JSON, nullable=True)
    http_status = Column(Integer, nullable=True)
    status = Column(String(32), default="pending")          # success / failed / error
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))


class WebhookLog(Base):
    """Logs every inbound provider webhook."""
    __tablename__ = "webhook_logs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(60), nullable=False, index=True)       # templamart / phonepe / getepay
    merchant_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id = Column(String(255), nullable=True, index=True)       # merchantOrderId
    wallet_txn_id = Column(Integer, nullable=True, index=True)

    # inbound from provider
    received_payload = Column(JSON, nullable=True)
    normalized_payload = Column(JSON, nullable=True)
    provider_status = Column(String(32), nullable=True)             # success / failed

    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))

    deliveries = relationship("WebhookDeliveryLog", back_populates="webhook_log",
                              cascade="all, delete-orphan")


class WebhookDeliveryLog(Base):
    """Tracks every delivery attempt to a merchant webhook URL."""
    __tablename__ = "webhook_delivery_logs"

    id = Column(Integer, primary_key=True, index=True)
    webhook_log_id = Column(Integer, ForeignKey("webhook_logs.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id = Column(String(255), nullable=True, index=True)

    # delivery target
    webhook_url = Column(String(500), nullable=True)

    # what we sent
    request_payload = Column(JSON, nullable=True)
    request_headers = Column(JSON, nullable=True)

    # what we got back
    response_status_code = Column(Integer, nullable=True)
    response_body = Column(JSON, nullable=True)
    response_time_ms = Column(Integer, nullable=True)               # round-trip in milliseconds

    # delivery outcome
    delivery_status = Column(String(32), default="pending")         # pending / delivered / failed / timeout / no_url / skipped
    attempt_number = Column(Integer, default=1)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    delivered_at = Column(DateTime, nullable=True)

    webhook_log = relationship("WebhookLog", back_populates="deliveries")


# --- TSP (Third-Party Service Provider) registry and per-merchant mapping ---

class TspDirectionEnum(str, enum.Enum):
    PAYIN = "payin"
    PAYOUT = "payout"
    BOTH = "both"

class TspStatusEnum(str, enum.Enum):
    active = "active"
    inactive = "inactive"

class TspProvider(Base):
    """
    Canonical registry of TSPs (PhonePe, Paytm, RazorpayPayout, BankAPI etc).
    A global list of providers (one row per provider).
    """
    __tablename__ = "tsp_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)            # e.g. "PhonePe", "Razorpay_Payout"
    code = Column(String(60), nullable=False, unique=True)             # short code used in logic e.g. "PHONEPE_PAYIN"
    description = Column(Text, nullable=True)
    default_direction = Column(SAEnum(TspDirectionEnum), default=TspDirectionEnum.BOTH, nullable=False)
    status = Column(SAEnum(TspStatusEnum), default=TspStatusEnum.active, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    updated_at = Column(DateTime, default=lambda: datetime.now(india_tz), onupdate=lambda: datetime.now(india_tz))

    # JSON describing provider capabilities (instruments, rates, features) - optional
    capabilities = Column(JSON, nullable=True)


class MerchantTspSetting(Base):
    """
    Per-merchant mapping to providers. Merchant can enable multiple providers
    separately for PayIn and PayOut. Priority controls routing order.
    """
    __tablename__ = "merchant_tsp_settings"
    __table_args__ = (UniqueConstraint('merchant_id', 'provider_id', 'direction', name='uix_merchant_provider_direction'),)

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("tsp_providers.id", ondelete="CASCADE"), nullable=False, index=True)

    # Whether this provider is enabled for this merchant for the given direction
    direction = Column(SAEnum(TspDirectionEnum), nullable=False)   # payin / payout / both
    enabled = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=100, nullable=False)        # lower = higher priority in routing
    # Free-form JSON for per-merchant provider credentials, limits, routing rules etc.
    config = Column(JSON, nullable=True)
    min_amount = Column(Float, nullable=True)
    max_amount = Column(Float, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    updated_at = Column(DateTime, default=lambda: datetime.now(india_tz), onupdate=lambda: datetime.now(india_tz))

    # Relationships
    merchant = relationship("User", backref=backref("tsp_settings", cascade="all, delete-orphan"), lazy="joined")
    provider = relationship("TspProvider", backref=backref("merchant_mappings", cascade="all, delete-orphan"), lazy="joined")


class ProviderCredential(Base):
    """
    Optional table for storing credentials for providers if you prefer to separate them.
    Use `config` in MerchantTspSetting or this table depending on security strategy.
    """
    __tablename__ = "provider_credentials"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("tsp_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(256), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    secret_key = Column(String(256), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    salt_key1 = Column(String(256), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    salt_key2 = Column(String(256), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    salt_key3 = Column(String(256), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    payIn_mid = Column(String(255), nullable=False, unique=True)
    payOut_mid = Column(String(255), nullable=False, unique=True)
    # store encrypted or masked credential data (or pointer to secret-store)
    secret_store_key = Column(String(255), nullable=True)   # e.g. vault key or KMS id
    credential_meta = Column(JSON, nullable=True)           # non-sensitive metadata (public key, env, mode)
    is_active_payIn = Column(Boolean, default=False)
    is_active_payOut = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    updated_at = Column(DateTime, default=lambda: datetime.now(india_tz), onupdate=lambda: datetime.now(india_tz))

    merchant = relationship("User", lazy="joined")
    provider = relationship("TspProvider", lazy="joined")


class MerchantKycItem(Base):
    """
    One KYC field or document submitted by a merchant (company type, PAN number, PAN card file, ...).
    Each item is reviewed by an admin on its own; the item keys are defined in routers/kyc.py.
    """
    __tablename__ = "merchant_kyc_items"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_merchant_kyc_item"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(50), nullable=False)
    value = Column(Text, nullable=True)            # text value (e.g. PAN number); None for documents
    file_path = Column(String(500), nullable=True)  # private path on disk — never served statically
    file_name = Column(String(255), nullable=True)  # original filename, for downloads
    file_mime = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    remark = Column(Text, nullable=True)            # admin's reason when rejected
    reviewed_by = Column(String(20), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(india_tz))
    updated_at = Column(DateTime, default=lambda: datetime.now(india_tz), onupdate=lambda: datetime.now(india_tz))

    user = relationship("User", backref=backref("kyc_items", cascade="all, delete-orphan"))


class MerchantEmailValidation(Base):
    """Per-merchant switch: when enabled, PayIn initiation rejects customer emails that fail
    utils/email_validation.check_customer_email (bad format, or no vowel in the username part)."""
    __tablename__ = "merchant_email_validation"

    user_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=False)
    updated_by = Column(String(20), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(india_tz), onupdate=lambda: datetime.now(india_tz))
