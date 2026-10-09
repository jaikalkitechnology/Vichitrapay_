"""
Vichitrapay — Test PayIn Script

Logs in as a merchant and creates a ₹100 PayIn through the live API:

    1. POST {API}/api/v1/auth/login      → access token
    2. POST {API}/live/payin/initiate    → payment_url
    3. GET  {API}/live/payin/txns/status → current status of the order

Run from anywhere (needs the `requests` package):

    python payment.py --email yourname@gmail.com   # ₹100 payment
    python payment.py --amount 250     # another amount
    python payment.py --status ORDER_ID   # only check the status of an earlier order
    python payment.py --tickets           # list the amounts the provider allows

Settings can also come from environment variables:
    VICHITRAPAY_API, MERCHANT_LOGIN, MERCHANT_PASSWORD

Before it works for a merchant, in the admin panel that merchant must have:
  - final KYC approval (kyc_verified), otherwise → 403 "KYC not completed"
  - an active PayIn provider (Merchant details → Credential Setting), otherwise → 400 "No active PayIn provider"
  - the IP of the computer running this script in its whitelist, or an empty IP field
    (Merchant details → Charges Setting), otherwise → 403 "IP ... is not whitelisted"
"""

import argparse
import json
import os
import sys
import time
import uuid

import requests

# ═══════════════════════════════════════════════
#  Settings
# ═══════════════════════════════════════════════
API = os.getenv("VICHITRAPAY_API", "https://api.vichitrapay.com").rstrip("/")

# merchant login (used to get the token for the PayIn API)
MERCHANT_LOGIN = os.getenv("MERCHANT_LOGIN", "demo.merchant2@example.com")
MERCHANT_PASSWORD = os.getenv("MERCHANT_PASSWORD", "Demo@1234")

AMOUNT = 100.0

# Customer on the payment. Templamart only accepts real email providers (gmail.com, yahoo.com,
# outlook.com, msn.com ...) — not example.com. Pass them with --email/--name/--phone or set
# CUSTOMER_EMAIL / CUSTOMER_NAME / CUSTOMER_PHONE.
CUSTOMER_EMAIL = os.getenv("CUSTOMER_EMAIL", "")
CUSTOMER_NAME = os.getenv("CUSTOMER_NAME", "Test Customer")
CUSTOMER_PHONE = os.getenv("CUSTOMER_PHONE", "9876543210")

TIMEOUT = 30  # seconds per request


def fail(step: str, resp: requests.Response) -> None:
    try:
        detail = resp.json()
    except ValueError:
        detail = resp.text[:500]
    print(f"\n  ✗ {step} failed — HTTP {resp.status_code}")
    print(f"    {json.dumps(detail, indent=2) if isinstance(detail, (dict, list)) else detail}")
    sys.exit(1)


def login(http, api: str, username: str, password: str) -> str:
    """Returns the bearer token for the merchant."""
    resp = http.post(
        f"{api}/api/v1/auth/login",
        data={"username": username, "password": password},  # form-encoded (OAuth2 password flow)
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        fail("Login", resp)
    body = resp.json()
    if body.get("role") != 2:
        print(f"\n  ✗ {username} is not a merchant account (role {body.get('role')}).")
        sys.exit(1)
    return body["access_token"]


def create_payment(http, api: str, token: str, amount: float, customer: dict) -> dict:
    order_id = f"TEST{time.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "amount": amount,
        "merchantOrderId": order_id,
        "channel": "web",
        "purpose": "Test Payment",
        "customer": customer,
    }
    resp = http.post(
        f"{api}/live/payin/initiate",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        fail("PayIn initiate", resp)
    return resp.json()


def ticket_sizes(http, api: str, token: str) -> dict:
    resp = http.get(f"{api}/live/payin/ticket-sizes", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)
    if resp.status_code != 200:
        fail("Ticket sizes", resp)
    return resp.json()


def check_status(http, api: str, token: str, order_id: str) -> dict:
    resp = http.get(
        f"{api}/live/payin/txns/status",
        params={"merchantOrderId": order_id},
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        fail("Status check", resp)
    return resp.json()


def main(http=None) -> None:
    parser = argparse.ArgumentParser(description="Create a test PayIn on Vichitrapay")
    parser.add_argument("--amount", type=float, default=AMOUNT, help="amount in rupees (default 100)")
    parser.add_argument("--tickets", action="store_true", help="only list the amounts (ticket sizes) the provider allows")
    parser.add_argument("--status", metavar="ORDER_ID", help="only check the status of an existing merchantOrderId")
    parser.add_argument("--api", default=API, help=f"API base URL (default {API})")
    parser.add_argument("--email", default=CUSTOMER_EMAIL, help="customer email (gmail/yahoo/outlook/msn...)")
    parser.add_argument("--name", default=CUSTOMER_NAME, help="customer name")
    parser.add_argument("--phone", default=CUSTOMER_PHONE, help="customer 10-digit mobile")
    args = parser.parse_args()
    http = http or requests.Session()
    api = args.api.rstrip("/")

    print("\n  Vichitrapay — Test PayIn")
    print("  ════════════════════════")
    print(f"  API      : {api}")
    print(f"  Merchant : {MERCHANT_LOGIN}")

    token = login(http, api, MERCHANT_LOGIN, MERCHANT_PASSWORD)
    print("  ✓ Logged in")

    if args.tickets:
        t = ticket_sizes(http, api, token)
        print(f"\n  Provider : {t.get('provider')}")
        if not t.get("ticket_size_required", True):
            print(f"  {t.get('message') or 'No ticket sizes — any amount is accepted'}")
        else:
            print("  Allowed amounts (ticket sizes):")
            print("    " + json.dumps(t.get("ticket_sizes"), indent=2).replace("\n", "\n    "))
        return

    if args.status:
        print(json.dumps(check_status(http, api, token, args.status), indent=2))
        return

    if args.amount <= 0:
        print("\n  ✗ Amount must be more than 0")
        sys.exit(1)

    email = (args.email or "").strip()
    if not email or "@" not in email:
        print("\n  ✗ Customer email is required, e.g.  python payment.py --email yourname@gmail.com")
        print("    (Templamart accepts gmail.com, yahoo.com, outlook.com, msn.com ... — not example.com)")
        sys.exit(1)
    customer = {"buyer_name": args.name, "email": email, "phone": args.phone}
    result = create_payment(http, api, token, args.amount, customer)
    order_id = result.get("merchantOrderId")
    print(f"  ✓ Payment of ₹{args.amount:,.2f} created")
    print("\n  ─────────────────────────────")
    print(f"  Order ID    : {order_id}")
    print(f"  Provider    : {result.get('provider')}")
    print(f"  Payment URL : {result.get('payment_url') or '— (provider returned no URL)'}")
    print("  ─────────────────────────────")

    try:
        status = check_status(http, api, token, order_id)
        print(f"  Status now  : {status.get('status', status)}")
    except SystemExit:
        pass  # the payment was created; a failed status check shouldn't hide that

    print(f"\n  Open the payment URL to pay. Check later with:\n    python payment.py --status {order_id}\n")


if __name__ == "__main__":
    main()
