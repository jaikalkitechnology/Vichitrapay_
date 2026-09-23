"""
Vichitrapay — Admin User Seed Script

Creates a default admin user if one doesn't already exist.
Run once after initial database setup:

    python seed.py

This will create:
  - Admin user (role=3) with full access
  - Associated wallet and payout wallet
"""

from sqlalchemy.orm import Session
from utils.database import SessionLocal, init_db
from utils.authenticate import hash_password
from models.models import User, Wallet, PayOutWallet, ROLE_MAPPING, generate_user_id

# ═══════════════════════════════════════════════
#  Admin credentials — change after first login
# ═══════════════════════════════════════════════
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@vichitrapay.in"
ADMIN_PASSWORD = "Admin@1234"
ADMIN_FULL_NAME = "Vichitrapay Admin"
ADMIN_PHONE = "9999999999"
ADMIN_COMPANY = "Vichitrapay"


def seed_admin():
    init_db()
    db: Session = SessionLocal()

    try:
        existing = db.query(User).filter(
            (User.username == ADMIN_USERNAME) | (User.email == ADMIN_EMAIL)
        ).first()

        if existing:
            print(f"  Admin already exists: {existing.username} ({existing.id})")
            print(f"  Email: {existing.email}")
            print(f"  Role: {existing.role}")
            return

        admin_id = generate_user_id(ROLE_MAPPING["admin"])

        admin = User(
            id=admin_id,
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password=hash_password(ADMIN_PASSWORD),
            view_password=ADMIN_PASSWORD,
            role=ROLE_MAPPING["admin"],
            full_name=ADMIN_FULL_NAME,
            phone_number=ADMIN_PHONE,
            company_name=ADMIN_COMPANY,
            kyc_verified=True,
        )
        db.add(admin)
        db.flush()

        wallet = Wallet(user_id=admin_id, balance=0.0)
        payout_wallet = PayOutWallet(user_id=admin_id, balance=0.0)
        db.add(wallet)
        db.add(payout_wallet)

        db.commit()

        print(f"\n  Admin user created successfully!")
        print(f"  ─────────────────────────────")
        print(f"  ID       : {admin_id}")
        print(f"  Username : {ADMIN_USERNAME}")
        print(f"  Email    : {ADMIN_EMAIL}")
        print(f"  Password : {ADMIN_PASSWORD}")
        print(f"  Role     : Admin (3)")
        print(f"\n  Change the password after first login.\n")

    except Exception as e:
        db.rollback()
        print(f"  Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print(f"\n{'=' * 45}")
    print(f"  Vichitrapay — Admin Seed")
    print(f"{'=' * 45}")
    seed_admin()
