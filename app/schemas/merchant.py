from pydantic import BaseModel, EmailStr, Field, condecimal
from typing import Optional, List, re
from datetime import datetime
from enum import Enum

from pydantic.v1 import validator


# reuse or add wallet schemas
class WalletOut(BaseModel):
    id: int
    user_id: Optional[str]
    balance: float
    last_updated: Optional[datetime]

    class Config:
        from_attributes = True

class PayOutWalletOut(BaseModel):
    id: int
    user_id: Optional[str]
    balance: float
    last_updated: Optional[datetime]

    class Config:
        from_attribute = True

class UserSelfOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[int] = None
    kyc_verified: bool = False
    created_at: Optional[datetime] = None
    wallet: Optional[WalletOut] = None
    payout_wallet: Optional[PayOutWalletOut] = None

    class Config:
        from_attribute = True

# transaction enums (mirror models.TransactionTypeEnum / credit_debitTypeEnum)
class TransactionType(str, Enum):
    PayIn = "PayIn"
    PayOut = "PayOut"
    Settled = "Settled"
    PayInUAT = "PayInUAT"
    PayOutUAT = "PayOutUAT"
    validation_api = "Validation_api"
    UatRefund = "UatRefund"
    LiveRefund = "LiveRefund"

class CreditDebitType(str, Enum):
    credit = "credit"
    debit = "debit"

class WalletTransactionOut(BaseModel):
    id: int
    user_id: str
    transaction_type: TransactionType
    credit_debit: CreditDebitType
    order_id: Optional[str] = None
    status: Optional[str] = None
    amount: float
    settle_amount: Optional[float] = None
    balance_amount: Optional[float] = None
    charges: Optional[float] = None
    gst: Optional[float] = None
    reference_id: Optional[str] = None
    txn_id: Optional[str] = None
    description: Optional[str] = None
    instrument_mode: Optional[str] = None
    api_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributee = True

class WalletTransactionFilter(BaseModel):
    transaction_type: Optional[TransactionType] = None
    credit_debit: Optional[CreditDebitType] = None
    status: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None  # order_id, txn_id, reference_id, description

class PaginatedWalletTransactions(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[WalletTransactionOut]
# Example model placeholder (replace with your real import)
class WalletTransaction:
    id = None
    trans_type = None
    status = None
    amount = None
    charge = None
    created_at = None


class PayoutBankAccountCreate(BaseModel):
    account_holder_name: str = Field(..., min_length=2, max_length=100)
    account_number: str = Field(..., min_length=6, max_length=30)
    ifsc_code: str = Field(..., min_length=5, max_length=20)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_branch: Optional[str] = Field(None, max_length=100)
    account_type: Optional[str] = Field(None, max_length=20)
    bank_address: Optional[str] = Field(None, max_length=255)

    @validator("ifsc_code")
    def validate_ifsc(cls, v: str):
        # Simple IFSC pattern (INDIA): 4 letters + 0 + 6 alphanumeric (case-insensitive)
        v_up = v.strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v_up):
            # allow more relaxed formats if you prefer; change regex accordingly
            raise ValueError("ifsc_code does not match expected IFSC format (e.g. SBIN0000001)")
        return v_up

    @validator("account_number")
    def normalize_account_number(cls, v: str):
        # remove spaces/dashes and validate length
        cleaned = re.sub(r"[\s\-]", "", v)
        if not (6 <= len(cleaned) <= 30):
            raise ValueError("account_number must be 6-30 digits/characters after removing spaces/dashes")
        return cleaned


class PayoutBankAccountOut(BaseModel):
    id: int
    user_id: str
    account_holder_name: str
    account_number: str
    ifsc_code: str
    bank_name: Optional[str]
    bank_branch: Optional[str]
    account_type: Optional[str]
    bank_address: Optional[str]
    is_validate: bool

    class Config:
        from_attributes = True

class PayoutBankAccountList(BaseModel):
    total: int
    items: List[PayoutBankAccountOut]  # uses the PayoutBankAccountOut defined earlier

    class Config:
        from_attributes = True


class WithdrawRequest(BaseModel):
    amount: condecimal(gt=0) = Field(..., description="Amount to withdraw")
    bank_account_id: str

class WithdrawResponse(BaseModel):
    success: bool
    message: str
    wallet_transaction_id: Optional[int]
    transaction_settled_id: Optional[int]

class TransactionSettledOut(BaseModel):
    id: int
    txn_id: Optional[str]
    amount: float
    status: Optional[str]
    txn_type: Optional[str]
    settled_date: Optional[datetime]
    created_date: Optional[datetime]
    user_id: str

    class Config:
        from_attributes = True

class WalletTransactionOutApi(BaseModel):

    transaction_type: str
    credit_debit: str
    amount: float
    status: Optional[str] = None
    order_id: Optional[str] = None
    txn_id: Optional[str] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime


    class Config:
        from_attributes = True


class WalletTransactionListResponse(BaseModel):
    total: int
    items: List[WalletTransactionOutApi]


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., description="New status (e.g. 'pending', 'success', 'failed')")
    note: Optional[str] = Field(None, description="Optional note to append to description")


# schemas.py (extend)
from pydantic import condecimal

class PayoutTopUpCreate(BaseModel):
    amount: condecimal(gt=0)
    payer_account_number: Optional[str] = None
    payer_vpa_or_number: Optional[str] = None
    payer_name: Optional[str] = None
    beneficiary_account_id: Optional[int] = None  # reference to DisplayAccount id
    utr_or_txn_id: Optional[str] = None
    reference_note: Optional[str] = None


# Request schema supporting the fields you specified
class DirectPayoutRequest(BaseModel):
    orderId: Optional[str] = Field(None, description="Optional client-supplied order id / idempotency key")
    amount: str = Field(..., description="Amount to payout (string allowed)")
    ifsc: str = Field(..., description="IFSC code (11 chars)")
    accountno: str = Field(..., description="Bank account number (digits)")
    name: str = Field(..., description="Account holder name")
    branch: Optional[str] = Field(None, description="Branch")
    paymode: Optional[str] = Field("IMPS", description="IMPS/NEFT/RTGS")
    udf1: Optional[str] = None
    udf2: Optional[str] = None
    udf3: Optional[str] = None
    remarks: Optional[str] = None
    mode: Optional[str] = Field("bank", description="mode, e.g. bank")


# schemas/merchant_credentials.py


class MerchantCredentialItem(BaseModel):
    provider_id: int
    provider_name: str
    direction: str  # payin / payout

    client_id: str
    secret_key: str
    salt_key1: str
    salt_key2: str
    salt_key3: str

    mid: str
    is_active: bool

class MerchantCredentialsOut(BaseModel):
    merchant_id: str
    credentials: List[MerchantCredentialItem]
