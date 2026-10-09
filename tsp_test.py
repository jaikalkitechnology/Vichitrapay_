"""
Vichitrapay — PayIn TSP test (through the Vichitrapay API)

Tests the PayIn TSP (payment provider) that Vichitrapay uses for a merchant, the way a
merchant would: over HTTPS, through Vichitrapay's own API. Needs only `requests`
(pip install requests) — no database, no venv, runs from any computer.

    python tsp_test.py                                   # which TSP is active + allowed amounts (no payment)
    python tsp_test.py --pay --email yourname@gmail.com  # also create a real ₹100 payment through Vichitrapay
    python tsp_test.py --pay --amount 300 --email yourname@gmail.com
    python tsp_test.py --login other.merchant@example.com --password '...'   # another merchant / TSP

Steps:
    1. POST /api/v1/auth/login            merchant login
    2. GET  /live/payin/ticket-sizes      which TSP Vichitrapay routes this merchant to + allowed amounts
    3. POST /live/payin/initiate          (--pay) create the payment → TSP + payment URL
    4. GET  /live/payin/txns/status       (--pay) status of that order in Vichitrapay

The TSP is chosen by Vichitrapay from the merchant's Pay-in mapping (admin → TSP Mappings).
To test another TSP, switch the mapping, or log in as a merchant mapped to it.
--pay creates a real payment link; nothing is charged unless someone pays it.

Settings can also come from env: VICHITRAPAY_API, MERCHANT_LOGIN, MERCHANT_PASSWORD, CUSTOMER_EMAIL
"""

import argparse
import json
import os
import sys
import time
import uuid

import requests

API = os.getenv("VICHITRAPAY_API", "https://api.vichitrapay.com").rstrip("/")
LOGIN = os.getenv("MERCHANT_LOGIN", "demo.merchant2@example.com")
PASSWORD = os.getenv("MERCHANT_PASSWORD", "Demo@1234")
TIMEOUT = 45


def ok(msg):
    print(f"    ✓ {msg}")


def bad(msg):
    print(f"    ✗ {msg}")


def detail(resp):
    try:
        body = resp.json()
        return body.get("detail", body) if isinstance(body, dict) else body
    except ValueError:
        return resp.text[:500]


def step(n, title):
    print(f"\n  {n}. {title}")


def allowed(amount, sizes):
    """Ticket sizes may come as numbers or as objects like {"amount": 100}."""
    vals = []
    for s in sizes or []:
        v = s.get("amount", s.get("value")) if isinstance(s, dict) else s
        try:
            vals.append(float(v))
        except (TypeError, ValueError):
            pass
    return (amount in vals) if vals else None


def main(http=None) -> int:
    ap = argparse.ArgumentParser(description="Test the PayIn TSP through the Vichitrapay API")
    ap.add_argument("--api", default=API, help=f"Vichitrapay API (default {API})")
    ap.add_argument("--login", default=LOGIN, help="merchant email or username")
    ap.add_argument("--password", default=PASSWORD)
    ap.add_argument("--pay", action="store_true", help="also create a real payment through Vichitrapay")
    ap.add_argument("--amount", type=float, default=100.0, help="payment amount in ₹ (default 100)")
    ap.add_argument("--email", default=os.getenv("CUSTOMER_EMAIL", ""), help="customer email for --pay (gmail/yahoo/outlook...)")
    ap.add_argument("--name", default="Test Customer")
    ap.add_argument("--phone", default="9876543210")
    args = ap.parse_args()
    if args.pay and "@" not in args.email:
        ap.error("--pay needs --email with a real provider (gmail.com, yahoo.com ...); example.com is rejected")

    http = http or requests.Session()
    api = args.api.rstrip("/")
    print("\n  Vichitrapay — PayIn TSP test")
    print("  ════════════════════════════")
    print(f"  API      : {api}")
    print(f"  Merchant : {args.login}")

    # 1. login
    step(1, "Merchant login")
    r = http.post(f"{api}/api/v1/auth/login", data={"username": args.login, "password": args.password}, timeout=TIMEOUT)
    if r.status_code != 200:
        bad(f"HTTP {r.status_code}: {detail(r)}")
        return 1
    body = r.json()
    if body.get("role") != 2:
        bad(f"{args.login} is not a merchant (role {body.get('role')})")
        return 1
    auth = {"Authorization": f"Bearer {body['access_token']}"}
    ok("logged in")

    # 2. which TSP + ticket sizes
    step(2, "Active PayIn TSP (from the merchant's Pay-in mapping)")
    r = http.get(f"{api}/live/payin/ticket-sizes", headers=auth, timeout=TIMEOUT)
    if r.status_code != 200:
        bad(f"HTTP {r.status_code}: {detail(r)}")
        if r.status_code == 400:
            print("      → admin → TSP Mappings: turn on Pay-in for this merchant")
        return 1
    t = r.json()
    tsp = t.get("provider")
    ok(f"TSP: {tsp}")
    if t.get("ticket_size_required") is False:
        ok(t.get("message") or "any amount accepted")
    else:
        sizes = t.get("ticket_sizes")
        ok(f"allowed amounts: {json.dumps(sizes)}")
        fits = allowed(args.amount, sizes)
        if fits is False:
            bad(f"₹{args.amount:g} is not an allowed amount for {tsp} — use --amount with one of the above")

    if not args.pay:
        print("\n  TSP reachable through Vichitrapay. Add --pay --email you@gmail.com to create a payment.\n")
        return 0

    # 3. create the payment through Vichitrapay
    order_id = f"TSPTEST{time.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"
    step(3, f"Create ₹{args.amount:g} payment via /live/payin/initiate")
    payload = {"amount": args.amount, "merchantOrderId": order_id, "channel": "web", "purpose": "TSP test",
               "customer": {"buyer_name": args.name, "email": args.email, "phone": args.phone}}
    r = http.post(f"{api}/live/payin/initiate", json=payload, headers=auth, timeout=TIMEOUT)
    if r.status_code != 200:
        bad(f"HTTP {r.status_code}: {detail(r)}")
        return 1
    res = r.json()
    ok(f"created by TSP: {res.get('provider')}")
    ok(f"order      : {order_id}")
    ok(f"payment URL: {res.get('payment_url') or '— (TSP returned no URL)'}")

    # 4. status in Vichitrapay
    step(4, "Order status in Vichitrapay")
    r = http.get(f"{api}/live/payin/txns/status", params={"merchantOrderId": order_id}, headers=auth, timeout=TIMEOUT)
    if r.status_code != 200:
        bad(f"HTTP {r.status_code}: {detail(r)}")
        return 1
    ok(f"status: {r.json().get('status')}")
    print(f"\n  Pay the link, then check:  python payment.py --status {order_id}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
