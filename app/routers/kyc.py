"""
Merchant KYC: merchants submit company details and documents item by item,
admins approve or reject each item. `User.kyc_verified` (the flag that gates
live PayIn) stays an explicit admin decision via PATCH /admin/user/{id}/kyc.
"""
import os
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.models import MerchantKycItem, PayoutBankAccount, User, india_tz
from utils.authenticate import admin_required, user_required
from utils.database import get_db

# Stored outside /static so documents are only reachable through the authenticated endpoints below.
KYC_UPLOAD_DIR = os.getenv(
    "KYC_UPLOAD_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "private_uploads", "kyc"),
)
MAX_DOC_BYTES = 10 * 1024 * 1024  # keep in sync with KYC_MAX_MB in fronted_react/src/api/kyc.ts
ALLOWED_DOC_TYPES = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}

COMPANY_TYPES = {
    "sole_proprietorship": "Sole Proprietorship",
    "partnership": "Partnership Firm",
    "llp": "Limited Liability Partnership (LLP)",
    "private_limited": "Private Limited Company",
    "public_limited": "Public Limited Company",
}

PAN_RE = r"^[A-Z]{5}[0-9]{4}[A-Z]$"
TEXT_RULES = {
    "mobile": (r"^(\+91[\s-]?)?[6-9]\d{9}$", "Enter a valid 10-digit Indian mobile number"),
    "email": (r"^[^\s@]+@[^\s@]+\.[^\s@]+$", "Enter a valid email address"),
    "business_address": (r"^.{10,500}$", "Enter the complete address (at least 10 characters)"),
    "business_pan_id": (PAN_RE, "PAN must look like ABCDE1234F"),
    "owner_pan_id": (PAN_RE, "PAN must look like ABCDE1234F"),
    "aadhaar_id": (r"^\d{12}$", "Aadhaar must be 12 digits"),
    "gstin_id": (r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", "GSTIN must be 15 characters, e.g. 10ABCDE1234F1Z5"),
}

ADDRESS_PROOF_HINT = (
    "Any one: utility bill, rent agreement, Shops & Establishment certificate, FSSAI/FDA licence, "
    "Udyam/MSME certificate, or another government document showing the business address"
)


def _person(company_type: str) -> str:
    return {
        "sole_proprietorship": "Proprietor",
        "partnership": "Partner",
        "llp": "Designated Partner",
    }.get(company_type, "Director")


def _items_for(company_type: Optional[str]) -> dict:
    """Required KYC items for each section, as (key, label, kind, hint)."""
    basic = [
        ("mobile", "Registered Mobile Number", "text", None),
        ("email", "Registered Email ID", "text", None),
        ("business_address", "Complete Business Address", "text", None),
    ]
    docs = []
    if company_type:
        p = _person(company_type)
        docs = [
            ("business_pan_id", "Business PAN Card ID", "text", None),
            ("business_pan_doc", "Business PAN Card", "file", None),
            ("owner_pan_id", f"{p} PAN Card ID", "text", None),
            ("owner_pan_doc", f"{p} PAN Card", "file", None),
            ("aadhaar_id", f"{p} Aadhaar ID", "text", None),
            ("aadhaar_doc", f"{p} Aadhaar", "file", None),
            ("gstin_id", "GSTIN ID", "text", None),
            ("gstin_doc", "GSTIN Certificate", "file", None),
            ("address_proof_doc", "Business Address Proof", "file", ADDRESS_PROOF_HINT),
        ]
        if company_type == "partnership":
            docs.append(("partnership_deed_doc", "Partnership Deed", "file", None))
        elif company_type == "llp":
            docs += [
                ("incorporation_doc", "Certificate of Incorporation", "file", None),
                ("llp_agreement_doc", "LLP Agreement", "file", None),
            ]
        elif company_type in ("private_limited", "public_limited"):
            docs += [
                ("incorporation_doc", "Certificate of Incorporation", "file", None),
                ("moa_aoa_doc", "MOA & AOA", "file", None),
            ]
    return {
        "company": [("company_type", "Company Type", "select", None)],
        "basic": basic,
        "documents": docs,
    }


def _item_defs(company_type: Optional[str]) -> dict:
    return {key: (label, kind) for section in _items_for(company_type).values() for key, label, kind, _ in section}


def _rows(db: Session, user_id: str) -> dict:
    return {r.key: r for r in db.query(MerchantKycItem).filter(MerchantKycItem.user_id == user_id).all()}


def _kyc_payload(db: Session, user: User) -> dict:
    rows = _rows(db, user.id)
    ct_row = rows.get("company_type")
    company_type = ct_row.value if ct_row and ct_row.value in COMPANY_TYPES else None
    defaults = {"mobile": user.phone_number, "email": user.email}

    sections = {}
    approved = total = 0
    for name, defs in _items_for(company_type).items():
        items = []
        for key, label, kind, hint in defs:
            r = rows.get(key)
            status = r.status if r else "not_submitted"
            total += 1
            approved += status == "approved"
            items.append({
                "key": key,
                "label": label,
                "kind": kind,
                "hint": hint,
                "value": r.value if r else (defaults.get(key) if kind == "text" else None),
                "has_file": bool(r and r.file_path),
                "file_name": r.file_name if r else None,
                "status": status,
                "remark": r.remark if r else None,
                "updated_at": r.updated_at.isoformat() if r and r.updated_at else None,
            })
        sections[name] = items

    accounts = db.query(PayoutBankAccount).filter(PayoutBankAccount.user_id == user.id).all()
    verified_accounts = sum(1 for a in accounts if a.is_validate)
    total += 1
    approved += verified_accounts > 0

    return {
        "merchant_id": user.id,
        "kyc_verified": bool(user.kyc_verified),
        "company_type": company_type,
        "company_types": [{"value": k, "label": v} for k, v in COMPANY_TYPES.items()],
        "sections": sections,
        "bank": {"total": len(accounts), "verified": verified_accounts},
        "progress": {"approved": approved, "total": total, "percent": round(approved * 100 / total) if total else 0},
    }


def _get_editable(db: Session, user_id: str, key: str) -> Optional[MerchantKycItem]:
    row = db.query(MerchantKycItem).filter(MerchantKycItem.user_id == user_id, MerchantKycItem.key == key).first()
    if row and row.status == "approved":
        raise HTTPException(400, "This item is already approved and can no longer be changed")
    return row


def _mark_submitted(row: MerchantKycItem) -> None:
    row.status = "pending"
    row.remark = None
    row.reviewed_by = None
    row.reviewed_at = None
    row.updated_at = datetime.now(india_tz)


def _file_response(db: Session, user_id: str, key: str) -> FileResponse:
    row = db.query(MerchantKycItem).filter(MerchantKycItem.user_id == user_id, MerchantKycItem.key == key).first()
    if not row or not row.file_path or not os.path.isfile(row.file_path):
        raise HTTPException(404, "Document not found")
    return FileResponse(row.file_path, media_type=row.file_mime or "application/octet-stream", filename=row.file_name or os.path.basename(row.file_path))


# ---------------------------------------------------------------- merchant

merchant_router = APIRouter(prefix="/api/v1/merchant/kyc", tags=["Merchant KYC"])


class CompanyTypeIn(BaseModel):
    company_type: str


class FieldIn(BaseModel):
    key: str
    value: str


@merchant_router.get("")
def get_my_kyc(db: Session = Depends(get_db), current_user: User = Depends(user_required)):
    return _kyc_payload(db, current_user)


@merchant_router.put("/company-type")
def set_company_type(payload: CompanyTypeIn, db: Session = Depends(get_db), current_user: User = Depends(user_required)):
    if payload.company_type not in COMPANY_TYPES:
        raise HTTPException(422, "Unknown company type")
    row = _get_editable(db, current_user.id, "company_type")
    if not row:
        row = MerchantKycItem(user_id=current_user.id, key="company_type")
        db.add(row)
    row.value = payload.company_type
    _mark_submitted(row)
    db.commit()
    return _kyc_payload(db, current_user)


@merchant_router.put("/field")
def set_field(payload: FieldIn, db: Session = Depends(get_db), current_user: User = Depends(user_required)):
    ct = db.query(MerchantKycItem).filter(MerchantKycItem.user_id == current_user.id, MerchantKycItem.key == "company_type").first()
    defs = _item_defs(ct.value if ct else None)
    if defs.get(payload.key, (None, None))[1] != "text":
        raise HTTPException(422, "Unknown KYC field")
    value = payload.value.strip()
    if payload.key in ("business_pan_id", "owner_pan_id", "gstin_id"):
        value = value.upper()
    pattern, message = TEXT_RULES[payload.key]
    if not re.match(pattern, value):
        raise HTTPException(422, message)

    row = _get_editable(db, current_user.id, payload.key)
    if not row:
        row = MerchantKycItem(user_id=current_user.id, key=payload.key)
        db.add(row)
    row.value = value
    _mark_submitted(row)
    db.commit()
    return _kyc_payload(db, current_user)


@merchant_router.post("/document")
async def upload_document(
    key: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(user_required),
):
    ct = db.query(MerchantKycItem).filter(MerchantKycItem.user_id == current_user.id, MerchantKycItem.key == "company_type").first()
    if not ct:
        raise HTTPException(400, "Select your company type first")
    if _item_defs(ct.value).get(key, (None, None))[1] != "file":
        raise HTTPException(422, "Unknown KYC document")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_DOC_TYPES:
        raise HTTPException(422, "Upload a PDF, JPG or PNG file")
    data = await file.read(MAX_DOC_BYTES + 1)
    if len(data) > MAX_DOC_BYTES:
        raise HTTPException(422, "File is larger than 10 MB")
    if not data:
        raise HTTPException(422, "File is empty")

    row = _get_editable(db, current_user.id, key)
    folder = os.path.join(KYC_UPLOAD_DIR, current_user.id)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{key}-{uuid.uuid4().hex}{ext}")
    with open(path, "wb") as f:
        f.write(data)

    old_path = row.file_path if row else None
    if not row:
        row = MerchantKycItem(user_id=current_user.id, key=key)
        db.add(row)
    row.file_path = path
    row.file_name = os.path.basename(file.filename or f"{key}{ext}")[:255]
    row.file_mime = ALLOWED_DOC_TYPES[ext]
    _mark_submitted(row)
    db.commit()
    if old_path and old_path != path and os.path.isfile(old_path):
        os.remove(old_path)
    return _kyc_payload(db, current_user)


@merchant_router.get("/document/{key}")
def download_my_document(key: str, db: Session = Depends(get_db), current_user: User = Depends(user_required)):
    return _file_response(db, current_user.id, key)


# ---------------------------------------------------------------- admin

admin_router = APIRouter(prefix="/api/v1/admin/kyc", tags=["Admin KYC"], dependencies=[Depends(admin_required)])


class ReviewIn(BaseModel):
    status: str  # approved | rejected
    remark: Optional[str] = None


def _merchant(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user or user.role != 2:
        raise HTTPException(404, "Merchant not found")
    return user


@admin_router.get("/{user_id}")
def get_merchant_kyc(user_id: str, db: Session = Depends(get_db)):
    return _kyc_payload(db, _merchant(db, user_id))


@admin_router.patch("/{user_id}/{key}")
def review_item(user_id: str, key: str, payload: ReviewIn, db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    user = _merchant(db, user_id)
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(422, "status must be approved or rejected")
    remark = (payload.remark or "").strip() or None
    if payload.status == "rejected" and not remark:
        raise HTTPException(422, "Give a reason so the merchant knows what to fix")
    row = db.query(MerchantKycItem).filter(MerchantKycItem.user_id == user_id, MerchantKycItem.key == key).first()
    if not row:
        raise HTTPException(404, "The merchant has not submitted this item")
    row.status = payload.status
    row.remark = remark if payload.status == "rejected" else None
    row.reviewed_by = admin.id
    row.reviewed_at = datetime.now(india_tz)
    db.commit()
    return _kyc_payload(db, user)


@admin_router.get("/{user_id}/document/{key}")
def download_merchant_document(user_id: str, key: str, db: Session = Depends(get_db)):
    _merchant(db, user_id)
    return _file_response(db, user_id, key)
