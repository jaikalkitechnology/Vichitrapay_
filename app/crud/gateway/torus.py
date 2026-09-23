import uuid

def initiate_torus_payout(ctx: dict) -> dict:
    return {
        "provider": "torus",
        "status": "PENDING",
        "provider_txn_id": f"TOR_{uuid.uuid4().hex[:12]}",
        "amount": ctx["amount"],
        "note": "Mock Torus payout initiated"
    }
