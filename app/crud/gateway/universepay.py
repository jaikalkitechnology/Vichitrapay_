import uuid

def initiate_universepay_payout(ctx: dict) -> dict:
    return {
        "provider": "universepay",
        "status": "PENDING",
        "provider_txn_id": f"UNI_{uuid.uuid4().hex[:12]}",
        "amount": ctx["amount"],
        "note": "Mock UniversePay payout initiated"
    }
