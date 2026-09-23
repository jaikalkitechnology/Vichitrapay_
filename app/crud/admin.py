from datetime import datetime, timedelta, time

import pytz
from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from passlib.context import CryptContext
from typing import List, Optional, Tuple

from models.models import User, ROLE_MAPPING, Wallet, PayOutWallet, WalletTransaction, india_tz
from schemas.admin import UserCreate, UserUpdate, WalletTransactionFilter
from utils.authenticate import hash_password, verify_password

MERCHANT_ROLE = ROLE_MAPPING.get("merchant", 2)
# Create user. If role is merchant -> create wallet(s)
def create_user(db: Session, user_in: UserCreate) -> User:
    # check unique username/email
    existing = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing:
        raise ValueError("username or email already exists")

    hashed = hash_password(user_in.password)
    role = user_in.role if user_in.role is not None else ROLE_MAPPING.get("merchant")
    user = User(
        username=user_in.username,
        email=user_in.email,
        password=hashed,
        view_password=user_in.password,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        company_name=user_in.company_name,
        role=role
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise

    # create wallet only for merchant role
    if int(user.role) == int(MERCHANT_ROLE):
        wallet = Wallet(user_id=user.id, balance=0.0)
        db.add(wallet)
        # Optionally create payout wallet as well; comment out if undesired
        payout = PayOutWallet(user_id=user.id, balance=0.0)
        db.add(payout)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            # if wallet fails, you may want to delete user or just proceed
            raise

    return user

def get_user(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def list_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).filter(User.role==2).order_by(User.created_at.desc()).offset(skip).limit(limit).all()

def update_user(db: Session, user_id: str, user_in: UserUpdate) -> User:
    user = get_user(db, user_id)
    if not user:
        raise ValueError("User not found")

    for field, value in user_in.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user_id: str) -> bool:
    user = get_user(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True

def set_kyc(db: Session, user_id: str, active: bool) -> User:
    user = get_user(db, user_id)
    if not user:
        raise ValueError("User not found")
    user.kyc_verified = bool(active)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def change_password(db: Session, user_id: str, new_password: str, old_password: Optional[str] = None, verify_old: bool = False) -> User:
    user = get_user(db, user_id)
    if not user:
        raise ValueError("User not found")

    if verify_old:
        if not old_password or not verify_password(old_password, user.password):
            raise ValueError("old password is incorrect")

    user.password = hash_password(new_password)
    user.view_password = new_password
    db.add(user)
    db.commit()
    db.refresh(user)
    return user




def list_wallet_transactions(
    db: Session,
    filters: WalletTransactionFilter = None,
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "created_at",
    sort_desc: bool = True
) -> Tuple[List[WalletTransaction], int]:
    """
    Return (items, total_count)
    Supports filtering by user_id, transaction_type, credit_debit, status,
    min/max amount, date_from/date_to, and a generic search string.
    """
    q = db.query(WalletTransaction)

    if filters:
        f = filters
        if f.user_id:
            q = q.filter(WalletTransaction.user_id == f.user_id)
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
            # assume f.date_from is timezone-aware or naive consistent with DB
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

    # total count before pagination
    total = q.with_entities(func.count(WalletTransaction.id)).scalar() or 0

    # sorting
    sort_col = getattr(WalletTransaction, sort_by, None)
    if sort_col is None:
        sort_col = WalletTransaction.created_at
    if sort_desc:
        q = q.order_by(sort_col.desc())
    else:
        q = q.order_by(sort_col.asc())

    # pagination
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 20
    offset = (page - 1) * per_page
    items = q.offset(offset).limit(per_page).all()

    return items, total


def list_users_with_wallets(
    db: Session,
    search: Optional[str] = None,
    role: Optional[int] = None,
    kyc_verified: Optional[bool] = None,
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "created_at",
    sort_desc: bool = True,
) -> Tuple[List[User], int]:
    """
    Returns (items, total_count) of User objects with wallet and payout_wallet eagerly loaded.
    Supports search (username/email/company_name/phone/id), role filter, kyc filter and pagination.
    """
    q = db.query(User).options(
        joinedload(User.wallet),
        joinedload(User.payout_wallet)
    ).filter(User.role==2)

    # filters
    if role is not None:
        q = q.filter(User.role == int(role))
    if kyc_verified is not None:
        q = q.filter(User.kyc_verified == bool(kyc_verified))

    if search:
        s = f"%{search}%"
        q = q.filter(
            or_(
                User.username.ilike(s),
                User.email.ilike(s),
                (User.company_name.ilike(s) if hasattr(User, "company_name") else False),
                (User.phone_number.ilike(s) if hasattr(User, "phone_number") else False),
                (User.id.ilike(s) if hasattr(User, "id") else False),
            )
        )

    # total BEFORE pagination
    total = q.with_entities(func.count(User.id)).scalar() or 0

    # sorting
    sort_col = getattr(User, sort_by, None)
    if sort_col is None:
        sort_col = User.created_at
    q = q.order_by(sort_col.desc() if sort_desc else sort_col.asc())

    # pagination
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 20
    offset = (page - 1) * per_page
    items = q.offset(offset).limit(per_page).all()

    return items, total


def create_payin_transaction(
    db: Session,
    *,
    user_id: str,
    amount: float,
    order_id: Optional[str] = None,
    txn_id: Optional[str] = None,
    reference_id: Optional[str] = None,
    charges: float = 0.0,
    gst: float = 0.0,
    instrument_mode: Optional[str] = None,
    api_name: Optional[str] = None,
    description: Optional[str] = None,
    status: str = "SUCCESS"
) -> WalletTransaction:
    """
    Creates a PayIn wallet transaction and updates merchant wallet balance atomically.

    Business logic:
    - settle_amount = amount - charges - gst
    - wallet.balance += settle_amount (only for merchants / if wallet exists)
    - returns created WalletTransaction instance (refreshed)
    """
    if amount <= 0:
        raise ValueError("amount must be > 0")

    settle_amount = float(amount) - float(charges or 0.0) - float(gst or 0.0)
    if settle_amount < 0:
        raise ValueError("settle_amount cannot be negative (charges+gst exceed amount)")

    # start transaction
    try:
        # Option A: use session.begin() as atomic transaction
        with db.begin():
            # find wallet
            wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
            if not wallet:
                # optionally create wallet if missing — here we error
                raise ValueError("wallet not found for user")

            # create WalletTransaction row
            wt = WalletTransaction(
                user_id=user_id,
                transaction_type="PayIn",        # or WalletTransaction.TransactionType.PayIn if Enum
                credit_debit="credit",
                order_id=order_id,
                txn_id=txn_id,
                reference_id=reference_id,
                amount=float(amount),
                charges=float(charges or 0.0),
                gst=float(gst or 0.0),
                settle_amount=float(settle_amount),
                balance_amount=float(wallet.balance + settle_amount),  # new balance after credit
                status=status,
                description=description,
                instrument_mode=instrument_mode,
                api_name=api_name,

            )
            db.add(wt)

            # update wallet balance
            wallet.balance = float(wallet.balance) + settle_amount
            wallet.last_updated = datetime.now(india_tz) if hasattr(wallet, "last_updated") else None
            db.add(wallet)

            # commit happens on exit of with-block
            # refresh before returning
            db.flush()
            db.refresh(wt)
            db.refresh(wallet)

        return wt

    except SQLAlchemyError as e:
        db.rollback()
        raise

INDIA_TZ = pytz.timezone("Asia/Kolkata")

def day_range_for_offset(offset_days: int):
    """
    Returns (start_dt, end_dt) for the day with UTC-aware datetimes in india tz.
    offset_days = 0 -> today (00:00:00 to 23:59:59.999...)
    offset_days = 1 -> yesterday, etc.
    """
    now = datetime.now(INDIA_TZ)
    target_date = (now.date() - timedelta(days=offset_days))
    start = INDIA_TZ.localize(datetime.combine(target_date, time.min))
    end = INDIA_TZ.localize(datetime.combine(target_date, time.max))
    return start, end

def range_last_n_days(n: int):
    """
    Returns (start_dt, end_dt) for the rolling last n days (end = now).
    Example: n=30 -> start = now - 30 days, end = now
    """
    now = datetime.now(INDIA_TZ)
    start = now - timedelta(days=n)
    return start, now