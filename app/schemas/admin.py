from enum import Enum

from pydantic import BaseModel, EmailStr, Field, constr
from typing import Optional, List
from datetime import datetime

from pydantic.v1 import validator


class UserBase(BaseModel):
    username: str = Field(..., max_length=100)
    email: EmailStr
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[int] = None  # pass ROLE_MAPPING value if needed

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[int] = None
    kyc_verified: Optional[bool] = None

class UserOut(UserBase):
    id: str
    created_at: Optional[datetime] = None
    kyc_verified: bool

    class Config:
        from_attributes = True

class PasswordUpdate(BaseModel):
    old_password: Optional[str] = None
    new_password: str = Field(..., min_length=6)

class KycToggle(BaseModel):
    kyc_verified: bool


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
    customer_id: Optional[str] = None
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
        from_attribute = True

class WalletTransactionFilter(BaseModel):
    user_id: Optional[str] = None
    transaction_type: Optional[TransactionType] = None
    credit_debit: Optional[CreditDebitType] = None
    status: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None  # search by order_id, txn_id, reference_id, description

class PaginatedWalletTransactions(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[WalletTransactionOut]



class WalletOut(BaseModel):
    id: int
    user_id: Optional[str]
    balance: float
    last_updated: Optional[datetime]

    class Config:
        from_attribute = True

class PayOutWalletOut(BaseModel):
    id: int
    user_id: Optional[str]
    balance: float
    last_updated: Optional[datetime]

    class Config:
        from_attribute = True

class UserWithWalletsOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[int] = None
    kyc_verified: bool = False
    view_password: Optional[str] = None
    created_at: Optional[datetime] = None
    wallet: Optional[WalletOut] = None
    payout_wallet: Optional[PayOutWalletOut] = None

    class Config:
        from_attribute = True

class PaginatedUsersWithWallets(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[UserWithWalletsOut]


class PayInCreate(BaseModel):
    user_id: str = Field(..., description="Merchant user id (owner of the wallet)")
    amount: float = Field(..., gt=0, description="Gross amount received (currency units)")
    order_id: Optional[str] = None
    txn_id: Optional[str] = None
    reference_id: Optional[str] = None
    charges: Optional[float] = 0.0
    gst: Optional[float] = 0.0
    instrument_mode: Optional[str] = None
    api_name: Optional[str] = None
    description: Optional[str] = None
    # if you want to support pending states, include status field in request; otherwise server decides

class PayInResponse(BaseModel):
    id: int
    user_id: str
    amount: float
    charges: float
    gst: float
    settle_amount: float
    balance_after: float
    transaction_type: str
    credit_debit: str
    status: str
    order_id: Optional[str] = None
    txn_id: Optional[str] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attribute = True


class TxnStatusBreakdown(BaseModel):
    success: int = 0
    failed: int = 0
    pending: int = 0
    total: int = 0
    volume: float = 0.0

class PeriodMetrics(BaseModel):
    volume: float
    txn: int
    charges: float
    success_count: int = 0
    success_volume: float = 0.0
    payin: Optional[TxnStatusBreakdown] = None
    payout: Optional[TxnStatusBreakdown] = None

class AdminSummaryOut(BaseModel):
    total_merchants: int
    today: PeriodMetrics
    yesterday: PeriodMetrics
    last_30_days: PeriodMetrics
    merchant_kyc_pending: int
    total_settle_pending: int
    pending_bank_approvals: int = 0


class MerchantSettingsBase(BaseModel):
    payInCharges: float = Field(..., ge=0, description="Pay-in charges (numeric, >= 0)")
    payOutCharges: float = Field(..., ge=0, description="Pay-out charges (numeric, >= 0)")
    payOutChargesFlat: float = Field(..., ge=0, description="Pay-out flat charges (numeric, >= 0)")
    webhook: Optional[constr(max_length=250)] = None
    webhook_payout: Optional[constr(max_length=250)] = None
    ip: Optional[constr(max_length=250)] = None

    @validator("payInCharges", "payOutCharges", "payOutChargesFlat")
    def round_two_decimals(cls, v):
        # optional: normalize to two decimals
        return round(float(v), 2)


class MerchantSettingsCreate(MerchantSettingsBase):
    id: constr(max_length=20) = Field(..., description="Merchant user id (should match users.id)")


class MerchantSettingsUpdate(BaseModel):
    payInCharges: Optional[float] = Field(None, ge=0)
    payOutCharges: Optional[float] = Field(None, ge=0)
    payOutChargesFlat: Optional[float] = Field(None, ge=0)
    webhook: Optional[constr(max_length=250)] = None
    webhook_payout: Optional[constr(max_length=250)] = None
    ip: Optional[constr(max_length=250)] = None

    @validator("payInCharges", "payOutCharges", "payOutChargesFlat")
    def round_if_not_none(cls, v):
        return round(float(v), 2) if v is not None else v


# class MerchantSettingsOut(MerchantSettingsBase):
#     id: str
#
#     class Config:
#         from_attribute = True

class MerchantSettingsOut(BaseModel):
    id: str
    payInCharges: Optional[float] = None
    payOutCharges: Optional[float] = None
    payOutChargesFlat: Optional[float] = None
    webhook: Optional[str] = None
    webhook_payout: Optional[str] = None
    ip: Optional[str] = None

    class Config:
        from_attribute = True



class DisplayAccountCreate(BaseModel):
    account_holder_name:str
    beneficiary_account_number: str
    beneficiary_ifsc: Optional[str] = None
    beneficiary_bank_name: Optional[str] = None
    is_validate: Optional[bool] = False

class DisplayAccountOut(DisplayAccountCreate):
    id: int