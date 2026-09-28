"""
Vichitrapay — Dummy Merchant Data Script

Adds 10 dummy merchants with full details so every admin/merchant screen has data:
  - login (username / email / password), name, phone, company
  - PayIn wallet + PayOut wallet with balances
  - PG settings (PayIn %, PayOut %, flat fee, webhooks, IP)
  - payout bank account(s)
  - KYC: company type, basic info, all documents (sample PDFs) — each merchant at a
    different KYC stage (fully verified, under review, rejected items, partial, not started)
  - PayIn / PayOut transactions over the last 60 days and a few settlements
  - email-validation switch

Everything here is FAKE test data (PAN/Aadhaar/GSTIN/bank numbers use a DUMMY pattern
and do not belong to anyone). Do not load it into the production database.

Run from the project root:

    python update.py            # add the 10 dummy merchants (skips ones that already exist)
    python update.py --remove   # delete all dummy merchants and their data again

All dummy merchants log in with password:  Demo@1234
"""

import os
import random
import shutil
import sys
import uuid
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))

from sqlalchemy.orm import Session
from utils.database import SessionLocal, init_db
from utils.authenticate import hash_password
from models.models import (
    MerchantEmailValidation,
    MerchantKycItem,
    MerchantSettings,
    PayoutBankAccount,
    PayOutWallet,
    TransactionSettled,
    TransactionTypeEnum,
    User,
    Wallet,
    WalletTransaction,
    credit_debitTypeEnum,
    generate_user_id,
    india_tz,
)
from routers.kyc import COMPANY_TYPES, KYC_UPLOAD_DIR, _items_for

PASSWORD = "Demo@1234"
USERNAME_PREFIX = "demo_merchant_"
MERCHANT_ROLE = 2
random.seed(42)  # same data on every run

# ═══════════════════════════════════════════════════════════════════════
#  The 10 dummy merchants
#  kyc stage:
#    verified  → every item approved + final KYC approval (live PayIn on)
#    approved  → every item approved, final approval not given yet
#    review    → everything submitted, waiting for admin review
#    rejected  → submitted, some items rejected with a reason
#    partial   → only company type + basic info submitted
#    none      → merchant has not started KYC
# ═══════════════════════════════════════════════════════════════════════
MERCHANTS = [
    {"n": 1,  "full_name": "Rahul Sharma",   "company": "Sharma Electronics",      "type": "sole_proprietorship", "city": "Patna, Bihar 800001",         "kyc": "verified"},
    {"n": 2,  "full_name": "Priya Verma",    "company": "Verma Fashion House",     "type": "partnership",         "city": "Lucknow, Uttar Pradesh 226001", "kyc": "verified"},
    {"n": 3,  "full_name": "Amit Gupta",     "company": "Gupta Tech Solutions LLP", "type": "llp",                "city": "Pune, Maharashtra 411001",    "kyc": "verified"},
    {"n": 4,  "full_name": "Sneha Reddy",    "company": "Reddy Foods Pvt Ltd",     "type": "private_limited",     "city": "Hyderabad, Telangana 500001", "kyc": "approved"},
    {"n": 5,  "full_name": "Vikram Singh",   "company": "Singh Motors",            "type": "sole_proprietorship", "city": "Jaipur, Rajasthan 302001",    "kyc": "review"},
    {"n": 6,  "full_name": "Neha Patel",     "company": "Patel Pharma Ltd",        "type": "public_limited",      "city": "Ahmedabad, Gujarat 380001",   "kyc": "review"},
    {"n": 7,  "full_name": "Arjun Nair",     "company": "Nair Travels",            "type": "partnership",         "city": "Kochi, Kerala 682001",        "kyc": "rejected"},
    {"n": 8,  "full_name": "Kavita Joshi",   "company": "Joshi Books & Stationery", "type": "sole_proprietorship", "city": "Dehradun, Uttarakhand 248001", "kyc": "rejected"},
    {"n": 9,  "full_name": "Rohit Mehta",    "company": "Mehta Digital Pvt Ltd",   "type": "private_limited",     "city": "Indore, Madhya Pradesh 452001", "kyc": "partial"},
    {"n": 10, "full_name": "Anjali Das",     "company": "Das Handicrafts",         "type": None,                  "city": "Kolkata, West Bengal 700001", "kyc": "none"},
]

