"""
Partner panel (logged-in partner, role 1): own profile, the merchants mapped under
the partner (routers/partners.py manages the mapping from the admin side), onboarding
new merchants, their transactions, a payout bank account and password change.
KYC submission for partners lives in routers/kyc.py (/api/v1/partner/kyc).
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from crud import admin as admin_crud
from models.models import PartnerMerchant, PayoutBankAccount, User, WalletTransaction, TransactionTypeEnum, india_tz
from schemas.admin import UserCreate
from schemas.merchant import PayoutBankAccountCreate
from utils.authenticate import get_current_user
from utils.database import get_db

PARTNER_ROLE, MERCHANT_ROLE = 1, 2


def partner_required(user: User = Depends(get_current_user)) -> User:
    if user.role != PARTNER_ROLE:
        raise HTTPException(403, "Access denied: partners only")
    return user


router = APIRouter(prefix="/api/v1/partner", tags=["Partner Panel"], dependencies=[Depends(partner_required)])


def _merchant_ids(db: Session, partner_id: str) -> list:
    return [m for (m,) in db.query(PartnerMerchant.merchant_id).filter(PartnerMerchant.partner_id == partner_id).all()]


def _merchant_out(u: User, mapped_at: Optional[datetime]) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "full_name": u.full_name,
        "phone_number": u.phone_number,
        "company_name": u.company_name,
        "kyc_verified": bool(u.kyc_verified),
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "mapped_at": mapped_at.isoformat() if mapped_at else None,
    }


@router.get("/me")
def me(current: User = Depends(partner_required)):
    return {
        "id": current.id,
        "username": current.username,
        "email": current.email,
        "full_name": current.full_name,
        "phone_number": current.phone_number,
        "company_name": current.company_name,
        "kyc_verified": bool(current.kyc_verified),
        "created_at": current.created_at.isoformat() if current.created_at else None,
    }


@router.get("/merchants")
def my_merchants(db: Session = Depends(get_db), current: User = Depends(partner_required)):
    rows = (
        db.query(PartnerMerchant, User)
        .join(User, User.id == PartnerMerchant.merchant_id)
        .filter(PartnerMerchant.partner_id == current.id)
        .order_by(PartnerMerchant.created_at.desc())
        .all()
    )
    return [_merchant_out(u, m.created_at) for m, u in rows]


class OnboardIn(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    phone_number: str = Field(..., min_length=10, max_length=15)
    company_name: Optional[str] = Field(None, max_length=250)
    password: str = Field(..., min_length=8)


@router.post("/merchants", status_code=201)
def onboard_merchant(payload: OnboardIn, db: Session = Depends(get_db), current: User = Depends(partner_required)):
    """Create a merchant account (with wallets) and map it under this partner."""
    try:
        user = admin_crud.create_user(db, UserCreate(**payload.model_dump(), role=MERCHANT_ROLE))
    except ValueError as e:
        raise HTTPException(400, str(e))
    m = PartnerMerchant(partner_id=current.id, merchant_id=user.id, created_by=current.id)
    db.add(m)
    db.commit()
    return _merchant_out(user, m.created_at)


def _parse_day(v: Optional[str]) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.strptime(v[:10], "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, f"Invalid date {v!r}, use YYYY-MM-DD")


@router.get("/transactions")
def my_merchant_transactions(
    merchant_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    last_hours: Optional[int] = Query(None, ge=1, le=24 * 90, description="Only the last N hours (overrides dates)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current: User = Depends(partner_required),
):
    """Transactions of the partner's merchants, with success / pending / failed totals for the same filters."""
    ids = _merchant_ids(db, current.id)
    if merchant_id:
        if merchant_id not in ids:
            raise HTTPException(404, "Merchant is not mapped to you")
        ids = [merchant_id]
    empty = {"count": 0, "amount": 0.0}
    if not ids:
        return {"summary": {"success": empty, "pending": empty, "failed": empty, "charges": 0.0}, "items": [], "total": 0, "page": page, "per_page": per_page}

    f = [WalletTransaction.user_id.in_(ids), WalletTransaction.transaction_type.in_([TransactionTypeEnum.PayIn, TransactionTypeEnum.PayOut])]
    start, end = _parse_day(from_date), _parse_day(to_date)
    if last_hours:
        start, end = None, None
        f.append(WalletTransaction.created_at >= datetime.now(india_tz).replace(tzinfo=None) - timedelta(hours=last_hours))
    if start:
        f.append(WalletTransaction.created_at >= start)
    if end:
        f.append(WalletTransaction.created_at < end + timedelta(days=1))
    base = db.query(WalletTransaction).filter(and_(*f))

    ok = WalletTransaction.status == "success"
    bad = WalletTransaction.status == "failed"
    amt = func.coalesce(WalletTransaction.amount, 0)

    def s(cond, val):
        return func.coalesce(func.sum(case((cond, val), else_=0)), 0)

    row = base.with_entities(
        s(ok, 1), s(ok, amt), s(bad, 1), s(bad, amt), s(~ok & ~bad, 1), s(~ok & ~bad, amt),
        s(ok, func.coalesce(WalletTransaction.charges, 0) + func.coalesce(WalletTransaction.gst, 0)),
    ).one()
    total = base.with_entities(func.count(WalletTransaction.id)).scalar() or 0
    names = {u.id: (u.full_name or u.company_name or u.username) for u in db.query(User).filter(User.id.in_(ids)).all()}
    txns = base.order_by(WalletTransaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "summary": {
            "success": {"count": int(row[0]), "amount": round(float(row[1]), 2)},
            "failed": {"count": int(row[2]), "amount": round(float(row[3]), 2)},
            "pending": {"count": int(row[4]), "amount": round(float(row[5]), 2)},
            "charges": round(float(row[6]), 2),
        },
        "items": [
            {
                "id": t.id,
                "merchant_id": t.user_id,
                "merchant_name": names.get(t.user_id),
                "txn_id": t.txn_id,
                "order_id": t.order_id,
                "type": t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type),
                "amount": float(t.amount or 0),
                "charges": round(float(t.charges or 0) + float(t.gst or 0), 2),
                "status": t.status,
                "utr": t.utr,
                "instrument_mode": t.instrument_mode,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txns
        ],
        "total": int(total),
        "page": page,
        "per_page": per_page,
    }


