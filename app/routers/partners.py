"""Admin: merchants mapped under a partner (partner = user with role 1)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.models import PartnerMerchant, User
from utils.authenticate import admin_required
from utils.database import get_db

router = APIRouter(prefix="/api/v1/admin/partners", tags=["Admin Partners"], dependencies=[Depends(admin_required)])

PARTNER_ROLE, MERCHANT_ROLE = 1, 2


class MapIn(BaseModel):
    merchant_id: str


def _user(db: Session, user_id: str, role: int, what: str) -> User:
    u = db.get(User, user_id)
    if not u or u.role != role:
        raise HTTPException(404, f"{what} not found")
    return u


def _merchant_out(u: User, m: PartnerMerchant) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "full_name": u.full_name,
        "phone_number": u.phone_number,
        "company_name": u.company_name,
        "kyc_verified": bool(u.kyc_verified),
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "mapped_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/{partner_id}/merchants")
def list_partner_merchants(partner_id: str, db: Session = Depends(get_db)) -> List[dict]:
    _user(db, partner_id, PARTNER_ROLE, "Partner")
    rows = (
        db.query(PartnerMerchant, User)
        .join(User, User.id == PartnerMerchant.merchant_id)
        .filter(PartnerMerchant.partner_id == partner_id)
        .order_by(PartnerMerchant.created_at.desc())
        .all()
    )
    return [_merchant_out(u, m) for m, u in rows]


@router.post("/{partner_id}/merchants", status_code=201)
def map_merchant(partner_id: str, payload: MapIn, db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    _user(db, partner_id, PARTNER_ROLE, "Partner")
    merchant = _user(db, payload.merchant_id, MERCHANT_ROLE, "Merchant")
    existing = db.query(PartnerMerchant).filter(PartnerMerchant.merchant_id == merchant.id).first()
    if existing:
        if existing.partner_id == partner_id:
            raise HTTPException(409, "This merchant is already mapped to this partner")
        other = db.get(User, existing.partner_id)
        raise HTTPException(409, f"This merchant is already mapped to partner {other.full_name or other.username if other else existing.partner_id} — unmap it there first")
    m = PartnerMerchant(partner_id=partner_id, merchant_id=merchant.id, created_by=admin.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    return _merchant_out(merchant, m)


@router.delete("/{partner_id}/merchants/{merchant_id}", status_code=204)
def unmap_merchant(partner_id: str, merchant_id: str, db: Session = Depends(get_db)):
    m = db.query(PartnerMerchant).filter(PartnerMerchant.partner_id == partner_id, PartnerMerchant.merchant_id == merchant_id).first()
    if not m:
        raise HTTPException(404, "Mapping not found")
    db.delete(m)
    db.commit()
