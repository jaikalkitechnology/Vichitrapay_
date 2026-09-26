"""Admin: per-merchant customer-email validation switch (see utils/email_validation.py)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.models import MerchantEmailValidation, User, india_tz
from utils.authenticate import admin_required
from utils.database import get_db
from utils.email_validation import check_customer_email

router = APIRouter(prefix="/api/v1/admin/email-validation", tags=["Admin Email Validation"], dependencies=[Depends(admin_required)])


class ToggleIn(BaseModel):
    enabled: bool


class TestIn(BaseModel):
    email: str


def _out(user_id: str, row: Optional[MerchantEmailValidation]) -> dict:
    return {
        "user_id": user_id,
        "enabled": bool(row and row.enabled),
        "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
        "updated_by": row.updated_by if row else None,
    }


def _merchant(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user or user.role != 2:
        raise HTTPException(404, "Merchant not found")
    return user


@router.post("/test")
def test_email(payload: TestIn):
    valid, reason, checks = check_customer_email(payload.email)
    return {"email": payload.email.strip(), "valid": valid, "reason": reason, "checks": checks}


@router.get("/{user_id}")
def get_setting(user_id: str, db: Session = Depends(get_db)):
    _merchant(db, user_id)
    return _out(user_id, db.get(MerchantEmailValidation, user_id))


@router.put("/{user_id}")
def set_setting(user_id: str, payload: ToggleIn, db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    _merchant(db, user_id)
    row = db.get(MerchantEmailValidation, user_id)
    if not row:
        row = MerchantEmailValidation(user_id=user_id)
        db.add(row)
    row.enabled = payload.enabled
    row.updated_by = admin.id
    row.updated_at = datetime.now(india_tz)
    db.commit()
    return _out(user_id, row)
