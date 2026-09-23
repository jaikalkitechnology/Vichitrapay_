from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Literal, Union
from enum import Enum
from decimal import Decimal, InvalidOperation
import re


class PayMode(str, Enum):
    IMPS = "IMPS"
    NEFT = "NEFT"
    RTGS = "RTGS"


class PayoutStatus(str, Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class PayoutRequest(BaseModel):
    order_id: str = Field(..., min_length=6, max_length=50)

    amount: str = Field(
        ...,
        description="Amount as decimal string, e.g. '100.00'"
    )

    ifsc: str = Field(..., min_length=11, max_length=11)
    accountno: str = Field(..., min_length=6, max_length=30)
    name: str = Field(..., min_length=2, max_length=100)
    branch: Optional[str] = Field(None, max_length=100)

    paymode: PayMode = Field(..., description="IMPS | NEFT | RTGS")
    remarks: Optional[str] = Field(None, max_length=140)
    email: str = Field(..., max_length=100, description="Beneficiary email")
    mobile: str = Field(..., max_length=15, description="Beneficiary mobile (10 digits)")
    account_type: Optional[str] = Field("saving", description="saving or current")

    mode: Literal["bank"] = "bank"
    @field_validator("ifsc")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"^[A-Z]{4}0[A-Z0-9]{6}$", v):
            raise ValueError("Invalid IFSC format")
        return v

    @field_validator("accountno")
    @classmethod
    def validate_accountno(cls, v: str) -> str:
        vv = v.replace(" ", "")
        if not vv.isdigit():
            raise ValueError("Account number must be numeric")
        if not (6 <= len(vv) <= 30):
            raise ValueError("Account number length must be 6–30 digits")
        return vv

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        try:
            d = Decimal(v)
        except (InvalidOperation, TypeError):
            raise ValueError("Amount must be a valid decimal string")
        if d <= 0:
            raise ValueError("Amount must be greater than 0")
        return format(d, "f")  # normalize


class PayoutInitiateResponse(BaseModel):
    success: bool
    order_id: str

    payout_status: PayoutStatus
    provider: str

    amount: str
    charges: str
    gst: str
    total_debit: str

    wallet_balance_after: Optional[str] = None

    message: Optional[str] = None

class PayoutProviderResponse(BaseModel):
    success: Optional[bool] = None
    status: Optional[Union[str, bool, int]] = None
    message: Optional[str] = None

    data: Optional[Dict[str, Any]] = None
    raw: Dict[str, Any]


class PayoutWebhookNormalized(BaseModel):
    order_id: str
    provider_txn_id: Optional[str] = None
    status: PayoutStatus
    amount: str
    provider: str
