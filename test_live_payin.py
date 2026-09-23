"""
Test script for /live/payin endpoints:
  1. Login → get token
  2. GET  /live/payin/ticket-sizes
  3. POST /live/payin/initiate
  4. POST /live/payin/upi-intent

Usage:
  python test_live_payin.py

Env overrides (optional):
  BASE_URL   — default: http://127.0.0.1:8000
  USERNAME   — default: john.doe@example.com
  PASSWORD   — default: Pass@1234
"""

import os
import sys
import json
import uuid
import requests

# ═══════════════════════════════════════════════
#  Config
# ═══════════════════════════════════════════════
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")
USERNAME = "karan"
PASSWORD = "Pass@1234"

LOGIN_URL       = f"{BASE_URL}/api/v1/auth/login"
TICKET_SIZE_URL = f"{BASE_URL}/live/payin/ticket-sizes"
INITIATE_URL    = f"{BASE_URL}/live/payin/initiate"
UPI_INTENT_URL  = f"{BASE_URL}/live/payin/upi-intent"

DIVIDER = "=" * 60
passed = 0
failed = 0


def pretty(obj):
    try:
        return json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        return str(obj)


def assert_ok(label, status_code, expected=200):
    global passed, failed
    if status_code == expected:
        print(f"  ✅  {label} — {status_code}")
        passed += 1
    else:
        print(f"  ❌  {label} — Expected {expected}, got {status_code}")
        failed += 1


# ═══════════════════════════════════════════════
#  Step 1: Login
# ═══════════════════════════════════════════════
def login() -> str:
    print(f"\n{DIVIDER}")
    print(f"STEP 1 — POST {LOGIN_URL}")
    print(DIVIDER)

    r = requests.post(
        LOGIN_URL,
        data={"username": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    print(f"  Status : {r.status_code}")
    body = r.json()
    print(f"  Response:\n{pretty(body)}")
    assert_ok("Login", r.status_code, 200)

    token = body.get("access_token")
    if not token:
        print("  ❌  No access_token in response — aborting")
        sys.exit(1)

    print(f"  Token  : {token[:40]}...")
    print(f"  Expires: {body.get('expires_in')}s / {body.get('expires_at')}")
    return token


# ═══════════════════════════════════════════════
#  Step 2: Ticket Sizes
# ═══════════════════════════════════════════════
def get_ticket_sizes(token: str) -> dict:
    print(f"\n{DIVIDER}")
    print(f"STEP 2 — GET {TICKET_SIZE_URL}")
    print(DIVIDER)

    r = requests.get(
        TICKET_SIZE_URL,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    print(f"  Status : {r.status_code}")
    body = r.json()
    print(f"  Response:\n{pretty(body)}")
    assert_ok("Ticket Sizes", r.status_code, 200)
    return body


# ═══════════════════════════════════════════════
#  Step 3: Initiate PayIn
# ═══════════════════════════════════════════════
def initiate_payin(token: str, amount: float) -> dict:
    order_id = f"TEST_{uuid.uuid4().hex[:12].upper()}"

    payload = {
        "amount": amount,
        "merchantOrderId": order_id,
        "channel": "web",
        "purpose": "Test Payment",
        "customer": {
            "buyer_name": "Test User",
            "email": "test@example.com",
            "phone": "9876543210",
            "address1": "123 Test Street, Test City",
            "address2": "Near Test Landmark",
        },
    }

    print(f"\n{DIVIDER}")
    print(f"STEP 3 — POST {INITIATE_URL}")
    print(DIVIDER)
    print(f"  Payload:\n{pretty(payload)}")

    r = requests.post(
        INITIATE_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=45,
    )
    print(f"  Status : {r.status_code}")
    body = r.json()
    print(f"  Response:\n{pretty(body)}")
    assert_ok("Initiate PayIn", r.status_code, 200)

    if body.get("payment_url"):
        print(f"\n  🔗 Payment URL: {body['payment_url']}")

    return body


# ═══════════════════════════════════════════════
#  Step 4: UPI Intent
# ═══════════════════════════════════════════════
def upi_intent(token: str, amount: float) -> dict:
    order_id = f"UPI_{uuid.uuid4().hex[:12].upper()}"

    payload = {
        "amount": amount,
        "merchantOrderId": order_id,
        "channel": "api",
        "purpose": "UPI Test Payment",
        "customer": {
            "buyer_name": "UPI Test User",
            "email": "upi@example.com",
            "phone": "9876543210",
            "address1": "456 UPI Street, Payment City",
        },
    }

    print(f"\n{DIVIDER}")
    print(f"STEP 4 — POST {UPI_INTENT_URL}")
    print(DIVIDER)
    print(f"  Payload:\n{pretty(payload)}")

    r = requests.post(
        UPI_INTENT_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=45,
    )
    print(f"  Status : {r.status_code}")
    body = r.json()
    print(f"  Response:\n{pretty(body)}")
    assert_ok("UPI Intent", r.status_code, 200)

    if body.get("intent_url"):
        print(f"\n  📱 Intent URL: {body['intent_url']}")
    if body.get("qr_data"):
        print(f"  📷 QR Data   : {body['qr_data'][:80]}...")
    if body.get("payment_url"):
        print(f"  🔗 Fallback  : {body['payment_url']}")

    return body


# ═══════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════
def main():
    print(f"\n{'#' * 60}")
    print(f"  Vichitrapay Live PayIn Test Suite")
    print(f"  Base URL : {BASE_URL}")
    print(f"  Username : {USERNAME}")
    print(f"{'#' * 60}")

    # 1. Login
    token = login()

    # 2. Ticket sizes
    ts = get_ticket_sizes(token)
    ticket_sizes = ts.get("ticket_sizes", [])
    ticket_required = ts.get("ticket_size_required", False)

    # pick amount
    if ticket_required and ticket_sizes:
        amount = ticket_sizes[0]
        print(f"\n  Ticket sizes required — using first available: {amount}")
    else:
        amount = 500.0
        print(f"\n  Ticket sizes NOT required — using default: {amount}")

    # 3. Initiate PayIn
    #initiate_payin(token, amount)

    # 4. UPI Intent
    upi_intent(token, amount)

    # Summary
    print(f"\n{'#' * 60}")
    if failed == 0:
        print(f"  ✅  ALL {passed} TESTS PASSED")
    else:
        print(f"  ❌  {failed} FAILED, {passed} PASSED")
    print(f"{'#' * 60}\n")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
