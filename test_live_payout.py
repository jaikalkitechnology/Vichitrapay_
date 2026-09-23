"""
Test script for /live/payout endpoints:
  1. Login → get token
  2. POST /live/payout/initiate → initiate bank payout
  3. POST /live/payout/status/zeepay → check payout status

Usage:
  python test_live_payout.py

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
PASSWORD = os.getenv("PASSWORD", "Pass@1234")

LOGIN_URL       = f"{BASE_URL}/api/v1/auth/login"
PAYOUT_URL      = f"{BASE_URL}/live/payout/initiate"
STATUS_URL      = f"{BASE_URL}/live/payout/txns/status"

DIVIDER = "=" * 60
passed = 0
failed = 0


def pretty(obj):
    try:
        return json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        return str(obj)


def assert_status(label, actual, expected=200):
    global passed, failed
    if actual == expected:
        print(f"  ✅  {label} — {actual}")
        passed += 1
    else:
        print(f"  ❌  {label} — Expected {expected}, got {actual}")
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
    assert_status("Login", r.status_code, 200)

    token = body.get("access_token")
    if not token:
        print("  ❌  No access_token — aborting")
        sys.exit(1)

    print(f"  Token  : {token[:40]}...")
    return token


# ═══════════════════════════════════════════════
#  Step 2: Initiate Payout
# ═══════════════════════════════════════════════
def initiate_payout(token: str) -> dict:
    order_id = f"PAYTEST_{uuid.uuid4().hex[:10].upper()}"

    payload = {
        "order_id": order_id,
        "amount": "500.00",
        "ifsc": "YESB0000218",
        "accountno": "021852400000740",
        "name": "Gaurav Kumar Singh",
        "branch": "Test Branch",
        "paymode": "IMPS",
        "remarks": f"Payout test {order_id}",
        "mode": "bank",
        "email":"gaurav@neomarts.in",
        "mobile":"9090901190"
    }

    print(f"\n{DIVIDER}")
    print(f"STEP 2 — POST {PAYOUT_URL}")
    print(DIVIDER)
    print(f"  Payload:\n{pretty(payload)}")

    r = requests.post(
        PAYOUT_URL,
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
    assert_status("Initiate Payout", r.status_code, 200)

    return body


# ═══════════════════════════════════════════════
#  Step 3: Check Status (Zeepay)
# ═══════════════════════════════════════════════
def check_status(token: str, order_id: str) -> dict:
    print(f"\n{DIVIDER}")
    print(f"STEP 3 — POST {STATUS_URL}?order_id={order_id}")
    print(DIVIDER)

    r = requests.post(
        f"{STATUS_URL}?order_id={order_id}",
        headers={
            "Authorization": f"Bearer {token}",
        },
        timeout=30,
    )
    print(f"  Status : {r.status_code}")
    body = r.json()
    print(f"  Response:\n{pretty(body)}")
    assert_status("Zeepay Status Check", r.status_code, 200)

    return body


# ═══════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════
def main():
    print(f"\n{'#' * 60}")
    print(f"  Vichitrapay Live Payout Test Suite")
    print(f"  Base URL : {BASE_URL}")
    print(f"  Username : {USERNAME}")
    print(f"{'#' * 60}")

    # 1. Login
    token = login()

    # 2. Initiate Payout
    result = initiate_payout(token)

    # 3. Status Check (if we got a provider txn id)
    # Try to extract txn_id from the payout response
    # The initiate response may not always have a zeepay txn_id
    # depending on the active provider — check anyway
    if result.get("success"):
        print(f"\n  ✅ Payout initiated — order_id: {result.get('order_id')}")
        print(f"     Provider  : {result.get('provider')}")
        print(f"     Debit Amt : {result.get('debit_amount')}")

        # If provider is zeepay, try status check with a sample txn_id
        # In real usage you'd use the actual txn_id from the payout
        print("\n  ℹ️  Attempting status check with sample txn_id...")
        check_status(token, "PAYTEST_92ADD844CA")
    else:
        print(f"\n  ⚠️  Payout initiation returned: {result}")
        # Still try status check
        print("\n  ℹ️  Attempting status check with sample txn_id...")
        check_status(token, "PAYTEST_92ADD844CA")

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
