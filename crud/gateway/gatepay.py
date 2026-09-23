# crud/getepay.py
import uuid
from datetime import datetime

def initiate_getepay_payin(ctx: dict) -> dict:
    """
    MOCK GatePay / GetePay PayIn initiation
    """

    txn_id = f"GP_{uuid.uuid4().hex[:12].upper()}"

    return {
        "provider": "gatepay",
        "status": "initiated",
        "txn_id": txn_id,
        "merchant_order_id": ctx["merchant_order_id"],
        "amount": ctx["amount"],
        "currency": "INR",
        "payment_url": f"https://mock.gatepay.in/pay/{txn_id}",
        "expires_at": datetime.utcnow().isoformat() + "Z",
        "customer": {
            "name": ctx["customer"]["buyer_name"],
            "phone": ctx["customer"]["phone"],
        },
        "raw": {
            "mid": ctx["payin_mid"],
            "note": "This is a mock GatePay response"
        }
    }


def normalize_getepay_webhook(payload: dict) -> dict:
    """
    Example GetePay payload:
    {
      "order_id": "ORD123",
      "txn_id": "GP_TXN_999",
      "status": "SUCCESS",
      "amount": "100.00"
    }
    """

    status = "success" if payload.get("status") == "SUCCESS" else "failed"

    return {
        "order_id": payload.get("order_id"),
        "provider_txn_id": payload.get("txn_id"),
        "amount": float(payload.get("amount", 0)),
        "status": status,
    }
