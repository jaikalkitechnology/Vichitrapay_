"""
Vichitrapay — TPS (transactions per second) load test for the PayIn API

Sends many requests at the same time to the Vichitrapay API and reports how many it
handled per second (TPS), response times (avg, p50, p90, p95, p99, max) and every error.
Needs only `requests` (pip install requests). Logs in once and reuses the token.

Modes (--mode):
    status    GET  /live/payin/txns/status   (default, SAFE: database read only, no TSP call)
    login     POST /api/v1/auth/login        (SAFE: password check + token)
    initiate  POST /live/payin/initiate      (REAL: every request creates a real payment order
                                              at the TSP — needs --real and --email, max 200)

    python tps_test.py                                   # 200 status requests, 20 at a time
    python tps_test.py -n 1000 -c 50                     # 1000 requests, 50 at a time
    python tps_test.py --mode status --order ORDER_ID    # status of a real order (expects 200)
    python tps_test.py --mode login -n 300 -c 30
    python tps_test.py --mode initiate -n 20 -c 5 --real --email yourname@gmail.com

-n  total requests      -c  how many run at the same time (concurrency)
Run it from a machine whose IP the merchant allows (merchant IP whitelist), and tell the
TSP before a large --mode initiate run.

Settings can also come from env: VICHITRAPAY_API, MERCHANT_LOGIN, MERCHANT_PASSWORD, CUSTOMER_EMAIL
"""

import argparse
import os
import statistics
import sys
import threading
import time
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import requests

API = os.getenv("VICHITRAPAY_API", "https://api.vichitrapay.com").rstrip("/")
LOGIN = os.getenv("MERCHANT_LOGIN", "demo.merchant2@example.com")
PASSWORD = os.getenv("MERCHANT_PASSWORD", "Demo@1234")
MAX_REAL = 200  # cap for --mode initiate (each one is a real order at the TSP)
TIMEOUT = 60

_local = threading.local()


def session(factory):
    """One HTTP session per worker thread (keeps connections open between its requests)."""
    if not hasattr(_local, "s"):
        _local.s = factory()
    return _local.s


def pct(sorted_ms, p):
    if not sorted_ms:
        return 0.0
    k = (len(sorted_ms) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(sorted_ms) - 1)
    return sorted_ms[lo] + (sorted_ms[hi] - sorted_ms[lo]) * (k - lo)


