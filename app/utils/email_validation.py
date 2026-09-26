"""
Customer-email check used at PayIn initiation when a merchant has email validation enabled.
Rules: a valid email format, and at least one vowel (a, e, i, o, u) in the username part —
system-generated / bot addresses like "xyz@123.com" usually have none.
"""
import re
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
VOWEL_RE = re.compile(r"[aeiou]", re.IGNORECASE)


def check_customer_email(email: Optional[str]) -> Tuple[bool, Optional[str], dict]:
    """Returns (valid, reason, checks) — reason is None when valid."""
    email = (email or "").strip()
    fmt = bool(EMAIL_RE.match(email))
    vowel = fmt and bool(VOWEL_RE.search(email.split("@", 1)[0]))
    checks = {"format": fmt, "vowel": vowel}
    if not fmt:
        return False, "Customer email is not a valid email address", checks
    if not vowel:
        return False, "Customer email looks system-generated: the part before @ must contain a vowel (a, e, i, o, u)", checks
    return True, None, checks


def is_enabled(db: Session, merchant_id: str) -> bool:
    from models.models import MerchantEmailValidation

    row = db.get(MerchantEmailValidation, merchant_id)
    return bool(row and row.enabled)


def enforce_customer_email(db: Session, merchant_id: str, email: Optional[str]) -> None:
    """Raise 422 when the merchant has email validation on and the email fails the check."""
    if not is_enabled(db, merchant_id):
        return
    ok, reason, _ = check_customer_email(email)
    if not ok:
        raise HTTPException(status_code=422, detail=reason)
