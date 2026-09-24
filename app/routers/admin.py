import calendar
from datetime import datetime, timedelta, date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import io
import csv

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Form, Header
from typing import List, Optional, Dict, Any, Tuple

from pydantic import BaseModel, Field
from sqlalchemy import func, or_, desc, asc, and_, case, true
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from crud.merchant import list_my_transactions
from crud.universePayout import  _login, _transfer, BASE_URL, HTTP_TIMEOUT_SECONDS
from models.models import ROLE_MAPPING, User, WalletTransaction, TransactionTypeEnum, TransactionSettled, \
    MerchantSettings, Wallet, PayOutWallet, india_tz, PayoutBankAccount, DisplayAccount, PayoutTopUp, TopUpStatusEnum, \
    TopUpInstrumentEnum, credit_debitTypeEnum, ProviderCredential
from schemas.admin import UserOut, UserCreate, UserUpdate, KycToggle, PasswordUpdate, PaginatedWalletTransactions, \
    WalletTransactionFilter, PaginatedUsersWithWallets, PayInResponse, PayInCreate, AdminSummaryOut, PeriodMetrics, \
    MerchantSettingsOut, MerchantSettingsCreate, MerchantSettingsUpdate, DisplayAccountOut, DisplayAccountCreate

from schemas.merchant import TransactionSettledOut, MerchantCredentialsOut, MerchantCredentialItem
from schemas.partnerQR import TransferResponse, TransferRequest, WalletAdjustRequest
from schemas.universePayout import PayoutRequest, PayoutResponse
from utils.authenticate import admin_required
from utils.database import get_db
from fastapi.responses import StreamingResponse
import crud.admin as crud
from typing import List, Dict
from pydantic import BaseModel, Field
router = APIRouter(dependencies=[Depends(admin_required)])