def main(factory=requests.Session) -> int:
    ap = argparse.ArgumentParser(description="TPS load test for the Vichitrapay PayIn API")
    ap.add_argument("--api", default=API)
    ap.add_argument("--login", default=LOGIN, help="merchant email or username")
    ap.add_argument("--password", default=PASSWORD)
    ap.add_argument("--mode", choices=["status", "login", "initiate"], default="status")
    ap.add_argument("-n", "--requests", type=int, default=200, help="total requests (default 200)")
    ap.add_argument("-c", "--concurrency", type=int, default=20, help="requests at the same time (default 20)")
    ap.add_argument("--order", help="status mode: an existing merchantOrderId (expects 200; without it expects 404)")
    ap.add_argument("--amount", type=float, default=100.0, help="initiate mode: amount in ₹ (default 100)")
    ap.add_argument("--email", default=os.getenv("CUSTOMER_EMAIL", ""), help="initiate mode: customer email (gmail/yahoo...)")
    ap.add_argument("--real", action="store_true", help="initiate mode: confirm you want real TSP orders")
    args = ap.parse_args()

    if args.requests < 1 or args.concurrency < 1:
        ap.error("-n and -c must be at least 1")
    if args.mode == "initiate":
        if not args.real:
            ap.error(f"--mode initiate creates a REAL payment order at the TSP for every request; add --real to confirm (max {MAX_REAL})")
        if args.requests > MAX_REAL:
            ap.error(f"--mode initiate is capped at {MAX_REAL} requests")
        if "@" not in args.email:
            ap.error("--mode initiate needs --email with a real provider (gmail.com, yahoo.com ...)")

    api = args.api.rstrip("/")
    print("\n  Vichitrapay — TPS test")
    print("  ═════════════════════")
    print(f"  API         : {api}")
    print(f"  Merchant    : {args.login}")
    print(f"  Mode        : {args.mode}")
    print(f"  Requests    : {args.requests}   at the same time: {args.concurrency}")

    # log in once (status / initiate reuse the token)
    r = factory().post(f"{api}/api/v1/auth/login", data={"username": args.login, "password": args.password}, timeout=TIMEOUT)
    if r.status_code != 200:
        print(f"\n  ✗ Login failed — HTTP {r.status_code}: {r.text[:300]}\n")
        return 1
    auth = {"Authorization": f"Bearer {r.json()['access_token']}"}
    run_id = uuid.uuid4().hex[:6].upper()

    if args.mode == "status":
        expect = {200} if args.order else {404}
        order = args.order or f"TPS-NOT-FOUND-{run_id}"

        def call(i):
            return session(factory).get(f"{api}/live/payin/txns/status", params={"merchantOrderId": order}, headers=auth, timeout=TIMEOUT)
    elif args.mode == "login":
        expect = {200}

        def call(i):
            return session(factory).post(f"{api}/api/v1/auth/login", data={"username": args.login, "password": args.password}, timeout=TIMEOUT)
    else:
        expect = {200}

        def call(i):
            body = {"amount": args.amount, "merchantOrderId": f"TPS{run_id}{i:05d}", "channel": "api", "purpose": "TPS test",
                    "customer": {"buyer_name": "TPS Test", "email": args.email, "phone": "9876543210"}}
            return session(factory).post(f"{api}/live/payin/initiate", json=body, headers=auth, timeout=TIMEOUT)

    results = []  # (ok, code_or_error, ms)
    lock = threading.Lock()
    done = [0]

    def one(i):
        t0 = time.perf_counter()
        try:
            resp = call(i)
            ms = (time.perf_counter() - t0) * 1000
            res = (resp.status_code in expect, f"HTTP {resp.status_code}", ms,
                   None if resp.status_code in expect else resp.text[:160])
        except Exception as exc:
            ms = (time.perf_counter() - t0) * 1000
            res = (False, type(exc).__name__, ms, str(exc)[:160])
        with lock:
            results.append(res)
            done[0] += 1
            if done[0] % max(1, args.requests // 10) == 0 or done[0] == args.requests:
                print(f"\r  Progress    : {done[0]}/{args.requests}", end="", flush=True)

    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        list(pool.map(one, range(args.requests)))
    elapsed = time.perf_counter() - start
    print()

    good = [r for r in results if r[0]]
    ms_all = sorted(r[2] for r in results)
    ms_ok = sorted(r[2] for r in good)
    codes = Counter(r[1] for r in results)
    errors = Counter((r[1], r[3]) for r in results if not r[0])

    print("\n  Result")
    print("  ──────")
    print(f"  Time taken  : {elapsed:.2f} s")
    print(f"  TPS         : {len(results) / elapsed:.1f} requests/s   ({len(good) / elapsed:.1f} successful/s)")
    print(f"  Successful  : {len(good)}/{len(results)}  ({100 * len(good) / len(results):.1f}%)   expected {', '.join(f'HTTP {c}' for c in sorted(expect))}")
    print(f"  Responses   : " + ", ".join(f"{k} × {v}" for k, v in codes.most_common()))
    src = ms_ok or ms_all
    print(f"  Time / req  : avg {statistics.mean(src):.0f} ms · p50 {pct(src, 50):.0f} · p90 {pct(src, 90):.0f} · "
          f"p95 {pct(src, 95):.0f} · p99 {pct(src, 99):.0f} · max {src[-1]:.0f} ms" + ("" if ms_ok else "  (all failed)"))
    if errors:
        print("\n  Errors")
        for (kind, msg), n in errors.most_common(8):
            print(f"    {n:>5} × {kind}: {msg or ''}")
    print()
    return 0 if len(good) == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
