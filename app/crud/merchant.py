import os
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import Tuple, List, Optional, Dict, Any
from models.models import User, WalletTransaction, Wallet, PayOutWallet, TransactionTypeEnum, credit_debitTypeEnum, \
    india_tz, TransactionSettled
from schemas.merchant import WalletTransactionFilter


def get_self_user_with_wallets(db: Session, user_id: str) -> Optional[User]:
    """
    Return User with wallet and payout_wallet eagerly loaded.
    """
    return db.query(User).options(
        joinedload(User.wallet),
        joinedload(User.payout_wallet)
    ).filter(User.id == user_id).first()

def list_my_transactions(
    db: Session,
    user_id: str,
    filters: Optional[WalletTransactionFilter] = None,
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "created_at",
    sort_desc: bool = True,
) -> Tuple[List[WalletTransaction], int]:
    """
    Return (items, total_count) for transactions belonging to user_id.
    Supports the same filters as WalletTransactionFilter.
    """
    q = db.query(WalletTransaction).filter(WalletTransaction.user_id == user_id)

    if filters:
        f = filters
        if f.transaction_type:
            q = q.filter(WalletTransaction.transaction_type == f.transaction_type.value)
        if f.credit_debit:
            q = q.filter(WalletTransaction.credit_debit == f.credit_debit.value)
        if f.status:
            q = q.filter(WalletTransaction.status == f.status)
        if f.min_amount is not None:
            q = q.filter(WalletTransaction.amount >= float(f.min_amount))
        if f.max_amount is not None:
            q = q.filter(WalletTransaction.amount <= float(f.max_amount))
        if f.date_from:
            q = q.filter(WalletTransaction.created_at >= f.date_from)
        if f.date_to:
            q = q.filter(WalletTransaction.created_at <= f.date_to)
        if f.search:
            s = f"%{f.search}%"
            q = q.filter(
                or_(
                    WalletTransaction.order_id.ilike(s),
                    WalletTransaction.txn_id.ilike(s),
                    WalletTransaction.reference_id.ilike(s),
                    WalletTransaction.description.ilike(s)
                )
            )

    total = q.with_entities(func.count(WalletTransaction.id)).scalar() or 0

    sort_col = getattr(WalletTransaction, sort_by, None)
    if sort_col is None:
        sort_col = WalletTransaction.created_at
    q = q.order_by(sort_col.desc() if sort_desc else sort_col.asc())

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 20
    offset = (page - 1) * per_page
    items = q.offset(offset).limit(per_page).all()

    return items, total




def _zeroed_row():
    return {"total_volume": Decimal("0.00"), "total_txns": 0, "total_charges": Decimal("0.00")}


def _to_utc(dt: datetime, tz: timezone) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return dt.astimezone(timezone.utc)



def get_wallet_transaction_metrics(
    db: Session,
    *,
    merchant_id: Optional[str] = None,
    tz_offset_hours: float = 5.5
) -> Dict[str, Dict[str, Dict[str, Any]]]:

    # Use india_tz (you already have it) for local date boundaries
    now_local = datetime.now(india_tz)

    today_date = now_local.date()
    yesterday_date = (now_local - timedelta(days=1)).date()
    last_30_start_date = (now_local - timedelta(days=30)).date()
    last_30_end_date = now_local.date()

    # windows are date ranges (inclusive)
    windows = {
        "today": (today_date, today_date),
        "yesterday": (yesterday_date, yesterday_date),
        "30_days": (last_30_start_date, last_30_end_date),
    }

    result = {"payin": {}, "payout": {}}
    filter_map = {
        "payin":  {"type": "PayIn",  "cd": "credit"},
        "payout": {"type": "PayOut", "cd": "debit"},
    }

    for label, rules in filter_map.items():
        txn_type = rules["type"]
        credit_debit = rules["cd"]

        for window_name, (start_date, end_date) in windows.items():
            # Compare DATE(created_at) between start_date and end_date (inclusive)
            q = (
                db.query(
                    func.coalesce(func.sum(WalletTransaction.amount), 0).label("total_volume"),
                    func.count(WalletTransaction.id).label("total_txns"),
                    func.coalesce(func.sum(WalletTransaction.charges + WalletTransaction.gst), 0).label("total_charges"),
                )
                .filter(WalletTransaction.transaction_type == txn_type)
                .filter(WalletTransaction.credit_debit == credit_debit)
                .filter(WalletTransaction.status == "success")
                .filter(func.date(WalletTransaction.created_at) >= start_date)
                .filter(func.date(WalletTransaction.created_at) <= end_date)
                .filter(WalletTransaction.user_id == merchant_id)
            )

            # if merchant_id:
            #     q = q.filter(WalletTransaction.user_id == merchant_id)

            row = q.one()
            total_vol = Decimal(str(row.total_volume or 0))
            total_charges = Decimal(str(row.total_charges or 0))
            total_txns = int(row.total_txns or 0)

            result[label][window_name] = {
                "total_volume": str(total_vol.quantize(Decimal("0.01"))),
                "total_txns": total_txns,
                "total_charges": str(total_charges.quantize(Decimal("0.01"))),
            }

    return result


def get_wallet_for_user(db: Session, user_id: str):
    return db.query(Wallet).filter(Wallet.user_id == user_id).first()

def get_payout_wallet_for_user(db: Session, user_id: str):
    return db.query(PayOutWallet).filter(PayOutWallet.user_id == user_id).first()

def create_wallet_transaction(db: Session, user_id: str, amount: float, description: str = "", status: str = "success"):
    wt = WalletTransaction(
        user_id=user_id,
        transaction_type=TransactionTypeEnum.PayOut,
        credit_debit=credit_debitTypeEnum.debit,
        amount=float(amount),
        description=description,
        status=status,
        created_at=datetime.now(india_tz),
    )
    db.add(wt)
    db.flush()  # populate id
    return wt

def create_transaction_settled(db: Session, user_id: str, amount: float, txn_type="debit", txn_id: str = None, status="success"):
    ts = TransactionSettled(
        txn_id = txn_id or f"SETTLE-{uuid.uuid4().hex[:12].upper()}",
        amount = float(amount),
        status = status,
        txn_type = txn_type,
        settled_date = datetime.now(india_tz),
        created_date = datetime.now(india_tz),
        user_id = user_id
    )
    db.add(ts)
    db.flush()
    return ts


UPLOAD_DIR = "static/uploads"

async def save_file_and_get_url(file: UploadFile, subfolder: str = "topup_receipts") -> str:
    # make sure directory exists
    folder_path = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(folder_path, exist_ok=True)

    # unique filename to avoid collisions
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"

    file_path = os.path.join(folder_path, filename)

    # save file contents asynchronously
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Return a URL path (assuming you serve /static via FastAPI)
    return f"/{file_path.replace(os.sep, '/')}"