@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_endpoint(user_in: UserCreate, db: Session = Depends(get_db), ):
    try:
        user = crud.create_user(db, user_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create user {e}")
    return user

@router.get("/", response_model=List[UserOut])
def list_users_endpoint(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.list_users(db, skip=skip, limit=limit)
    return users

@router.get("/user/{user_id}", response_model=UserOut)
def get_user_endpoint(user_id: str, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/user/{user_id}", response_model=UserOut)
def update_user_endpoint(user_id: str, payload: UserUpdate, db: Session = Depends(get_db)):
    try:
        user = crud.update_user(db, user_id, payload)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/user/{user_id}/kyc", response_model=UserOut)
def toggle_kyc_endpoint(user_id: str, payload: KycToggle, db: Session = Depends(get_db)):
    try:
        user = crud.set_kyc(db, user_id, payload.kyc_verified)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/user/{user_id}/password", response_model=UserOut)
def change_password_endpoint(user_id: str, payload: PasswordUpdate, db: Session = Depends(get_db)):
    # If you want to verify old password, set verify_old=True
    try:
        user = crud.change_password(
            db,
            user_id,
            new_password=payload.new_password,
            old_password=payload.old_password,
            verify_old=False  # set True to require old password verification
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return user

@router.delete("/user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_endpoint(user_id: str, db: Session = Depends(get_db)):
    ok = crud.delete_user(db, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return None



@router.get("/transactions", response_model=PaginatedWalletTransactions)
def get_transactions(
    user_id: Optional[str] = Query(None),
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
):
    """
    List wallet transactions with filters and pagination.
    Example filters: ?user_id=MER-...&transaction_type=PayIn&credit_debit=credit&page=1&per_page=50
    """
    # build filter schema
    filters = WalletTransactionFilter(
        user_id=user_id,
        transaction_type=transaction_type,
        credit_debit=credit_debit,
        status=status,
        min_amount=min_amount,
        max_amount=max_amount,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    items, total = crud.list_wallet_transactions(db, filters=filters, page=page, per_page=per_page, sort_by=sort_by, sort_desc=sort_desc)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": items
    }



@router.get("/users-with-wallets", response_model=PaginatedUsersWithWallets)
def get_users_with_wallets(
    search: Optional[str] = Query(None, description="search username, email, company, phone or id"),
    role: Optional[int] = Query(None, description="role integer (e.g. 2 for merchant)"),
    kyc_verified: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    sort_by: str = Query("created_at"),
    sort_desc: bool = Query(True),
    db: Session = Depends(get_db),
):
    """
    List users with their wallet and payout_wallet. Use `search`, `role`, `kyc_verified` and pagination.
    """
    items, total = crud.list_users_with_wallets(
        db,
        search=search,
        role=role,
        kyc_verified=kyc_verified,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": items
    }


@router.post("/txn/payin", response_model=PayInResponse, status_code=status.HTTP_201_CREATED)
def payin_endpoint(payload: PayInCreate, db: Session = Depends(get_db)):
    """
    Create a PayIn transaction and credit merchant wallet.
    """
    try:
        wt = crud.create_payin_transaction(
            db,
            user_id=payload.user_id,
            amount=payload.amount,
            order_id=payload.order_id,
            txn_id=payload.txn_id,
            reference_id=payload.reference_id,
            charges=payload.charges or 0.0,
            gst=payload.gst or 0.0,
            instrument_mode=payload.instrument_mode,
            api_name=payload.api_name,
            description=payload.description,
            status="success"  # or logic to set PENDING/FAILED based on verification
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # log e in real app
        raise HTTPException(status_code=500, detail="could not create payin transaction")

    # map WalletTransaction to PayInResponse fields
    return PayInResponse(
        id=wt.id,
        user_id=wt.user_id,
        amount=wt.amount,
        charges=wt.charges or 0.0,
        gst=wt.gst or 0.0,
        settle_amount=wt.settle_amount or 0.0,
        balance_after=wt.balance_amount or 0.0,
        transaction_type=wt.transaction_type,
        credit_debit=wt.credit_debit,
        status=wt.status,
        order_id=wt.order_id,
        txn_id=wt.txn_id,
        reference_id=wt.reference_id,
        description=wt.description,
        created_at=wt.created_at
    )

@router.get("/summary", response_model=AdminSummaryOut)
def admin_summary(db: Session = Depends(get_db)) -> AdminSummaryOut:


    """
    Returns admin metrics: merchant count, today's/yesterday/30d metrics,
    KYC pending merchants, and settle-pending count.
    """

    # ---------- Total merchants ----------
    total_merchants = db.query(func.count(User.id)).filter(
        User.role == ROLE_MAPPING["merchant"]
    ).scalar() or 0

    # ---------- KYC pending merchants ----------
    merchant_kyc_pending = db.query(func.count(User.id)).filter(
        User.role == ROLE_MAPPING["merchant"],
        User.kyc_verified == False
    ).scalar() or 0

    # ---------- define a helper to aggregate WalletTransaction ----------
    def aggregate_between(start_dt, end_dt):
        # Total volume/txn/charges (PayIn only, excluding pending)
        q = db.query(
            func.coalesce(func.sum(WalletTransaction.amount), 0.0),
            func.coalesce(func.count(WalletTransaction.id), 0),
            func.coalesce(func.sum(WalletTransaction.charges), 0.0),
        ).filter(
            WalletTransaction.created_at >= start_dt,
            WalletTransaction.created_at <= end_dt,
            WalletTransaction.transaction_type == TransactionTypeEnum.PayIn,
            WalletTransaction.status != "pending",
        )
        volume, txn, charges = q.one()

        # Success count & volume
        sq = db.query(
            func.coalesce(func.count(WalletTransaction.id), 0),
            func.coalesce(func.sum(WalletTransaction.amount), 0.0),
        ).filter(
            WalletTransaction.created_at >= start_dt,
            WalletTransaction.created_at <= end_dt,
            WalletTransaction.transaction_type == TransactionTypeEnum.PayIn,
            WalletTransaction.status == "success",
        )
        success_count, success_volume = sq.one()

        # PayIn/PayOut breakdown
        def status_breakdown(txn_type):
            from schemas.admin import TxnStatusBreakdown
            rows = db.query(
                WalletTransaction.status,
                func.count(WalletTransaction.id),
                func.coalesce(func.sum(WalletTransaction.amount), 0.0),
            ).filter(
                WalletTransaction.created_at >= start_dt,
                WalletTransaction.created_at <= end_dt,
                WalletTransaction.transaction_type == txn_type,
            ).group_by(WalletTransaction.status).all()

            bd = TxnStatusBreakdown()
            for st, cnt, vol in rows:
                if st == "success":
                    bd.success = int(cnt)
                elif st == "failed":
                    bd.failed = int(cnt)
                elif st == "pending":
                    bd.pending = int(cnt)
                bd.total += int(cnt)
                bd.volume += float(vol)
            return bd

        payin_bd = status_breakdown(TransactionTypeEnum.PayIn)
        payout_bd = status_breakdown(TransactionTypeEnum.PayOut)

        return PeriodMetrics(
            volume=float(volume or 0.0),
            txn=int(txn or 0),
            charges=float(charges or 0.0),
            success_count=int(success_count or 0),
            success_volume=float(success_volume or 0.0),
            payin=payin_bd,
            payout=payout_bd,
        )

    # ---------- Today's metrics ----------
    start_today, end_today = crud.day_range_for_offset(0)
    today_metrics = aggregate_between(start_today, end_today)

    # ---------- Yesterday's metrics ----------
    start_yest, end_yest = crud.day_range_for_offset(1)
    yesterday_metrics = aggregate_between(start_yest, end_yest)

    # ---------- Last 30 days (rolling) ----------
    start_30, end_30 = crud.range_last_n_days(30)
    last30_metrics = aggregate_between(start_30, end_30)

    # ---------- Total settle pending (assumption) ----------
    # Interpretation: transactions with transaction_type == 'Settled' but not yet successful,
    # OR any transaction that represents a settle and has status not 'success'.
    # Adjust filter as per your app's semantics.
    total_settle_pending = db.query(func.count(WalletTransaction.id)).filter(
        WalletTransaction.transaction_type == TransactionTypeEnum.Settled,
        WalletTransaction.status != "success"
    ).scalar() or 0

    # ---------- Pending bank approvals ----------
    pending_bank_approvals = db.query(func.count(PayoutBankAccount.id)).filter(
        PayoutBankAccount.is_validate == False
    ).scalar() or 0

    out = AdminSummaryOut(
        total_merchants=int(total_merchants),
        today=today_metrics,
        yesterday=yesterday_metrics,
        last_30_days=last30_metrics,
        merchant_kyc_pending=int(merchant_kyc_pending),
        total_settle_pending=int(total_settle_pending),
        pending_bank_approvals=int(pending_bank_approvals),
    )
    return out


@router.get("/report")
def admin_report(
    merchant_id: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(WalletTransaction)

    if merchant_id:
        q = q.filter(WalletTransaction.user_id == merchant_id)
    if transaction_type:
        q = q.filter(WalletTransaction.transaction_type == transaction_type)
    if status:
        q = q.filter(WalletTransaction.status == status)
    if date_from:
        q = q.filter(WalletTransaction.created_at >= date_from)
    if date_to:
        q = q.filter(WalletTransaction.created_at <= date_to + "T23:59:59")
    if search:
        q = q.filter(
            or_(
                WalletTransaction.order_id.contains(search),
                WalletTransaction.txn_id.contains(search),
                WalletTransaction.utr.contains(search),
            )
        )

    total = q.count()
    items = q.order_by(WalletTransaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [
            {
                "id": t.id,
                "user_id": t.user_id,
                "transaction_type": t.transaction_type.value if t.transaction_type else None,
                "credit_debit": t.credit_debit.value if t.credit_debit else None,
                "order_id": t.order_id,
                "status": t.status,
                "amount": t.amount,
                "charges": t.charges,
                "gst": t.gst,
                "settle_amount": t.settle_amount,
                "balance_amount": t.balance_amount,
                "txn_id": t.txn_id,
                "utr": t.utr,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in items
        ],
    }


@router.post("/txn/{txn_id}/mark-failed")
def admin_mark_txn_failed(txn_id: int, db: Session = Depends(get_db)):
    """
    Admin marks a success txn as failed.
    PayIn success→failed: debit settle_amount from Wallet.
    PayOut success→failed: debit settle_amount from PayOutWallet.
    """
    wt = db.query(WalletTransaction).filter(WalletTransaction.id == txn_id).first()
    if not wt:
        raise HTTPException(404, "Transaction not found")
    if wt.status != "success":
        raise HTTPException(400, f"Can only mark 'success' as failed, current: {wt.status}")

    if wt.transaction_type == TransactionTypeEnum.PayIn:
        wallet = db.query(Wallet).filter(Wallet.user_id == wt.user_id).with_for_update().first()
        if wallet:
            wallet.balance -= float(wt.settle_amount or wt.amount or 0)
    elif wt.transaction_type == TransactionTypeEnum.PayOut:
        from models.models import PayOutWallet
        wallet = db.query(PayOutWallet).filter(PayOutWallet.user_id == wt.user_id).with_for_update().first()
        if wallet:
            wallet.balance -= float(wt.settle_amount or wt.amount or 0)

    wt.status = "failed"
    wt.description = (wt.description or "") + " [Admin: marked failed]"
    db.commit()
    return {"success": True, "message": f"Txn {txn_id} marked as failed", "new_status": "failed"}


@router.post("/txn/{txn_id}/mark-success")
def admin_mark_txn_success(txn_id: int, db: Session = Depends(get_db)):
    """
    Admin marks a failed txn as success.
    PayIn failed→success: credit settle_amount to Wallet.
    PayOut failed→success: credit settle_amount to PayOutWallet.
    """
    wt = db.query(WalletTransaction).filter(WalletTransaction.id == txn_id).first()
    if not wt:
        raise HTTPException(404, "Transaction not found")
    if wt.status != "failed":
        raise HTTPException(400, f"Can only mark 'failed' as success, current: {wt.status}")

    if wt.transaction_type == TransactionTypeEnum.PayIn:
        wallet = db.query(Wallet).filter(Wallet.user_id == wt.user_id).with_for_update().first()
        if not wallet:
            wallet = Wallet(user_id=wt.user_id, balance=0.0)
            db.add(wallet)
            db.flush()
        wallet.balance += float(wt.settle_amount or wt.amount or 0)
    elif wt.transaction_type == TransactionTypeEnum.PayOut:
        from models.models import PayOutWallet
        wallet = db.query(PayOutWallet).filter(PayOutWallet.user_id == wt.user_id).with_for_update().first()
        if not wallet:
            wallet = PayOutWallet(user_id=wt.user_id, balance=0.0)
            db.add(wallet)
            db.flush()
        wallet.balance += float(wt.settle_amount or wt.amount or 0)

    wt.status = "success"
    wt.description = (wt.description or "") + " [Admin: marked success]"
    db.commit()
    return {"success": True, "message": f"Txn {txn_id} marked as success", "new_status": "success"}


def _analytics(db: Session, start: date, end: date, **filters) -> Dict[str, Any]:
    """
    Per-day and window totals for [start, end] (inclusive calendar dates).
    Volumes, fees and *_count use successful transactions; *_total counts every status.
    `filters` are passed to _wallet_txn_filters (user_id, transaction_type, status, search).
    """
    f = _wallet_txn_filters(from_date=start.isoformat(), to_date=end.isoformat(), **filters)
    ok = WalletTransaction.status == "success"
    is_in = WalletTransaction.transaction_type == TransactionTypeEnum.PayIn
    is_out = WalletTransaction.transaction_type == TransactionTypeEnum.PayOut
    fee = func.coalesce(WalletTransaction.charges, 0) + func.coalesce(WalletTransaction.gst, 0)

    def ssum(cond, val):
        return func.coalesce(func.sum(case((cond, val), else_=0)), 0)

    cols = (
        ssum(and_(ok, is_in), WalletTransaction.amount),
        ssum(and_(ok, is_out), WalletTransaction.amount),
        ssum(and_(ok, is_in), 1),
        ssum(and_(ok, is_out), 1),
        ssum(is_in, 1),
        ssum(is_out, 1),
        ssum(ok, fee),
        ssum(ok, 1),
        ssum(ok, WalletTransaction.amount),
        func.count(WalletTransaction.id),
    )
    day = func.date(WalletTransaction.created_at)
    rows = db.query(day, *cols).filter(and_(*f)).group_by(day).all()
    by_day = {str(r[0]): r for r in rows}

    keys = ("payin_volume", "payout_volume", "payin_count", "payout_count", "payin_total", "payout_total", "fees")
    daily = []
    for i in range((end - start).days + 1):
        d = start + timedelta(days=i)
        r = by_day.get(d.isoformat())
        row = {"date": d.isoformat()}
        for k, idx in zip(keys, range(1, 8)):
            row[k] = (float(r[idx]) if k.endswith(("volume", "fees")) else int(r[idx])) if r else 0
        daily.append(row)

    t = db.query(*cols).filter(and_(*f)).one()
    txns, success_count, success_volume, fees = int(t[9] or 0), int(t[7] or 0), float(t[8] or 0), float(t[6] or 0)
    status_rows = (
        db.query(WalletTransaction.status, func.count(WalletTransaction.id))
        .filter(and_(*f))
        .group_by(WalletTransaction.status)
        .all()
    )
    status_counts = {"success": 0, "pending": 0, "failed": 0}
    for st, cnt in status_rows:
        if st in status_counts:
            status_counts[st] = int(cnt)
    active = (
        db.query(func.count(func.distinct(WalletTransaction.user_id))).filter(and_(*f)).scalar() or 0
    )
    return {
        "daily": daily,
        "status": status_counts,
        "totals": {
            "txns": txns,
            "success_count": success_count,
            "success_volume": success_volume,
            "success_rate": round(success_count / txns * 100, 2) if txns else None,
            "avg_txn_size": round(success_volume / success_count, 2) if success_count else None,
            "fees": fees,
            "active_merchants": int(active),
        },
    }


@router.get("/chart-data")
def admin_chart_data(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Daily success volume / counts / fees for the last N days, plus the status breakdown for the same window."""
    end = datetime.now(india_tz).date()
    data = _analytics(db, end - timedelta(days=days - 1), end)
    daily = [
        {
            "date": datetime.fromisoformat(d["date"]).strftime("%d %b"),
            "payin_volume": d["payin_volume"],
            "payout_volume": d["payout_volume"],
            "payin_count": d["payin_count"],
            "payout_count": d["payout_count"],
            "fees": d["fees"],
        }
        for d in data["daily"]
    ]
    return {"daily": daily, "status": data["status"]}


@router.get("/analytics", response_model=Dict[str, Any])
def admin_analytics(
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD; default 29 days before to_date"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD; default today"),
    user_id: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Analytics / report data for a date window: daily series, status breakdown and totals,
    plus `previous` totals for the equally long window right before it.
    """
    today = datetime.now(india_tz).date()
    end = (_parse_date_input(to_date) or datetime.combine(today, datetime.min.time())).date()
    start = (_parse_date_input(from_date) or datetime.combine(end - timedelta(days=29), datetime.min.time())).date()
    if start > end:
        raise HTTPException(status_code=422, detail="from_date must be <= to_date")
    if (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Range is limited to one year")
    filters = dict(user_id=user_id, transaction_type=transaction_type, status=status, search=search)
    cur = _analytics(db, start, end, **filters)
    span = (end - start).days + 1
    prev = _analytics(db, start - timedelta(days=span), start - timedelta(days=1), **filters)
    return {"from_date": start.isoformat(), "to_date": end.isoformat(), **cur, "previous": prev["totals"]}


@router.get("/merchants-list")
def merchants_list(db: Session = Depends(get_db)):
    """Lightweight list of merchant id + username for dropdowns."""
    merchants = (
        db.query(User.id, User.username, User.company_name)
        .filter(User.role == ROLE_MAPPING["merchant"])
        .order_by(User.username)
        .all()
    )
    return [
        {"id": m.id, "username": m.username, "company_name": m.company_name}
        for m in merchants
    ]


@router.get("/report/download")
def download_report(
    merchant_id: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Download filtered transactions as CSV."""
    q = db.query(WalletTransaction)

    if merchant_id:
        q = q.filter(WalletTransaction.user_id == merchant_id)
    if transaction_type:
        q = q.filter(WalletTransaction.transaction_type == transaction_type)
    if status:
        q = q.filter(WalletTransaction.status == status)
    if date_from:
        q = q.filter(WalletTransaction.created_at >= date_from)
    if date_to:
        q = q.filter(WalletTransaction.created_at <= date_to + "T23:59:59")

    items = q.order_by(WalletTransaction.created_at.desc()).limit(10000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Merchant", "Type", "Credit/Debit", "Order ID", "Status",
        "Amount", "Charges", "GST", "Settle Amount", "Balance",
        "Txn ID", "UTR", "Created At",
    ])
    for t in items:
        writer.writerow([
            t.id,
            t.user_id,
            t.transaction_type.value if t.transaction_type else "",
            t.credit_debit.value if t.credit_debit else "",
            t.order_id or "",
            t.status or "",
            t.amount,
            t.charges or 0,
            t.gst or 0,
            t.settle_amount or 0,
            t.balance_amount or 0,
            t.txn_id or "",
            t.utr or "",
            t.created_at.isoformat() if t.created_at else "",
        ])

    output.seek(0)
    filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _bank_account_query(
    db: Session,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    bank_name: Optional[str] = None,
    search: Optional[str] = None,
):
    """Payout bank accounts joined with their merchant; status is pending | approved | all."""
    q = db.query(PayoutBankAccount, User).outerjoin(User, User.id == PayoutBankAccount.user_id)
    if status == "pending":
        q = q.filter(PayoutBankAccount.is_validate == False)  # noqa: E712
    elif status == "approved":
        q = q.filter(PayoutBankAccount.is_validate == True)  # noqa: E712
    elif status not in (None, "", "all"):
        raise HTTPException(status_code=422, detail="status must be pending, approved or all")
    if user_id:
        q = q.filter(PayoutBankAccount.user_id == user_id)
    if bank_name:
        q = q.filter(PayoutBankAccount.bank_name == bank_name)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                PayoutBankAccount.account_holder_name.ilike(term),
                PayoutBankAccount.account_number.ilike(term),
                PayoutBankAccount.ifsc_code.ilike(term),
                PayoutBankAccount.user_id.ilike(term),
                User.username.ilike(term),
                User.company_name.ilike(term),
            )
        )
    return q


def _serialize_bank_account(a: PayoutBankAccount, u: Optional[User]) -> Dict[str, Any]:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "merchant_username": u.username if u else None,
        "merchant_company": u.company_name if u else None,
        "account_holder_name": a.account_holder_name,
        "account_number": a.account_number,
        "ifsc_code": a.ifsc_code,
        "bank_name": a.bank_name,
        "bank_branch": a.bank_branch,
        "account_type": a.account_type,
        "bank_address": a.bank_address,
        "is_validate": a.is_validate,
    }


@router.get("/bank-accounts")
def list_bank_accounts(
    status: Optional[str] = Query("pending", description="pending | approved | all"),
    user_id: Optional[str] = Query(None),
    bank_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="holder, account no, IFSC, merchant id/name/company"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = _bank_account_query(db, status, user_id, bank_name, search)
    total = q.count()
    rows = q.order_by(PayoutBankAccount.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": [_serialize_bank_account(a, u) for a, u in rows]}


@router.get("/bank-accounts/pending")
def list_pending_bank_accounts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return list_bank_accounts(status="pending", user_id=None, bank_name=None, search=None, page=page, per_page=per_page, db=db)


@router.get("/bank-accounts/stats")
def bank_account_stats(db: Session = Depends(get_db)):
    """Counts for the Bank Approval page and the bank names used in its filter."""
    pending = db.query(func.count(PayoutBankAccount.id)).filter(PayoutBankAccount.is_validate == False).scalar() or 0  # noqa: E712
    approved = db.query(func.count(PayoutBankAccount.id)).filter(PayoutBankAccount.is_validate == True).scalar() or 0  # noqa: E712
    merchants = db.query(func.count(func.distinct(PayoutBankAccount.user_id))).scalar() or 0
    banks = [
        b for (b,) in db.query(PayoutBankAccount.bank_name)
        .filter(PayoutBankAccount.bank_name.isnot(None), PayoutBankAccount.bank_name != "")
        .distinct().order_by(PayoutBankAccount.bank_name).all()
    ]
    return {"pending": int(pending), "approved": int(approved), "total": int(pending + approved), "merchants": int(merchants), "banks": banks}


@router.get("/bank-accounts/export")
def export_bank_accounts(
    status: Optional[str] = Query("pending"),
    user_id: Optional[str] = Query(None),
    bank_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """CSV of bank accounts matching the filters (max 10,000 rows)."""
    rows = _bank_account_query(db, status, user_id, bank_name, search).order_by(PayoutBankAccount.id.desc()).limit(10000).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Merchant ID", "Merchant", "Company", "Account Holder", "Account Number", "IFSC", "Bank", "Branch", "Type", "Status"])
    for a, u in rows:
        writer.writerow([
            a.id, a.user_id, u.username if u else "", u.company_name if u else "", a.account_holder_name,
            a.account_number, a.ifsc_code, a.bank_name or "", a.bank_branch or "", a.account_type or "",
            "approved" if a.is_validate else "pending",
        ])
    output.seek(0)
    filename = f"bank_accounts_{status or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.post("/bank-accounts/{account_id}/approve")
def approve_bank_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(PayoutBankAccount).filter(PayoutBankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    account.is_validate = True
    db.commit()
    return {"success": True, "message": f"Bank account {account_id} approved"}


@router.post("/bank-accounts/{account_id}/reject")
def reject_bank_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(PayoutBankAccount).filter(PayoutBankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    db.delete(account)
    db.commit()
    return {"success": True, "message": f"Bank account {account_id} rejected and removed"}


def list_my_transactions_new(
    db: Session,
    user_id: Optional[str] = None,  # merchant id passed from route
    filters: Optional[WalletTransactionFilter] = None,
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "created_at",
    sort_desc: bool = True,
) -> Tuple[list, int]:
    """
    Return (items, total) applying merchant/user filter and other filters.
    """

    # Start base query
    q = db.query(WalletTransaction)

    # Apply merchant/user filter explicitly (only if provided)
    # Adjust WalletTransaction.user_id -> WalletTransaction.merchant_id if your model uses that
    if user_id:
        q = q.filter(WalletTransaction.user_id == user_id)

    # Apply filters (if provided)
    if filters:
        if filters.transaction_type:
            q = q.filter(WalletTransaction.transaction_type == filters.transaction_type)
        if filters.credit_debit:
            q = q.filter(WalletTransaction.credit_debit == filters.credit_debit)
        if filters.status:
            q = q.filter(WalletTransaction.status == filters.status)
        if filters.min_amount is not None:
            q = q.filter(WalletTransaction.amount >= filters.min_amount)
        if filters.max_amount is not None:
            q = q.filter(WalletTransaction.amount <= filters.max_amount)
        if filters.date_from:
            # date_from considered inclusive at midnight
            q = q.filter(WalletTransaction.created_at >= filters.date_from)
        if filters.date_to:
            # include whole date_to day: set to end of day if a date (optional)
            # If filters.date_to is a datetime already, use it directly
            dt_to = filters.date_to
            if isinstance(dt_to, datetime) and dt_to.time() == datetime.min.time():
                dt_to = dt_to + timedelta(days=1) - timedelta(microseconds=1)
            q = q.filter(WalletTransaction.created_at <= dt_to)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            q = q.filter(
                or_(
                    WalletTransaction.order_id.ilike(term),
                    WalletTransaction.txn_id.ilike(term),
                    WalletTransaction.reference.ilike(term),
                )
            )

    # Count before limit/offset
    total = q.with_entities(func.count()).scalar() or 0

    # Safe sort: whitelist allowed columns to avoid SQL injection
    sort_map = {
        "created_at": WalletTransaction.created_at,
        "amount": WalletTransaction.amount,
        "id": WalletTransaction.id,
        "transaction_type": WalletTransaction.transaction_type,
    }
    sort_col = sort_map.get(sort_by, WalletTransaction.created_at)
    order_clause = desc(sort_col) if sort_desc else asc(sort_col)

    # Pagination
    offset = (max(1, page) - 1) * per_page
    items = q.order_by(order_clause).offset(offset).limit(per_page).all()

    return items, total


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
    merchant_id:Optional[str] =Query(None),
    db: Session = Depends(get_db),

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

    items, total = list_my_transactions_new(
        db=db,
        user_id=merchant_id,  # make sure merchant_id contains the actual merchant/user id
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


def _settled_filters(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    txn_type: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
) -> list:
    """Filters shared by the settlement list and its stats (dates apply to created_date)."""
    f = []
    if status:
        f.append(TransactionSettled.status == status)
    if user_id:
        f.append(TransactionSettled.user_id == user_id)
    if txn_type:
        f.append(TransactionSettled.txn_type == txn_type)
    if min_amount is not None:
        f.append(TransactionSettled.amount >= float(min_amount))
    if max_amount is not None:
        f.append(TransactionSettled.amount <= float(max_amount))
    fd = _parse_date_input(from_date)
    td = _parse_date_input(to_date)
    if fd:
        f.append(TransactionSettled.created_date >= fd)
    if td:
        if to_date and len(to_date.strip()) == 10:
            td = td + timedelta(days=1) - timedelta(microseconds=1)
        f.append(TransactionSettled.created_date <= td)
    if search:
        f.append(TransactionSettled.txn_id.ilike(f"%{search}%"))
    return f


@router.get("/settled", response_model=List[TransactionSettledOut])
def list_transaction_settled(db: Session = Depends(get_db),
                             page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=200),
                             status: Optional[str] = None,
                             user_id: Optional[str] = None,
                             txn_type: Optional[str] = Query(None, description="debit = withdrawal requests, credit = top-up ledger"),
                             min_amount: Optional[float] = None,
                             max_amount: Optional[float] = None,
                             from_date: Optional[str] = Query(None, description="YYYY-MM-DD, on created_date"),
                             to_date: Optional[str] = Query(None, description="YYYY-MM-DD, on created_date"),
                             search: Optional[str] = None):
    q = db.query(TransactionSettled)
    f = _settled_filters(status, user_id, txn_type, min_amount, max_amount, from_date, to_date, search)
    if f:
        q = q.filter(and_(*f))
    q = q.order_by(TransactionSettled.created_date.desc())
    items = q.offset((page-1)*per_page).limit(per_page).all()
    return items


@router.get("/settled/stats", response_model=Dict[str, Any])
def settled_stats(db: Session = Depends(get_db),
                  status: Optional[str] = None,
                  user_id: Optional[str] = None,
                  txn_type: Optional[str] = None,
                  min_amount: Optional[float] = None,
                  max_amount: Optional[float] = None,
                  from_date: Optional[str] = None,
                  to_date: Optional[str] = None,
                  search: Optional[str] = None,
                  current_user: User = Depends(admin_required)):
    """
    Numbers for the admin Settlements page.
      total            – rows matching the filters (for pagination)
      pending          – pending requests (merchant/type filters only)
      approved_month / rejected_month / settled_amount_month / settled_amount_last_month
                       – calendar-month figures by created_date
      daily            – last 14 days: approved, rejected, pending counts and settled amount
    """
    def base(extra: list):
        f = _settled_filters(None, user_id, txn_type) + extra
        return db.query(TransactionSettled).filter(and_(*f)) if f else db.query(TransactionSettled)

    listed = _settled_filters(status, user_id, txn_type, min_amount, max_amount, from_date, to_date, search)
    total = (db.query(func.count(TransactionSettled.id)).filter(and_(*listed)).scalar()
             if listed else db.query(func.count(TransactionSettled.id)).scalar()) or 0

    now = datetime.now(india_tz).replace(tzinfo=None)
    month_start = datetime(now.year, now.month, 1)
    last_month_start = datetime(now.year - 1, 12, 1) if now.month == 1 else datetime(now.year, now.month - 1, 1)
    in_month = [TransactionSettled.created_date >= month_start]
    in_last = [TransactionSettled.created_date >= last_month_start, TransactionSettled.created_date < month_start]

    def count(extra):
        return int(base(extra).with_entities(func.count(TransactionSettled.id)).scalar() or 0)

    def amount(extra):
        return float(base(extra).with_entities(func.coalesce(func.sum(TransactionSettled.amount), 0)).scalar() or 0)

    ok = TransactionSettled.status == "success"
    bad = TransactionSettled.status == "failed"
    pend = TransactionSettled.status == "pending"

    day0 = datetime(now.year, now.month, now.day) - timedelta(days=13)
    daily = []
    for i in range(14):
        ds, de = day0 + timedelta(days=i), day0 + timedelta(days=i + 1)
        rng = [TransactionSettled.created_date >= ds, TransactionSettled.created_date < de]
        daily.append({
            "date": ds.date().isoformat(),
            "approved": count(rng + [ok]),
            "rejected": count(rng + [bad]),
            "pending": count(rng + [pend]),
            "settled_amount": amount(rng + [ok]),
        })

    return {
        "total": int(total),
        "pending": count([pend]),
        "approved_month": count(in_month + [ok]),
        "rejected_month": count(in_month + [bad]),
        "settled_amount_month": amount(in_month + [ok]),
        "settled_amount_last_month": amount(in_last + [ok]),
        "daily": daily,
    }


def _set_timestamp_if_exists(obj, attr_name: str):
    if hasattr(obj, attr_name):
        try:
            setattr(obj, attr_name, datetime.now(india_tz))
        except Exception:
            setattr(obj, attr_name, datetime.now())


# @router.post("/{txn_id}/approve", response_model=Dict[str, Any])
# async def settle_approved(
#     txn_id: str = Path(..., description="Settlement id (e.g. SETTLE-...)"),
#     db: Session = Depends(get_db),
# ):
#     """
#     Approve a settlement: mark both TransactionSettled.status and
#     WalletTransaction.status as 'success'.
#     """
#     ts = db.query(TransactionSettled).filter(TransactionSettled.txn_id == txn_id).first()
#     wt = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_id).first()
#     #account = db.query(PayoutBankAccount).filter(PayoutBankAccount.id==int(wt.reference_id)).first()
#     if not ts or not wt:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settlement or wallet transaction not found")
#
#     target_status = "success"
#
#     # Idempotent: if both already in target status, return 200
#     if (ts.status == target_status) and (wt.status == target_status):
#         return {"txn_id": txn_id, "status": target_status, "message": "Already approved"}
#
#     try:
#         account = db.query(PayoutBankAccount).filter(PayoutBankAccount.id == int(wt.reference_id)).first()
#         if not account:
#             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
#                                 detail="Account Number not found")
#         timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
#         async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
#             token = await _login(client)
#         payload = {
#             "amount": wt.amount,
#             "ifsc": account.ifsc_code,
#             "accountno": account.account_number,
#             "name": account.account_holder_name,
#             "branch": account.bank_branch,
#             "paymode": "IMPS",  # ensure one of IMPS/NEFT/RTGS
#             "remarks": "PayOut",
#             "mode": "bank",  # 'bank'
#         }
#         # Drop None values
#         payload = {k: v for k, v in payload.items() if v is not None}
#
#         raw = await _transfer(client, token, payload)
#         success = raw.get("success") if isinstance(raw, dict) else None
#         message = raw.get("message") or raw.get("msg") or raw.get("error")
#         if not success:
#             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
#                                 detail=message or "Somwthing Went Wrong")
#         ts.status = target_status
#         wt.status = target_status
#
#         # update timestamps if your models have them
#
#         _set_timestamp_if_exists(ts, "settled_date")
#
#         db.add(ts)
#         db.add(wt)
#         db.commit()
#     except Exception as exc:
#         db.rollback()
#         raise HTTPException(status_code=500, detail=f"Failed to approve settlement: {str(exc)}")
#
#     return {"txn_id": txn_id, "status": target_status, "message": "Settlement approved"}
def _to_decimal_string(value: Any) -> str:
    """
    Normalize amount (DB may store Decimal/str/float). Returns a plain decimal string.
    """
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Invalid amount value in wallet transaction")
    if d <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Amount must be greater than 0")
    return format(d, "f")  # no scientific notation

def _boolish_success(raw: Dict[str, Any]) -> bool:
    """
    Interprets common success fields from upstream (success/status/message…).
    """
    if not isinstance(raw, dict):
        return False
    # Common patterns
    if isinstance(raw.get("success"), bool):
        return raw["success"]
    if isinstance(raw.get("status"), bool):
        return raw["status"]
    if isinstance(raw.get("status"), str):
        return raw["status"].lower() in {"success", "ok", "completed"}
    if isinstance(raw.get("code"), int):
        return 200 <= raw["code"] < 300
    return False

@router.post("/{txn_id}/approve", response_model=Dict[str, Any])
async def settle_approved(
    txn_id: str = Path(..., description="Settlement id (e.g. SETTLE-...)"),
    db: Session = Depends(get_db),
):
    """
    Approve a settlement: mark both TransactionSettled.status and
    WalletTransaction.status as 'success'. Also triggers UniversePay /transfer.
    Idempotent: if already success, returns 409 with message (or change to 200 if you prefer).
    """
    # 1) Load records
    ts = (
        db.query(TransactionSettled)
        .filter(TransactionSettled.txn_id == txn_id)
        .first()
    )
    wt = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.order_id == txn_id)
        .first()
    )

    if not ts or not wt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settlement or wallet transaction not found",
        )

    target_status = "success"

    # 2) Idempotency: already approved?
    if (ts.status == target_status) and (wt.status == target_status):
        # return 409 to indicate “already in desired state”
        return {
            "txn_id": txn_id,
            "status": target_status,
            "message": "Already approved",
            "idempotent": True,
        }

    # 3) Resolve payout account from reference_id safely
    try:
        ref_id = int(str(wt.reference_id).strip())
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid reference_id on wallet transaction",
        )

    account = (
        db.query(PayoutBankAccount)
        .filter(PayoutBankAccount.id == ref_id)
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payout bank account not found",
        )
    # never pay out to an account that isn't the merchant's own verified account
    if account.user_id != wt.user_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Bank account does not belong to this merchant")
    if not account.is_validate:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Bank account is not verified")

    # 4) Prepare UniversePay payload
    payload = {
        "amount": wt.amount,
        "ifsc": (account.ifsc_code).upper(),
        "accountno": account.account_number,
        "name": account.account_holder_name,
        "branch": account.bank_branch,
        "paymode": "IMPS",  # or pull from account.preferred_mode if you have it
        "remarks": "PayOut",
        "mode": "bank",
    }
    # Drop None/empty values
    payload = {k: v for k, v in payload.items() if v not in (None, "", [])}

    # Minimal field checks (since these are derived from DB, still good to sanity-check)
    if len(payload.get("ifsc", "")) != 11:
        raise HTTPException(status_code=422, detail="IFSC must be 11 characters")
    if not payload.get("accountno") or not str(payload["accountno"]).isdigit():
        raise HTTPException(status_code=422, detail="Account number must be numeric")

    # 5) Call UniversePay within the same client context
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
        token = await _login(client)
        raw = await _transfer(client, token, payload)

    # 6) Interpret upstream result

    txn_status = None
    if isinstance(raw, dict):
        txn_status = (
            raw.get("data", {})
            .get("data", {})
            .get("status")
        )
    if txn_status not in ("Completed", "Initiated"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": f"Transfer failed with status: {txn_status or 'Unknown'}",
                "payload": payload,  # what you sent to UniversePay
                "raw": raw  # what UniversePay returned
            }
        )

    # 7) Persist changes atomically
    try:
        # If you have timestamp fields, set them here
        # e.g., _set_timestamp_if_exists(ts, "settled_date")
        ts.status = target_status
        ts.settled_date = datetime.now(india_tz)  # record when it was actually paid out
        wt.status = target_status

        db.add(ts)
        db.add(wt)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to approve settlement in DB: {str(exc)}"
        )

    # 8) Return success + upstream echo
    return {
        "txn_id": txn_id,
        "status": target_status,
        "message": "Settlement approved",
        "universepay": raw,
    }

@router.post("/{txn_id}/reject", response_model=Dict[str, Any])
def settle_reject(
    txn_id: str = Path(..., description="Settlement id (e.g. SETTLE-...)"),
    db: Session = Depends(get_db),
):
    """
    Reject a settlement: mark both TransactionSettled.status and
    WalletTransaction.status as 'rejected'.
    """
    ts = db.query(TransactionSettled).filter(TransactionSettled.txn_id == txn_id).first()
    wt = db.query(WalletTransaction).filter(WalletTransaction.order_id == txn_id).first()

    if not ts or not wt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settlement or wallet transaction not found")

    target_status = "failed"

    # Idempotent:
    if (ts.status == target_status) and (wt.status == target_status):
        return {"txn_id": txn_id, "status": target_status, "message": "Already rejected"}

    try:
        ts.status = target_status
        wt.status = target_status

        # update timestamps if your models have them

        db.add(ts)
        db.add(wt)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reject settlement: {str(exc)}")

    return {"txn_id": txn_id, "status": target_status, "message": "Settlement rejected"}

@router.get("/settings/{merchant_id}", response_model=MerchantSettingsOut)
def get_merchant_settings(merchant_id: str, db: Session = Depends(get_db)):
    """
    Retrieve merchant settings by merchant user id.
    """
    settings = db.query(MerchantSettings).filter(MerchantSettings.id == merchant_id).first()
    if not settings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant settings not found")
    return settings


@router.post("/settings", response_model=MerchantSettingsOut, status_code=status.HTTP_201_CREATED)
def create_merchant_settings(payload: MerchantSettingsCreate, db: Session = Depends(get_db)):
    """
    Create MerchantSettings for a merchant (merchant id must exist in users table and settings must not already exist).
    """
    # 1) Ensure merchant user exists
    user = db.query(User).filter(User.id == payload.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User (merchant) does not exist")

    # 2) Ensure no settings exist for this merchant (id is primary key/unique)
    existing = db.query(MerchantSettings).filter(MerchantSettings.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Merchant settings already exist")

    # 3) Create
    new_settings = MerchantSettings(
        id=payload.id,
        payInCharges=payload.payInCharges,
        payOutCharges=payload.payOutCharges,
        payOutChargesFlat=payload.payOutChargesFlat,
        webhook=payload.webhook,
        ip=payload.ip,
    )
    db.add(new_settings)
    db.commit()
    db.refresh(new_settings)
    return new_settings


@router.put("/settings/{merchant_id}", response_model=MerchantSettingsOut)
def update_merchant_settings(merchant_id: str, payload: MerchantSettingsUpdate, db: Session = Depends(get_db)):
    """
    Update merchant settings. Creates settings if they don't exist yet.
    """
    settings = db.query(MerchantSettings).filter(MerchantSettings.id == merchant_id).first()

    if not settings:
        # Auto-create settings if merchant exists
        user = db.query(User).filter(User.id == merchant_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")
        update_fields = payload.dict(exclude_unset=True)
        update_fields.setdefault("payInCharges", 0.0)
        update_fields.setdefault("payOutCharges", 0.0)
        update_fields.setdefault("payOutChargesFlat", 0.0)
        settings = MerchantSettings(id=merchant_id, **update_fields)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings

    # Apply updates (only fields provided)
    update_fields = payload.dict(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(settings, field, value)

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings

@router.post("/transfer", response_model=TransferResponse)
def transfer_between_wallets_simple(payload: TransferRequest, db: Session = Depends(get_db)):
    """
    Simple (no with db.begin()) transfer.
    - direction: "to_payout" moves from Wallet -> PayOutWallet.
                 "to_wallet" moves from PayOutWallet -> Wallet.
    - amount None means transfer full source balance (toggle).
    """
    # 1) basic validations
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # 2) fetch wallets (create if missing)
    wallet = db.query(Wallet).filter(Wallet.user_id == payload.user_id).first()
    payout = db.query(PayOutWallet).filter(PayOutWallet.user_id == payload.user_id).first()

    if not wallet:
        wallet = Wallet(user_id=payload.user_id, balance=0.0)
        db.add(wallet)
    if not payout:
        payout = PayOutWallet(user_id=payload.user_id, balance=0.0)
        db.add(payout)

    # flush so balances are available
    db.flush()
    db.refresh(wallet)
    db.refresh(payout)

    # 3) determine source and target
    if payload.direction == "to_payout":
        source = wallet
        target = payout
        source_name = "wallet"
        target_name = "payout_wallet"
    else:
        source = payout
        target = wallet
        source_name = "payout_wallet"
        target_name = "wallet"

    # 4) determine transfer amount
    if payload.amount is None:
        transfer_amount = float(source.balance)
    else:
        transfer_amount = float(payload.amount)
        if transfer_amount > float(source.balance):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient funds in source wallet")

    if transfer_amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer amount must be > 0")

    # 5) apply changes and commit
    try:
        # update balances
        new_source_balance = float(source.balance) - transfer_amount
        # guard against tiny negatives
        if abs(new_source_balance) < 1e-9:
            new_source_balance = 0.0

        source.balance = new_source_balance
        target.balance = float(target.balance) + transfer_amount

        # optional: update last_updated consistent with your timezone settings
        from datetime import datetime
        try:
            # if you use india_tz in your models, import it
            from models import india_tz
            now = datetime.now(india_tz)
        except Exception:
            now = datetime.now()
        # set last_updated if those columns exist on the instances
        if hasattr(source, "last_updated"):
            source.last_updated = now
        if hasattr(target, "last_updated"):
            target.last_updated = now

        # persist
        db.add(source)
        db.add(target)

        # optionally: create WalletTransaction here for audit trail
        # from models import WalletTransaction
        # tx = WalletTransaction(user_id=payload.user_id, amount=transfer_amount, ...)
        # db.add(tx)

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(exc)}")

    # 6) refresh and return
    db.refresh(wallet)
    db.refresh(payout)

    return TransferResponse(
        user_id=payload.user_id,
        transferred_amount=transfer_amount,
        wallet_balance=float(wallet.balance),
        payout_wallet_balance=float(payout.balance),
        message=f"Transferred {transfer_amount} from {source_name} to {target_name}"
    )


@router.post("/wallet-adjust", response_model=TransferResponse)
def adjust_wallet_balance(payload: WalletAdjustRequest, db: Session = Depends(get_db)):
    """
    Admin: increase or decrease a merchant's wallet or payout wallet balance.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wallet = db.query(Wallet).filter(Wallet.user_id == payload.user_id).first()
    payout = db.query(PayOutWallet).filter(PayOutWallet.user_id == payload.user_id).first()

    if not wallet:
        wallet = Wallet(user_id=payload.user_id, balance=0.0)
        db.add(wallet)
    if not payout:
        payout = PayOutWallet(user_id=payload.user_id, balance=0.0)
        db.add(payout)
    db.flush()

    target = wallet if payload.wallet_type == "wallet" else payout
    target_name = "wallet" if payload.wallet_type == "wallet" else "payout_wallet"

    if payload.action == "increase":
        target.balance = float(target.balance) + payload.amount
        msg = f"Added ₹{payload.amount} to {target_name}"
    else:
        if payload.amount > float(target.balance):
            raise HTTPException(status_code=400, detail=f"Insufficient {target_name} balance")
        target.balance = float(target.balance) - payload.amount
        msg = f"Deducted ₹{payload.amount} from {target_name}"

    db.commit()
    db.refresh(wallet)
    db.refresh(payout)

    return TransferResponse(
        user_id=payload.user_id,
        transferred_amount=payload.amount,
        wallet_balance=float(wallet.balance),
        payout_wallet_balance=float(payout.balance),
        message=msg,
    )


@router.post("/admin-payout", response_model=PayoutResponse)
async def payout(req: PayoutRequest):
    """
    Auto-login with stored credentials and perform bank transfer via UniversePay /transfer.
    """
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, http2=True) as client:
        token = await _login(client)

        # Map validated model -> upstream payload
        payload = {
            "amount": req.amount,
            "ifsc": req.ifsc,
            "accountno": req.accountno,
            "name": req.name.strip(),
            "branch": (req.branch or "").strip() or None,
            "paymode": req.paymode.value,   # ensure one of IMPS/NEFT/RTGS
            "remarks": (req.remarks or "").strip() or None,
            "mode": req.mode,               # 'bank'
        }
        # Drop None values
        payload = {k: v for k, v in payload.items() if v is not None}

        raw = await _transfer(client, token, payload)

    # Normalize a few common fields but always return raw too
    success = raw.get("success") if isinstance(raw, dict) else None
    status = raw.get("status") if isinstance(raw, dict) else None
    message = None
    if isinstance(raw, dict):
        message = raw.get("message") or raw.get("msg") or raw.get("error")

    return PayoutResponse(success=success, status=status, message=message,
                          data=raw.get("data") if isinstance(raw, dict) else None,
                          raw=raw)



@router.post("/admin/display-account", response_model=DisplayAccountOut)
def create_display_account(payload: DisplayAccountCreate, db: Session = Depends(get_db)):
    acct = DisplayAccount(
        account_holder_name=payload.account_holder_name,
        beneficiary_account_number=payload.beneficiary_account_number,
        beneficiary_ifsc=payload.beneficiary_ifsc,
        beneficiary_bank_name=payload.beneficiary_bank_name,
        is_validate=payload.is_validate
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct

@router.get("/admin/display-account", response_model=list[DisplayAccountOut])
def list_display_accounts(db: Session = Depends(get_db)):
    return db.query(DisplayAccount).order_by(DisplayAccount.id.desc()).all()

@router.get("/admin/display-account/{id}", response_model=DisplayAccountOut)
def get_display_account(id: int, db: Session = Depends(get_db)):
    acct = db.get(DisplayAccount, id)
    if not acct:
        raise HTTPException(404, "Not found")
    return acct

@router.patch("/admin/display-account/{id}", response_model=DisplayAccountOut)
def update_display_account(id: int, payload: DisplayAccountCreate, db: Session = Depends(get_db)):
    acct = db.get(DisplayAccount, id)
    if not acct:
        raise HTTPException(404, "Not found")
    acct.beneficiary_account_number = payload.beneficiary_account_number
    acct.beneficiary_ifsc = payload.beneficiary_ifsc
    acct.beneficiary_bank_name = payload.beneficiary_bank_name
    acct.is_validate = payload.is_validate
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct

@router.delete("/admin/display-account/{id}", status_code=204)
def delete_display_account(id: int, db: Session = Depends(get_db)):
    acct = db.get(DisplayAccount, id)
    if not acct:
        raise HTTPException(404, "Not found")
    db.delete(acct)
    db.commit()
    return {}


def _safe_user_dict(user):
    if not user:
        return None
    return {
        "id": user.id,
        "username": getattr(user, "username", None),
        "email": getattr(user, "email", None),
        "full_name": getattr(user, "full_name", None),
        "phone_number": getattr(user, "phone_number", None),
        "created_at": getattr(user, "created_at", None),
        "role": getattr(user, "role", None),
        "company_name": getattr(user, "company_name", None),
        "user_token": getattr(user, "user_token", None),
        "kyc_verified": getattr(user, "kyc_verified", None),
    }

def _serialize_topup(topup, verified_by_user=None):
    return {
        "id": topup.id,
        "user_id": topup.user_id,
        "payer_name": topup.payer_name,
        "payer_account_number": topup.payer_account_number,
        "payer_vpa_or_number": topup.payer_vpa_or_number,
        "payer_bank_name": topup.payer_bank_name,
        "beneficiary_account_number": topup.beneficiary_account_number,
        "beneficiary_ifsc": topup.beneficiary_ifsc,
        "beneficiary_bank_name": topup.beneficiary_bank_name,
        "amount": topup.amount,
        "instrument": topup.instrument.value if hasattr(topup.instrument, "value") else str(topup.instrument),
        "utr_or_txn_id": topup.utr_or_txn_id,
        "reference_note": topup.reference_note,
        "receipt_url": topup.receipt_url,
        "receipt_mime": topup.receipt_mime,
        "status": topup.status.value if hasattr(topup.status, "value") else str(topup.status),
        "created_at": topup.created_at,
        "updated_at": topup.updated_at,
        "verified_by": topup.verified_by,
        "verified_at": topup.verified_at,
        "admin_notes": topup.admin_notes,
        # relationships (safe)
        "user": _safe_user_dict(topup.user) if hasattr(topup, "user") else None,
        "verified_by_user": _safe_user_dict(verified_by_user) if verified_by_user else None,
    }

# Generic query builder for topups
def _build_topup_query(db: Session,
                       status_filter: Optional[TopUpStatusEnum] = None,
                       user_id: Optional[str] = None,
                       min_amount: Optional[float] = None,
                       max_amount: Optional[float] = None,
                       payer_name: Optional[str] = None,
                       utr_or_txn_id: Optional[str] = None,
                       instrument: Optional[str] = None,
                       date_from: Optional[datetime] = None,
                       date_to: Optional[datetime] = None):
    q = db.query(PayoutTopUp)
    if status_filter:
        q = q.filter(PayoutTopUp.status == status_filter)
    if user_id:
        q = q.filter(PayoutTopUp.user_id == user_id)
    if min_amount is not None:
        q = q.filter(PayoutTopUp.amount >= float(min_amount))
    if max_amount is not None:
        q = q.filter(PayoutTopUp.amount <= float(max_amount))
    if payer_name:
        q = q.filter(PayoutTopUp.payer_name.ilike(f"%{payer_name}%"))
    if utr_or_txn_id:
        q = q.filter(PayoutTopUp.utr_or_txn_id.ilike(f"%{utr_or_txn_id}%"))
    if instrument:
        # allow either enum value or raw string
        try:
            inst_enum = TopUpInstrumentEnum(instrument)
            q = q.filter(PayoutTopUp.instrument == inst_enum)
        except Exception:
            q = q.filter(PayoutTopUp.instrument.ilike(f"%{instrument}%"))
    if date_from:
        q = q.filter(PayoutTopUp.created_at >= date_from)
    if date_to:
        q = q.filter(PayoutTopUp.created_at <= date_to)
    q = q.order_by(PayoutTopUp.created_at.desc())
    return q

# Replace the pending endpoint
@router.get("/admin/topup/pending")
def list_pending_topups(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    user_id: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None, ge=0),
    max_amount: Optional[float] = Query(None, ge=0),
    payer_name: Optional[str] = Query(None),
    utr_or_txn_id: Optional[str] = Query(None),
    instrument: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None)
):
    """
    Paginated list of pending topups with optional filters.
    Response: { total, page, per_page, items: [...] }
    Each item contains `user` and `verified_by_user` (if applicable) with safe fields.
    """
    q = _build_topup_query(
        db,
        status_filter=TopUpStatusEnum.pending,
        user_id=user_id,
        min_amount=min_amount,
        max_amount=max_amount,
        payer_name=payer_name,
        utr_or_txn_id=utr_or_txn_id,
        instrument=instrument,
        date_from=date_from,
        date_to=date_to,
    )

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    # fetch verified_by users in bulk to avoid N+1 (even though pending typically has none)
    verified_by_ids = {i.verified_by for i in items if i.verified_by}
    verified_users = {}
    if verified_by_ids:
        rows = db.query(User).filter(User.id.in_(list(verified_by_ids))).all()
        verified_users = {u.id: u for u in rows}

    result = [_serialize_topup(t, verified_by_user=verified_users.get(t.verified_by)) for t in items]

    return {"total": total, "page": page, "per_page": per_page, "items": result}


# Replace the verified endpoint
@router.get("/admin/topup/verified")
def list_verified_topups(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    user_id: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None, ge=0),
    max_amount: Optional[float] = Query(None, ge=0),
    payer_name: Optional[str] = Query(None),
    utr_or_txn_id: Optional[str] = Query(None),
    instrument: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None)
):
    """
    Paginated list of verified topups with optional filters.
    """
    q = _build_topup_query(
        db,
        status_filter=TopUpStatusEnum.verified,
        user_id=user_id,
        min_amount=min_amount,
        max_amount=max_amount,
        payer_name=payer_name,
        utr_or_txn_id=utr_or_txn_id,
        instrument=instrument,
        date_from=date_from,
        date_to=date_to,
    )

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    # fetch verified_by users in bulk
    verified_by_ids = {i.verified_by for i in items if i.verified_by}
    verified_users = {}
    if verified_by_ids:
        rows = db.query(User).filter(User.id.in_(list(verified_by_ids))).all()
        verified_users = {u.id: u for u in rows}

    result = [_serialize_topup(t, verified_by_user=verified_users.get(t.verified_by)) for t in items]

    return {"total": total, "page": page, "per_page": per_page, "items": result}


@router.post("/admin/topup/{topup_id}/approve")
def approve_topup(topup_id: int, admin_user=Depends(admin_required), db: Session = Depends(get_db)):
    try:
        # lock the topup row
        topup = (
            db.query(PayoutTopUp)
            .with_for_update()
            .filter(PayoutTopUp.id == topup_id)
            .one_or_none()
        )
        if not topup:
            raise HTTPException(404, "Top-up not found")
        if topup.status != TopUpStatusEnum.pending:
            raise HTTPException(400, "Top-up already processed")

        # lock or create payout wallet for user
        wallet = (
            db.query(PayOutWallet)
            .with_for_update()
            .filter(PayOutWallet.user_id == topup.user_id)
            .one_or_none()
        )
        if not wallet:
            wallet = PayOutWallet(user_id=topup.user_id, balance=0.0)
            db.add(wallet)
            db.flush()

        # credit wallet
        wallet.balance = (wallet.balance or 0.0) + float(topup.amount)
        wallet.last_updated = datetime.now()

        # mark topup verified
        topup.status = TopUpStatusEnum.verified
        topup.verified_by = admin_user.id
        topup.verified_at = datetime.now()

        # create TransactionSettled record (ledger)
        txn_id = topup.utr_or_txn_id or f"TOPUP-{topup.id}"
        settled = TransactionSettled(
            txn_id=txn_id,
            amount=topup.amount,
            status="success",
            txn_type="credit",
            settled_date=datetime.now(),
            user_id=topup.user_id,
        )
        db.add(settled)

        # create WalletTransaction for audit trail
        wt = WalletTransaction(
            user_id=topup.user_id,
            transaction_type="PayOut",
            credit_debit="credit",
            amount=topup.amount,
            status="success",
            txn_id=txn_id,
            description=f"Top-up via admin approved UTR:{topup.utr_or_txn_id or 'n/a'}",
        )
        db.add(wt)

        # commit all
        db.commit()
        db.refresh(wallet)

        return {
            "success": True,
            "message": "Topup approved and wallet credited",
            "wallet_balance": wallet.balance,
        }

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(500, f"DB error: {e}")

@router.post("/admin/topup/{topup_id}/reject")
def reject_topup(topup_id: int, reason: str = Form(...), admin_user = Depends(admin_required), db: Session = Depends(get_db)):
    topup = db.query(PayoutTopUp).filter(PayoutTopUp.id == topup_id).one_or_none()
    if not topup:
        raise HTTPException(404, "Top-up not found")
    if topup.status != TopUpStatusEnum.pending:
        raise HTTPException(400, "Top-up already processed")
    topup.status = TopUpStatusEnum.failed
    topup.admin_notes = reason
    topup.verified_by = admin_user.id
    topup.verified_at = datetime.now()
    db.add(topup)
    db.commit()
    return {"success": True, "message": "Topup rejected"}

# routers/universe_balance.py

# Response model omitted for brevity; we return dictionary same shape as upstream.

@router.get("/unversal/balance")
async def check_universe_balance():
    """
    Check balance at UniversePay:
    - If client sends Authorization: Bearer <token>, that token will be forwarded.
    - If no token provided, the function will attempt to call the project's internal _login() to get a token.
    """

    # Determine token to use

    async with httpx.AsyncClient(timeout=httpx.Timeout(HTTP_TIMEOUT_SECONDS)) as client:
        # If no token provided, attempt internal login helper (if available)

        try:
            token = await _login(client)  # _login should return the access_token string
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to obtain token from UniversePay: {str(exc)}"
            )

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            # add other required headers if any
        }

        url =  "https://universepay.in/api/balance"

        try:
            # UniversePay expects POST (per your doc)
            resp = await client.post(url, headers=headers, json={})
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error connecting to UniversePay: {str(exc)}"
            )

        # Forward upstream non-200 as 502 (or adjust as you like)
        if resp.status_code != 200:
            # Try to parse JSON body for message
            try:
                body = resp.json()
            except Exception:
                body = resp.text
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"upstream_status": resp.status_code, "upstream_body": body}
            )

        # Parse the expected response:
        try:
            j = resp.json()
        except Exception:
            raise HTTPException(status_code=502, detail="Invalid JSON from UniversePay")

        # Example success:
        # {
        #  "status": true,
        #  "data": { "balance": "622" }
        # }
        status_flag = j.get("status")
        data = j.get("data") or {}

        # Basic validation
        if status_flag is not True or "balance" not in data:
            # If upstream returned something unexpected, return raw body with 502
            raise HTTPException(status_code=502, detail={"unexpected_upstream": j})

        # Return normalized response
        return {
            "success": True,
            "balance": data["balance"],
            "raw": j
        }






def _parse_date_input(v: Optional[str]) -> Optional[datetime]:
    """Accepts YYYY-MM-DD or full ISO string. Returns datetime (naive) or None."""
    if not v:
        return None
    v = v.strip()
    try:
        # YYYY-MM-DD -> treat as start of day
        if len(v) == 10 and v[4] == "-" and v[7] == "-":
            return datetime.fromisoformat(f"{v}T00:00:00")
        # Otherwise try full ISO parse
        return datetime.fromisoformat(v)
    except Exception:
        return None


def _wallet_txn_filters(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    transaction_type: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    order_id: Optional[str] = None,
    txn_id: Optional[str] = None,
    instrument_mode: Optional[str] = None,
    search: Optional[str] = None,
) -> list:
    """Filter list shared by the admin transaction list and its stats endpoint."""
    filters = []
    # admin route: no user_id means all merchants
    if user_id:
        filters.append(WalletTransaction.user_id == user_id)
    if status:
        filters.append(WalletTransaction.status == status)
    if transaction_type:
        try:
            filters.append(WalletTransaction.transaction_type == TransactionTypeEnum(transaction_type))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Unknown transaction_type {transaction_type!r}")
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

    fd = _parse_date_input(from_date)
    td = _parse_date_input(to_date)
    if fd:
        filters.append(WalletTransaction.created_at >= fd)
    if td:
        # a bare YYYY-MM-DD includes the whole day
        if to_date and len(to_date.strip()) == 10:
            td = td + timedelta(days=1) - timedelta(microseconds=1)
        filters.append(WalletTransaction.created_at <= td)

    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                WalletTransaction.order_id.ilike(term),
                WalletTransaction.txn_id.ilike(term),
                WalletTransaction.utr.ilike(term),
                WalletTransaction.reference_id.ilike(term),
                WalletTransaction.description.ilike(term),
            )
        )
    return filters


@router.get("/wallet-transactions/stats", response_model=Dict[str, Any])
def wallet_transaction_stats(
    user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_required),
):
    """
    Totals for the admin Transactions page, using the same filters as /wallet-transactions:
    total_txns (all statuses), payin_volume / payout_volume / total_charges (success only,
    unless a status filter is given). When both dates are set, `previous` holds the same
    totals for the equally long window right before it.
    """
    def totals(fd: Optional[str], td: Optional[str]) -> Dict[str, Any]:
        f = _wallet_txn_filters(user_id=user_id, status=status, transaction_type=transaction_type,
                                min_amount=min_amount, max_amount=max_amount,
                                from_date=fd, to_date=td, search=search)
        base = db.query(WalletTransaction).filter(and_(*f)) if f else db.query(WalletTransaction)
        total_txns = base.with_entities(func.count(WalletTransaction.id)).scalar() or 0
        vol = base if status else base.filter(WalletTransaction.status == "success")

        def vsum(col, ttype=None):
            q = vol
            if ttype is not None:
                q = q.filter(WalletTransaction.transaction_type == ttype)
            return float(q.with_entities(func.coalesce(func.sum(col), 0)).scalar() or 0)

        return {
            "total_txns": int(total_txns),
            "payin_volume": vsum(WalletTransaction.amount, TransactionTypeEnum.PayIn),
            "payout_volume": vsum(WalletTransaction.amount, TransactionTypeEnum.PayOut),
            "total_charges": vsum(func.coalesce(WalletTransaction.charges, 0) + func.coalesce(WalletTransaction.gst, 0)),
        }

    current = totals(from_date, to_date)
    previous = None
    daily = []
    start, end = _parse_date_input(from_date), _parse_date_input(to_date)
    if start and end and end >= start:
        span = (end.date() - start.date()).days + 1
        prev_end = start.date() - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span - 1)
        previous = totals(prev_start.isoformat(), prev_end.isoformat())

        # per-day series for the stat-card trend lines (up to today, max ~3 months)
        last = min(end.date(), datetime.now(india_tz).date())
        if span <= 93 and last >= start.date():
            f = _wallet_txn_filters(user_id=user_id, status=status, transaction_type=transaction_type,
                                    min_amount=min_amount, max_amount=max_amount,
                                    from_date=from_date, to_date=last.isoformat(), search=search)
            day = func.date(WalletTransaction.created_at)
            ok = true() if status else (WalletTransaction.status == "success")

            def when(cond, val):
                return func.coalesce(func.sum(case((cond, val), else_=0)), 0)

            rows = (
                db.query(
                    day.label("d"),
                    func.count(WalletTransaction.id),
                    when(and_(ok, WalletTransaction.transaction_type == TransactionTypeEnum.PayIn), WalletTransaction.amount),
                    when(and_(ok, WalletTransaction.transaction_type == TransactionTypeEnum.PayOut), WalletTransaction.amount),
                    when(ok, func.coalesce(WalletTransaction.charges, 0) + func.coalesce(WalletTransaction.gst, 0)),
                )
                .filter(and_(*f))
                .group_by(day)
                .all()
            )
            by_day = {str(r[0]): r for r in rows}
            for i in range((last - start.date()).days + 1):
                d = (start.date() + timedelta(days=i)).isoformat()
                r = by_day.get(d)
                daily.append({
                    "date": d,
                    "txns": int(r[1]) if r else 0,
                    "payin_volume": float(r[2]) if r else 0.0,
                    "payout_volume": float(r[3]) if r else 0.0,
                    "charges": float(r[4]) if r else 0.0,
                })
    return {**current, "previous": previous, "daily": daily}


@router.get("/wallet-transactions", response_model=Dict[str, Any])
def list_wallet_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    user_id: Optional[str] = Query(None, description="Filter by merchant; omit for all merchants"),
    status: Optional[str] = Query(None, description="status filter"),
    transaction_type: Optional[str] = Query(None, description="PayIn, PayOut, ..."),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    from_date: Optional[str] = Query(None, description="From created_at (ISO or YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="To created_at (ISO or YYYY-MM-DD)"),
    order_id: Optional[str] = Query(None, description="Filter by order_id"),
    txn_id: Optional[str] = Query(None, description="Filter by txn_id"),
    instrument_mode: Optional[str] = Query(None, description="Filter by instrument mode"),
    search: Optional[str] = Query(None, description="Search in order_id, txn_id, utr, reference_id, description"),
    sort_by: Optional[str] = Query("created_at", description="Sort field: created_at, amount, status, order_id"),
    sort_dir: Optional[str] = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_required),
):
    """
    List wallet transactions with pagination and filters (admin only).
    Without user_id, transactions of all merchants are returned.
    """
    query = db.query(WalletTransaction)
    filters = _wallet_txn_filters(
        user_id=user_id, status=status, transaction_type=transaction_type,
        min_amount=min_amount, max_amount=max_amount, from_date=from_date, to_date=to_date,
        order_id=order_id, txn_id=txn_id, instrument_mode=instrument_mode, search=search,
    )

    if filters:
        query = query.filter(and_(*filters))

    # whitelist sort columns to avoid SQL injection
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

    # total count (before limit)
    try:
        total = query.with_entities(func.count()).scalar() or 0
    except Exception:
        total = query.count()

    # pagination
    offset = (page - 1) * per_page
    rows = query.offset(offset).limit(per_page).all()

    # serializer - adjust to include/omit fields you want
    def _serialize_row(r: WalletTransaction) -> Dict[str, Any]:
        return {
            "id": r.id,
            "user_id": r.user_id,
            "transaction_type": r.transaction_type,
            "credit_debit": r.credit_debit,
            "order_id": r.order_id,
            "order_token": getattr(r, "order_token", None),
            "payIn_mode": getattr(r, "payIn_mode", None),
            "status": r.status,
            "customer_id": getattr(r, "customer_id", None),
            "amount": float(r.amount) if r.amount is not None else None,
            "settle_amount": float(r.settle_amount) if getattr(r, "settle_amount", None) is not None else None,
            "balance_amount": float(getattr(r, "balance_amount", None)) if getattr(r, "balance_amount", None) is not None else None,
            "charges": float(r.charges) if getattr(r, "charges", None) is not None else None,
            "gst": float(getattr(r, "gst", None)) if getattr(r, "gst", None) is not None else None,
            "reference_id": getattr(r, "reference_id", None),
            "txn_id": r.txn_id,
            "utr": getattr(r, "utr", None),
            "description": getattr(r, "description", None),
            "instrument_mode": getattr(r, "instrument_mode", None),
            "api_name": getattr(r, "api_name", None),
            "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
            "refund_id": getattr(r, "refund_id", None),
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



# Import your DB session dependency and models
# Adjust these imports to your project's structure if needed.

# Request schema
class ReconcileRequest(BaseModel):
    user_id: str = Field(..., description="Merchant/user id (e.g. MER-98E2F0A2)")
    date: str = Field(..., description="Date to reconcile (YYYY-MM-DD)")
    threshold: Optional[Decimal] = Field(Decimal("1000.00"), description="Threshold for flat charges (default 1000)")

# Response summary


class ReconcileSummary(BaseModel):
    reconciled_count: int
    refunded_count: int
    adjusted_count: int
    skipped_count: int
    details: list[dict]

# helper
def quantize_two(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def compute_charges(amount: Decimal, threshold: Decimal) -> (Decimal, Decimal, Decimal):
    """Return (charges, gst, settle_amount) according to rule."""
    amount = quantize_two(amount)
    if amount <= threshold:
        charges = Decimal("12.00")
    else:
        charges = quantize_two(amount * Decimal("0.015"))
    gst = quantize_two(charges * Decimal("0.18"))
    settle = quantize_two(amount + charges + gst)
    return charges, gst, settle

@router.post("/reconcile-payouts", response_model=ReconcileSummary)
def reconcile_payouts(payload: ReconcileRequest, db: Session = Depends(get_db)):
    """
    Admin endpoint to reconcile PayOut transactions for a merchant on a given date.
    - user_id: merchant id
    - date: YYYY-MM-DD (the date of transactions to reconcile)
    - threshold: numeric threshold where <= threshold uses flat charge 12, > threshold uses 1.5%
    """
    try:
        # parse date range (entire day) in server timezone
        day = datetime.strptime(payload.date, "%Y-%m-%d")
        start_dt = datetime.combine(day.date(), datetime.min.time())
        end_dt = datetime.combine(day.date(), datetime.max.time())

        threshold = quantize_two(payload.threshold)

        # lock payout wallet row (so concurrent operations don't race)
        payout_wallet = db.query(PayOutWallet).filter(
            PayOutWallet.user_id == payload.user_id
        ).with_for_update().one_or_none()
        if not payout_wallet:
            raise HTTPException(status_code=404, detail="PayOutWallet not found for user")

        # select candidate wallet transactions (for PayOut) for that day
        candidates = db.query(WalletTransaction).filter(
            WalletTransaction.user_id == payload.user_id,
            WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
            WalletTransaction.created_at >= start_dt,
            WalletTransaction.created_at <= end_dt
        ).order_by(WalletTransaction.created_at.asc()).with_for_update().all()

        summary = {
            "reconciled_count": 0,
            "refunded_count": 0,
            "adjusted_count": 0,
            "skipped_count": 0,
            "details": []
        }

        if not candidates:
            return ReconcileSummary(**summary)

        # Correction timestamp (set to next-day as requested)
        correction_dt = day + timedelta(days=1)
        correction_dt = correction_dt.replace(hour=0, minute=0, second=0, microsecond=0)

        # iterate rows
        for wt in candidates:
            summary["reconciled_count"] += 1
            amt = quantize_two(Decimal(str(wt.amount or 0)))
            stored_settle = quantize_two(Decimal(str(wt.settle_amount or 0)))
            stored_charges = quantize_two(Decimal(str(wt.charges or 0)))
            stored_gst = quantize_two(Decimal(str(wt.gst or 0)))
            status = (wt.status or "").lower()

            # If failed: refund stored_settle back to payout wallet (if non-zero) and zero fields
            if status == "failed":
                if stored_settle == Decimal("0.00"):
                    summary["skipped_count"] += 1
                    summary["details"].append({"order_id": wt.order_id, "action": "skipped_already_zero"})
                    continue

                # Idempotency: check if reversal exists already
                reversal_exists = db.query(WalletTransaction).filter(
                    WalletTransaction.user_id == payload.user_id,
                    WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
                    WalletTransaction.credit_debit == credit_debitTypeEnum.credit,
                    WalletTransaction.description == f"Reversal for failed payout {wt.order_id}"
                ).first()

                if reversal_exists:
                    summary["skipped_count"] += 1
                    summary["details"].append({"order_id": wt.order_id, "action": "reversal_exists"})
                    # Zero the original row if not zeroed yet
                    if wt.settle_amount != 0 or wt.charges != 0 or wt.gst != 0:
                        wt.charges = 0.0
                        wt.gst = 0.0
                        wt.settle_amount = 0.0
                        wt.balance_amount = float(payout_wallet.balance)
                        db.add(wt)
                        db.commit()
                    continue

                # apply refund to payout wallet and create reversal txn
                payout_wallet.balance = quantize_two(Decimal(str(payout_wallet.balance)) + stored_settle)
                if hasattr(payout_wallet, "last_updated"):
                    payout_wallet.last_updated = correction_dt
                db.add(payout_wallet)
                db.flush()  # persist wallet change to get new balance

                reversal = WalletTransaction(
                    user_id=payload.user_id,
                    transaction_type=TransactionTypeEnum.PayOut,
                    credit_debit=credit_debitTypeEnum.credit,
                    order_id=f"REV-{wt.order_id}-{int(correction_dt.timestamp())}",
                    amount=float(stored_settle),
                    settle_amount=0.0,
                    balance_amount=float(payout_wallet.balance),
                    charges=0.0,
                    gst=0.0,
                    status="success",
                    description=f"Reversal for failed payout {wt.order_id}",
                    created_at=correction_dt,
                    api_name="reconciliation",
                )
                db.add(reversal)

                # zero original row financials
                wt.charges = 0.0
                wt.gst = 0.0
                wt.settle_amount = 0.0
                wt.balance_amount = float(payout_wallet.balance)
                db.add(wt)
                db.commit()

                summary["refunded_count"] += 1
                summary["details"].append({"order_id": wt.order_id, "action": "refunded", "amount": float(stored_settle)})
                continue

            # For success/inprogress: recompute expected values and adjust if mismatch
            if status in ("success", "inprogress", "completed", "processed"):
                charges, gst, recomputed_settle = compute_charges(amt, threshold)

                # no change needed
                if quantize_two(recomputed_settle) == quantize_two(stored_settle) and quantize_two(charges) == quantize_two(stored_charges):
                    summary["details"].append({"order_id": wt.order_id, "action": "ok"})
                    continue

                # Check if adjustment already applied (idempotency)
                adj_desc = f"Adjustment for correct charges for {wt.order_id}"
                existing_adj = db.query(WalletTransaction).filter(
                    WalletTransaction.user_id == payload.user_id,
                    WalletTransaction.transaction_type == TransactionTypeEnum.PayOut,
                    WalletTransaction.description == adj_desc
                ).first()
                if existing_adj:
                    summary["details"].append({"order_id": wt.order_id, "action": "adj_exists"})
                    continue

                # difference between recomputed and stored settle
                diff = quantize_two(recomputed_settle - stored_settle)
                # apply diff to payout_wallet and create adjustment transaction
                if diff > 0:
                    # wallet needs to be debited more
                    payout_wallet.balance = quantize_two(Decimal(str(payout_wallet.balance)) - diff)
                    db.add(payout_wallet)
                    db.flush()
                    adj_txn = WalletTransaction(
                        user_id=payload.user_id,
                        transaction_type=TransactionTypeEnum.PayOut,
                        credit_debit=credit_debitTypeEnum.debit,
                        order_id=f"ADJ-{wt.order_id}-{int(correction_dt.timestamp())}",
                        amount=float(diff),
                        settle_amount=float(diff),
                        balance_amount=float(payout_wallet.balance),
                        charges=0.0,
                        gst=0.0,
                        status="success",
                        description=adj_desc,
                        created_at=correction_dt,
                        api_name="reconciliation",
                    )
                    db.add(adj_txn)
                    action = "debited_extra"
                else:
                    # wallet should be credited back
                    credit_amt = abs(diff)
                    payout_wallet.balance = quantize_two(Decimal(str(payout_wallet.balance)) + credit_amt)
                    db.add(payout_wallet)
                    db.flush()
                    adj_txn = WalletTransaction(
                        user_id=payload.user_id,
                        transaction_type=TransactionTypeEnum.PayOut,
                        credit_debit=credit_debitTypeEnum.credit,
                        order_id=f"ADJ-{wt.order_id}-{int(correction_dt.timestamp())}",
                        amount=float(credit_amt),
                        settle_amount=0.0,
                        balance_amount=float(payout_wallet.balance),
                        charges=0.0,
                        gst=0.0,
                        status="success",
                        description=adj_desc,
                        created_at=correction_dt,
                        api_name="reconciliation",
                    )
                    db.add(adj_txn)
                    action = "credited_back"

                # update original transaction to recomputed numbers
                wt.charges = float(charges)
                wt.gst = float(gst)
                wt.settle_amount = float(recomputed_settle)
                wt.balance_amount = float(payout_wallet.balance)
                db.add(wt)
                db.commit()

                summary["adjusted_count"] += 1
                summary["details"].append({"order_id": wt.order_id, "action": action, "diff": float(diff)})
                continue

            # Unhandled status: mark skipped
            summary["skipped_count"] += 1
            summary["details"].append({"order_id": wt.order_id, "action": f"skipped_status_{wt.status}"})

        return ReconcileSummary(**summary)

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="DB error during reconciliation: " + str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error: " + str(e))

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

@router.get("/admin/summary", response_model=Dict[str, Any], summary="Merchant transaction summary (by date range)")
def admin_summary(
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD (inclusive). Defaults to first day of current month."),
    date_to: Optional[str] = Query(None, description="End date YYYY-MM-DD (inclusive). Defaults to last day of current month."),
    status: Optional[str] = Query(None, description="Optional transaction status filter (e.g. success, failed)"),
    merchant_id: Optional[str] = Query(None, description="merchantID (e.g. MESSS01, MESSS02)"),
    db: Session = Depends(get_db),
    current_user = Depends(admin_required),
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
    merchant_id =merchant_id #getattr(current_user, "id", None) or getattr(current_user, "user_id", None)
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
def get_merchant_credentials_admin(
    merchant_id: str = Query(..., description="Merchant ID"),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ProviderCredential)
        .filter(ProviderCredential.merchant_id == merchant_id)
        .all()
    )

    if not rows:
        return MerchantCredentialsOut(
            merchant_id=merchant_id,
            credentials=[]
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
