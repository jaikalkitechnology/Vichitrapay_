
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from models.models import WalletTransaction, TransactionInstrument


def get_txn_by_client_txn_id(db: Session, client_txn_id: str):
    return db.query(WalletTransaction).filter(WalletTransaction.order_id == client_txn_id).first()

def create_wallet_transaction(db: Session, user_id: str, amount: float, client_txn_id: str, customer: dict, p_info: str):
    wt = WalletTransaction(
        user_id=user_id,
        transaction_type="PayIn",
        credit_debit="credit",
        order_id=client_txn_id,
        amount=amount,
        description=p_info,
        status="pending",
        #created_at=datetime.utcnow()
    )
    db.add(wt)
    db.flush()  # populate id for relationship
    # optionally create TransactionInstrument row
    ti = TransactionInstrument(
        wallet_transaction_id=wt.id,
        instrument_type="UPI_INTENT",
        status="pending",
        redirect_url=None,
        provider_response=None,
        #created_at=datetime.utcnow()
    )
    db.add(ti)
    db.commit()
    db.refresh(wt)
    return wt, ti

def update_transaction_with_partner_response(db: Session, wt: WalletTransaction, ti: TransactionInstrument, partner_response: dict, success: bool):
    # store partner payload, set status and provider token if available
    ti.provider_response = partner_response
    if partner_response.get("data", {}).get("session_id"):
        ti.provider_order_token = partner_response["data"]["session_id"]
    ti.status = "pending" if success else "failed"
    wt.provider_response = partner_response if hasattr(wt, "provider_response") else None
    wt.status = "pending" if success else "failed"
    db.add(ti)
    db.add(wt)
    db.commit()
    db.refresh(wt)
    db.refresh(ti)
    return wt, ti