REJECT_REASONS = {
    "aadhaar_doc": "Back side of the Aadhaar card is missing",
    "gstin_doc": "GSTIN certificate is blurred, please upload a clear copy",
    "address_proof_doc": "Address on the proof does not match the business address",
    "owner_pan_id": "PAN number does not match the uploaded PAN card",
}

BANKS = [
    ("Dummy State Bank", "Main Branch"),
    ("Dummy National Bank", "City Branch"),
    ("Dummy Co-operative Bank", "Market Branch"),
]


# ── sample documents ────────────────────────────────────────────────────
def sample_pdf(title: str, merchant: str) -> bytes:
    """A small one-page PDF that clearly says it is dummy data."""
    lines = [
        ("F2", 22, 760, "SAMPLE DOCUMENT - DUMMY DATA"),
        ("F1", 16, 720, title),
        ("F1", 13, 690, f"Merchant: {merchant}"),
        ("F1", 11, 660, "This file was generated by update.py for testing."),
        ("F1", 11, 642, "It is not a real document."),
    ]
    esc = lambda s: s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = "0.93 0.95 1 rg 40 600 532 200 re f 0.1 0.2 0.4 rg\n" + "\n".join(
        f"BT /{font} {size} Tf 60 {y} Td ({esc(text)}) Tj ET" for font, size, y, text in lines
    )
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
    ]
    out, offsets = "%PDF-1.4\n", []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out.encode("latin-1")))
        out += f"{i} 0 obj\n{body}\nendobj\n"
    xref = len(out.encode("latin-1"))
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return out.encode("latin-1")


# ── dummy identity numbers (valid format, clearly fake) ─────────────────
def text_value(key: str, m: dict, user: User) -> str:
    n = m["n"]
    return {
        "company_type": m["type"],
        "mobile": user.phone_number,
        "email": user.email,
        "business_address": f"Shop No. {n}, Dummy Market Road, {m['city']}",
        "business_pan_id": f"DUMMY{n:04d}B",
        "owner_pan_id": f"DUMMY{n:04d}P",
        "aadhaar_id": f"9999{n:08d}",
        "gstin_id": f"10DUMMY{n:04d}B1Z5",
    }[key]


def item_status(stage: str, key: str) -> str:
    if stage in ("verified", "approved"):
        return "approved"
    if stage == "rejected":
        if key in REJECT_REASONS and (key != "owner_pan_id" or random.random() < 0.5):
            return "rejected"
        return random.choice(["approved", "approved", "pending"])
    if stage == "review":
        # company + basic already approved, documents waiting
        return "pending" if key not in ("company_type", "mobile", "email", "business_address") else "approved"
    return "pending"  # partial


# ── builders ────────────────────────────────────────────────────────────
def add_kyc(db: Session, user: User, m: dict, now: datetime) -> None:
    stage = m["kyc"]
    if stage == "none" or not m["type"]:
        return
    sections = _items_for(m["type"], MERCHANT_ROLE)
    keys = [d for d in sections["company"] + sections["basic"]]
    if stage != "partial":
        keys += sections["documents"]
    folder = os.path.join(KYC_UPLOAD_DIR, user.id)
    os.makedirs(folder, exist_ok=True)
    submitted = now - timedelta(days=random.randint(3, 20))
    for key, label, kind, _ in keys:
        status = item_status(stage, key)
        row = MerchantKycItem(
            user_id=user.id,
            key=key,
            status=status,
            remark=REJECT_REASONS.get(key) if status == "rejected" else None,
            reviewed_by="ADMIN" if status != "pending" else None,
            reviewed_at=submitted + timedelta(days=1) if status != "pending" else None,
            created_at=submitted,
            updated_at=submitted + timedelta(days=1) if status != "pending" else submitted,
        )
        if kind == "file":
            path = os.path.join(folder, f"{key}-{uuid.uuid4().hex}.pdf")
            with open(path, "wb") as f:
                f.write(sample_pdf(label, m["company"]))
            row.file_path, row.file_name, row.file_mime = path, f"{key}.pdf", "application/pdf"
        else:
            row.value = text_value(key, m, user)
        db.add(row)


