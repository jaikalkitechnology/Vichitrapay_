from typing import Optional, Literal, Dict, Any, Union
from decimal import Decimal, InvalidOperation
from pydantic import BaseModel, Field, field_validator
from enum import Enum
import re

class PayMode(str, Enum):
    IMPS = "IMPS"
    NEFT = "NEFT"
    RTGS = "RTGS"

class PayoutRequest(BaseModel):
    amount: str = Field(..., description="Amount as a decimal string, e.g. '1.00'")
    ifsc: str = Field(..., min_length=11, max_length=11)
    accountno: str = Field(..., min_length=6, max_length=30)
    name: str = Field(..., min_length=2, max_length=100)
    branch: Optional[str] = Field(None, max_length=100)
    paymode: PayMode = Field(..., description="IMPS | NEFT | RTGS")
    remarks: Optional[str] = Field(None, max_length=140)
    # const -> Literal in Pydantic v2
    mode: Literal["bank"] = "bank"

    @field_validator("ifsc")
    @classmethod
    def _validate_ifsc(cls, v: str) -> str:
        vv = v.strip().upper()
        if not re.fullmatch(r"^[A-Z]{4}0[A-Z0-9]{6}$", vv):
            raise ValueError("Invalid IFSC format (expected 4 letters + 0 + 6 alphanum)")
        return vv

    @field_validator("accountno")
    @classmethod
    def _validate_accountno(cls, v: str) -> str:
        vv = v.replace(" ", "")
        if not vv.isdigit():
            raise ValueError("Account number must be numeric")
        if not (6 <= len(vv) <= 30):
            raise ValueError("Account number length must be 6–30 digits")
        return vv

    @field_validator("amount")
    @classmethod
    def _validate_amount(cls, v: str) -> str:
        try:
            d = Decimal(v)
        except (InvalidOperation, TypeError):
            raise ValueError("Amount must be a valid decimal string")
        if d <= 0:
            raise ValueError("Amount must be greater than 0")
        return format(d, "f")  # normalize


class PayoutResponse(BaseModel):
    success: Optional[bool] = None
    status: Optional[Union[str, bool, int, float]] = None
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    raw: Dict[str, Any]