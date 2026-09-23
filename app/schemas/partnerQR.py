# schemas.py
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
import re

from pydantic.v1 import validator

MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")  # Indian mobile pattern; adjust if needed

class CreateOrderRequest(BaseModel):
    #key: str = Field(..., min_length=10, max_length=64)
    order_id: str = Field(..., min_length=6, max_length=64)
    amount: str = Field(..., min_length=1)
    p_info: str = Field(..., min_length=1, max_length=255)
    customer_name: str = Field(..., min_length=1, max_length=100)
    customer_email: EmailStr
    customer_mobile: str = Field(..., min_length=10, max_length=15)
    redirect_url: Optional[str] = Field(None, max_length=2048)


    @validator("amount")
    def amount_must_be_positive_number(cls, v):
        try:
            # Accept string numeric like "100" or "100.00"
            amount = float(v)
        except Exception:
            raise ValueError("amount must be a numeric string")
        if amount <= 0:
            raise ValueError("amount must be > 0")
        # optionally format to 2 decimal places
        return f"{amount:.2f}"


class TransferRequest(BaseModel):
    user_id: str
    direction: Literal["to_payout", "to_wallet"]
    amount: Optional[float] = None

    @validator("amount")
    def amount_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v

class TransferResponse(BaseModel):
    user_id: str
    transferred_amount: float
    wallet_balance: float
    payout_wallet_balance: float
    message: str


class WalletAdjustRequest(BaseModel):
    user_id: str
    wallet_type: Literal["wallet", "payout"]
    action: Literal["increase", "decrease"]
    amount: float

    @validator("amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v