def add_transactions(db: Session, user: User, m: dict, settings: MerchantSettings, now: datetime) -> tuple:
    """Returns (payin wallet balance, payout wallet balance)."""
    live = m["kyc"] == "verified"
    count = 25 if live else (8 if m["kyc"] in ("approved", "review") else 0)
    payin_balance = 0.0
    for i in range(count):
        amount = float(random.choice([199, 499, 750, 999, 1500, 2500, 4999, 7500, 12000]))
        status = random.choices(["success", "pending", "failed"], weights=[80, 8, 12])[0]
        charges = round(amount * settings.payInCharges / 100, 2) if status == "success" else 0.0
        gst = round(charges * 0.18, 2)
        settle = round(amount - charges - gst, 2) if status == "success" else 0.0
        payin_balance += settle
        db.add(WalletTransaction(
            user_id=user.id,
            transaction_type=TransactionTypeEnum.PayIn,
            credit_debit=credit_debitTypeEnum.credit,
            order_id=f"DUMMY-ORD-{user.id}-{i + 1:03d}",
            txn_id=f"DUMMYTXN{uuid.uuid4().hex[:12].upper()}",
            utr=f"9{random.randint(10**10, 10**11 - 1)}" if status == "success" else None,
            status=status,
            amount=amount,
            charges=charges,
            gst=gst,
            settle_amount=settle,
            balance_amount=round(payin_balance, 2),
            instrument_mode=random.choice(["UPI_INTENT", "UPI_QR", "UPI_COLLECT_VPA"]),
            payIn_mode="UPI",
            description="Dummy PayIn",
            api_name="dummy_seed",
            created_at=now - timedelta(days=random.randint(0, 60), hours=random.randint(0, 23), minutes=random.randint(0, 59)),
        ))

    payout_balance = float(random.choice([25000, 50000, 75000, 100000])) if live else 0.0
    for i in range(10 if live else 0):
        amount = float(random.choice([1000, 2000, 5000, 10000]))
        status = random.choices(["success", "pending", "failed"], weights=[80, 10, 10])[0]
        charges = round(amount * settings.payOutCharges / 100 + settings.payOutChargesFlat, 2) if status == "success" else 0.0
        gst = round(charges * 0.18, 2)
        if status == "success":
            payout_balance -= amount + charges + gst
        db.add(WalletTransaction(
            user_id=user.id,
            transaction_type=TransactionTypeEnum.PayOut,
            credit_debit=credit_debitTypeEnum.debit,
            order_id=f"DUMMY-PAY-{user.id}-{i + 1:03d}",
            txn_id=f"DUMMYPO{uuid.uuid4().hex[:12].upper()}",
            utr=f"8{random.randint(10**10, 10**11 - 1)}" if status == "success" else None,
            status=status,
            amount=amount,
            charges=charges,
            gst=gst,
            settle_amount=amount if status == "success" else 0.0,
            balance_amount=round(payout_balance, 2),
            instrument_mode="IMPS",
            description="Dummy PayOut to vendor",
            api_name="dummy_seed",
            created_at=now - timedelta(days=random.randint(0, 60), hours=random.randint(0, 23)),
        ))
    return round(payin_balance, 2), round(max(payout_balance, 0.0), 2)


def add_settlements(db: Session, user: User, now: datetime) -> None:
    for i, (amount, status) in enumerate([(15000.0, "success"), (8000.0, "success"), (5000.0, "pending")]):
        day = now - timedelta(days=5 + i * 10)
        db.add(TransactionSettled(
            txn_id=f"DUMMY-SETTLE-{user.id}-{i + 1}",
            amount=amount,
            status=status,
            txn_type="debit",
            settled_date=day + timedelta(hours=4) if status == "success" else None,
            created_date=day,
            user_id=user.id,
        ))


