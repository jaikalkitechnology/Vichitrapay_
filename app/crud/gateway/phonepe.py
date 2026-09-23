# crud/phonepe.py
import uuid
from datetime import datetime

def initiate_phonepe_payin(ctx: dict) -> dict:
    """
    MOCK PhonePe PayIn initiation

    Expected ctx keys:
    - merchant_id
    - merchant_order_id
    - amount
    - customer
    - payin_mid
    """

    txn_id = f"PP_{uuid.uuid4().hex[:12].upper()}"

    return {
        "provider": "phonepe",
        "status": "initiated",
        "txn_id": txn_id,
        "merchant_order_id": ctx["merchant_order_id"],
        "amount": ctx["amount"],
        "currency": "INR",
        "payment_url": f"https://mock.phonepe.com/pay/{txn_id}",
        "expires_at": datetime.utcnow().isoformat() + "Z",
        "customer": {
            "name": ctx["customer"]["buyer_name"],
            "phone": ctx["customer"]["phone"],
            "email": ctx["customer"]["email"],
        },
        "raw": {
            "mid": ctx["payin_mid"],
            "note": "This is a mock PhonePe response"
        }
    }


def normalize_phonepe_webhook(payload: dict) -> dict:
    """
    Example PhonePe payload:
    {
      "data": {
        "merchantTransactionId": "ORD123",
        "transactionId": "PP_TXN_123",
        "amount": 10000,
        "state": "COMPLETED"
      }
    }
    """

    data = payload.get("data", {})

    status = "success" if data.get("state") == "COMPLETED" else "failed"

    return {
        "order_id": data.get("merchantTransactionId"),
        "provider_txn_id": data.get("transactionId"),
        "amount": data.get("amount", 0) / 100,
        "status": status,
    }
