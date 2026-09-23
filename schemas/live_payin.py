from pydantic import BaseModel, constr
from typing import Optional, Literal

class Customer(BaseModel):
    buyer_name: str
    email: str
    phone: constr(min_length=10, max_length=15)
    address1: Optional[constr(min_length=10, max_length=250)] = None
    address2: Optional[constr(min_length=10, max_length=250)] = None


class PaymentRequest(BaseModel):
    amount: float
    merchantOrderId: str
    channel: Literal["web", "android", "ios", "api"]
    purpose: Optional[str] = "Online Payment"
    customer: Customer
