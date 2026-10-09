"""
Vichitrapay — TSP (payment provider) test

Tests a provider directly with the app's own gateway code (app/crud/gateway/*),
without a merchant and without going through /live/payin/initiate. Run it on the
API server, from the project root, with the backend's venv (it uses the same
database settings as the app, and every provider call is logged like a real one).

    python tsp_test.py                       # check every provider (safe: login / balance only)
    python tsp_test.py templamart            # check one provider
    python tsp_test.py templamart --pay 100 --email yourname@gmail.com
                                             # ALSO create a real ₹100 payment link at the provider
    python tsp_test.py gurutvapay --pay 100 --email yourname@gmail.com

Checks (no money moves):
    templamart  login + ticket sizes (allowed amounts)
    gurutvapay  login (any amount accepted)
    grv         GurutvaPay payout: login + payout balance
    mizorpay    payout balance

--pay creates a REAL payment order at the provider and prints its payment URL. Nothing
is charged unless someone pays the link. It is not linked to a Vichitrapay transaction,
so a webhook for it will say "Transaction not found" — use payment.py to test the full flow.
"""

import argparse
import json
import os
import sys
import time
import traceback
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))

from utils.database import SessionLocal  # noqa: E402


def ok(msg):
    print(f"    ✓ {msg}")


def bad(msg):
    print(f"    ✗ {msg}")


def show(obj, limit=900):
    text = json.dumps(obj, indent=2, default=str)
    print("      " + (text if len(text) <= limit else text[:limit] + "\n      …").replace("\n", "\n      "))


def customer(args):
    return {"buyer_name": args.name, "email": args.email, "phone": args.phone}


def new_order_id():
    return f"TSPTEST{time.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


# ── providers ───────────────────────────────────────────────────────────
def test_templamart(db, args):
    from crud.gateway import templamart as tm
    print(f"    account : {tm.TEMPLAMART_USERNAME}  ({tm.BASE_URL})")
    token = tm._get_cached_token(db, tm.TEMPLAMART_USERNAME, tm.TEMPLAMART_PASSWORD)
    ok("login works")
    sizes = tm._get_ticket_sizes(db, token)
    ok(f"ticket sizes: {sizes}")
    if args.pay:
        ctx = {"db": db, "merchant_id": None, "merchant_order_id": new_order_id(), "amount": args.pay,
               "channel": "web", "purpose": "TSP test", "customer": customer(args)}
        res = tm.initiate_templamart_payin(ctx)
        ok(f"payment created — order {ctx['merchant_order_id']}")
        print(f"      payment URL: {res.get('payment_url')}")
        show(res.get("raw"))


def test_gurutvapay(db, args):
    from crud.gateway import gurutvapay as gp
    print(f"    account : {gp.GURUTVAPAY_USERNAME}  ({gp.BASE_URL})")
    gp._get_cached_token(db)
    ok("login works (any amount accepted, no ticket sizes)")
    if args.pay:
        ctx = {"db": db, "merchant_id": None, "merchant_order_id": new_order_id(), "amount": args.pay,
               "channel": "web", "purpose": "TSP test", "customer": customer(args)}
        res = gp.initiate_gurutvapay_payin(ctx)
        ok(f"payment created — order {ctx['merchant_order_id']}")
        print(f"      payment URL: {res.get('payment_url')}")
        show(res.get("raw"))


def test_grv(db, args):
    from crud.gateway import grv_payout as grv
    print(f"    account : {grv.GRV_USERNAME}  ({grv.BASE_URL})")
    res = grv.get_grv_payout_balance(db)
    ok(f"login + balance works: {res.get('balance')}")
    show(res)


def test_mizorpay(db, args):
    from crud.gateway import mizorpay as mz
    res = mz.get_mizorpay_balance(db)
    if res.get("balance") is None:
        bad("no balance in the reply")
    else:
        ok(f"balance: {res.get('balance')}")
    show(res)


TESTS = {
    "templamart": ("PayIn", test_templamart),
    "gurutvapay": ("PayIn", test_gurutvapay),
    "grv": ("PayOut", test_grv),
    "mizorpay": ("PayOut", test_mizorpay),
}


def main():
    ap = argparse.ArgumentParser(description="Test Vichitrapay's payment providers (TSPs) directly")
    ap.add_argument("provider", nargs="?", choices=list(TESTS), help="one provider (default: all)")
    ap.add_argument("--pay", type=float, metavar="AMOUNT", help="also create a real payment link of this amount (PayIn providers)")
    ap.add_argument("--email", default=os.getenv("CUSTOMER_EMAIL", ""), help="customer email for --pay (gmail/yahoo/outlook...)")
    ap.add_argument("--name", default="Test Customer")
    ap.add_argument("--phone", default="9876543210")
    args = ap.parse_args()

    if args.pay is not None:
        if not args.provider or TESTS[args.provider][0] != "PayIn":
            ap.error("--pay needs one PayIn provider, e.g.  python tsp_test.py templamart --pay 100 --email you@gmail.com")
        if "@" not in (args.email or ""):
            ap.error("--pay needs --email (a real provider like gmail.com; example.com is rejected)")

    names = [args.provider] if args.provider else list(TESTS)
    print("\n  Vichitrapay — TSP test")
    print("  ══════════════════════")
    results = {}
    db = SessionLocal()
    try:
        for name in names:
            kind, fn = TESTS[name]
            print(f"\n  ▸ {name}  ({kind})")
            try:
                fn(db, args)
                results[name] = "OK"
            except Exception as exc:  # show the provider's own error message
                bad(str(exc)[:600])
                if os.getenv("TSP_TEST_DEBUG"):
                    traceback.print_exc()
                results[name] = "FAILED"
            db.commit()  # keep the provider call logs (templamart_api_logs etc.)
    finally:
        db.close()

    print("\n  Summary")
    for name, res in results.items():
        print(f"    {'✓' if res == 'OK' else '✗'} {name:<11} {res}")
    print()
    sys.exit(0 if all(r == "OK" for r in results.values()) else 1)


if __name__ == "__main__":
    main()