def create_merchant(db: Session, m: dict, now: datetime) -> User:
    n = m["n"]
    user = User(
        id=generate_user_id(MERCHANT_ROLE),
        username=f"{USERNAME_PREFIX}{n}",
        email=f"demo.merchant{n}@example.com",
        password=hash_password(PASSWORD),
        view_password=PASSWORD,
        role=MERCHANT_ROLE,
        full_name=m["full_name"],
        company_name=m["company"],
        phone_number=f"90000000{n:02d}",
        kyc_verified=m["kyc"] == "verified",
        created_at=now - timedelta(days=90 - n * 5),
    )
    db.add(user)
    db.flush()

    settings = MerchantSettings(
        id=user.id,
        payInCharges=random.choice([1.8, 2.0, 2.2, 2.5]),
        payOutCharges=random.choice([0.5, 1.0, 1.5]),
        payOutChargesFlat=random.choice([5.0, 7.0, 10.0]),
        webhook=f"https://merchant{n}.example.com/webhook/payin",
        webhook_payout=f"https://merchant{n}.example.com/webhook/payout",
        ip=f"203.0.113.{10 + n}",  # documentation-only IP range
    )
    db.add(settings)

    if m["kyc"] != "none":
        bank, branch = BANKS[n % len(BANKS)]
        db.add(PayoutBankAccount(
            user_id=user.id,
            account_holder_name=m["company"],
            account_number=f"00001234{n:04d}",
            ifsc_code=f"DUMY000{n:04d}",
            bank_name=bank,
            bank_branch=branch,
            account_type="Current",
            bank_address=m["city"],
            is_validate=m["kyc"] in ("verified", "approved", "review"),
        ))
        if m["kyc"] == "verified" and n == 1:  # one merchant with a second (unverified) account
            db.add(PayoutBankAccount(
                user_id=user.id,
                account_holder_name=m["full_name"],
                account_number=f"00005678{n:04d}",
                ifsc_code=f"DUMY100{n:04d}",
                bank_name=BANKS[0][0],
                bank_branch="Second Branch",
                account_type="Savings",
                bank_address=m["city"],
                is_validate=False,
            ))

    add_kyc(db, user, m, now)
    payin_balance, payout_balance = add_transactions(db, user, m, settings, now)
    db.add(Wallet(user_id=user.id, balance=payin_balance))
    db.add(PayOutWallet(user_id=user.id, balance=payout_balance))
    if m["kyc"] == "verified":
        add_settlements(db, user, now)
    db.add(MerchantEmailValidation(user_id=user.id, enabled=n % 2 == 1, updated_by="ADMIN"))
    return user


# ── commands ────────────────────────────────────────────────────────────
def add_all() -> None:
    init_db()
    db: Session = SessionLocal()
    now = datetime.now(india_tz).replace(tzinfo=None)
    created, skipped = [], []
    try:
        for m in MERCHANTS:
            username = f"{USERNAME_PREFIX}{m['n']}"
            existing = db.query(User).filter(
                (User.username == username) | (User.email == f"demo.merchant{m['n']}@example.com")
            ).first()
            if existing:
                skipped.append(existing)
                continue
            created.append((create_merchant(db, m, now), m))
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        rows = [(u.id, u.username, u.email, m["company"], COMPANY_TYPES.get(m["type"], "—"), m["kyc"]) for u, m in created]
        db.close()

    print(f"\n  Dummy merchants created: {len(rows)}   (already existed, skipped: {len(skipped)})")
    if rows:
        print(f"  Password for all: {PASSWORD}\n")
        print(f"  {'ID':<14} {'Username':<18} {'Email':<30} {'Company':<26} {'KYC stage'}")
        print("  " + "─" * 104)
        for r in rows:
            print(f"  {r[0]:<14} {r[1]:<18} {r[2]:<30} {r[3][:25]:<26} {r[5]}")
    print()


def remove_all() -> None:
    init_db()
    db: Session = SessionLocal()
    try:
        users = db.query(User).filter(User.username.like(f"{USERNAME_PREFIX}%"), User.role == MERCHANT_ROLE).all()
        for u in users:
            db.query(MerchantEmailValidation).filter(MerchantEmailValidation.user_id == u.id).delete()
            db.query(MerchantSettings).filter(MerchantSettings.id == u.id).delete()
            shutil.rmtree(os.path.join(KYC_UPLOAD_DIR, u.id), ignore_errors=True)
            db.delete(u)  # wallets, transactions, bank accounts, settlements and KYC items cascade
        db.commit()
        print(f"\n  Removed {len(users)} dummy merchants.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("\n  Vichitrapay — Dummy Merchant Data")
    print("  ═════════════════════════════════")
    remove_all() if "--remove" in sys.argv else add_all()