def _bank_out(a: PayoutBankAccount) -> dict:
    return {
        "id": a.id,
        "account_holder_name": a.account_holder_name,
        "account_mask": f"•••• {a.account_number[-4:]}" if a.account_number else None,
        "ifsc_code": a.ifsc_code,
        "bank_name": a.bank_name,
        "account_type": a.account_type,
        "is_validate": bool(a.is_validate),
    }


@router.get("/bank-accounts")
def my_bank_accounts(db: Session = Depends(get_db), current: User = Depends(partner_required)):
    return [_bank_out(a) for a in db.query(PayoutBankAccount).filter(PayoutBankAccount.user_id == current.id).order_by(PayoutBankAccount.id.desc()).all()]


@router.post("/bank-accounts", status_code=201)
def add_bank_account(payload: PayoutBankAccountCreate, db: Session = Depends(get_db), current: User = Depends(partner_required)):
    """Added unverified; an admin approves it in Bank Approval."""
    dup = db.query(PayoutBankAccount).filter(
        PayoutBankAccount.user_id == current.id,
        PayoutBankAccount.account_number == payload.account_number,
        PayoutBankAccount.ifsc_code == payload.ifsc_code,
    ).first()
    if dup:
        raise HTTPException(409, "This bank account is already added")
    a = PayoutBankAccount(user_id=current.id, **payload.model_dump(), is_validate=False)
    db.add(a)
    db.commit()
    db.refresh(a)
    return _bank_out(a)


@router.post("/change-password")
def change_password(payload: dict = Body(...), db: Session = Depends(get_db), current: User = Depends(partner_required)):
    old, new = payload.get("old_password"), payload.get("new_password")
    if not old:
        raise HTTPException(400, "old_password is required")
    if not new or len(new) < 6:
        raise HTTPException(400, "new_password must be at least 6 characters")
    try:
        admin_crud.change_password(db, current.id, new_password=new, old_password=old, verify_old=True)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"success": True, "message": "Password updated successfully"}
