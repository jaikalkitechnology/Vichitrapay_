"""
Vichitrapay — TPS (transactions per second) load test for the PayIn API

Sends many requests at the same time to the Vichitrapay API and reports how many it
handled per second (TPS), response times (avg, p50, p90, p95, p99, max) and every error.
Needs only `requests` (pip install requests). Logs in once and reuses the token.

Only Vichitrapay itself is tested — no request goes to a TSP (payment provider).

Modes (--mode):
    status    GET  /live/payin/txns/status   (default: PayIn status lookup, database read)
    login     POST /api/v1/auth/login        (password check + token)
    initiate  POST /live/payin/initiate      for a merchant with NO Pay-in mapping: Vichitrapay runs
                                             all its checks (token, KYC, email, IP, provider lookup)
                                             and answers 400 "No active PayIn provider" — no TSP call,
                                             nothing saved. The script first checks the merchant has
                                             no mapping and stops if one is set.

    python tps_test.py                                   # 200 status requests, 20 at a time
    python tps_test.py -n 1000 -c 50                     # 1000 requests, 50 at a time
    python tps_test.py --mode status --order ORDER_ID    # status of a real order (expects 200)
    python tps_test.py --mode login -n 300 -c 30
    python tps_test.py --mode initiate -n 500 -c 25 --login <merchant without Pay-in mapping>

-n  total requests      -c  how many run at the same time (concurrency)
Settings can also come from env: VICHITRAPAY_API, MERCHANT_LOGIN, MERCHANT_PASSWORD
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
    args = ap.parse_args()

    if args.requests < 1 or args.concurrency < 1:
        ap.error("-n and -c must be at least 1")

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
    expect_text = None  # text the reply must contain to count as successful

    if args.mode == "initiate":
        # safety: only run when the merchant has NO Pay-in mapping, so no request reaches a TSP
        r = factory().get(f"{api}/live/payin/ticket-sizes", headers=auth, timeout=TIMEOUT)
        if not (r.status_code == 400 and "No active PayIn provider" in r.text):
            print(f"\n  ✗ Stopped: this merchant has a Pay-in mapping (ticket-sizes → HTTP {r.status_code}), so initiate")
            print("    would create real payments at the TSP. Turn its Pay-in off in admin → TSP Mappings,")
            print("    or use --login with a merchant that has no Pay-in mapping.\n")
            return 1
        print("  Check       : ✓ no Pay-in mapping — requests stop before any TSP")
        expect, expect_text = {400}, "No active PayIn provider"

        def call(i):
            body = {"amount": 100.0, "merchantOrderId": f"TPS{run_id}{i:05d}", "channel": "api", "purpose": "TPS test",
                    "customer": {"buyer_name": "TPS Test", "email": "tps.test@gmail.com", "phone": "9876543210"}}
            return session(factory).post(f"{api}/live/payin/initiate", json=body, headers=auth, timeout=TIMEOUT)
    elif args.mode == "status":
        expect = {200} if args.order else {404}
        order = args.order or f"TPS-NOT-FOUND-{run_id}"

        def call(i):
            return session(factory).get(f"{api}/live/payin/txns/status", params={"merchantOrderId": order}, headers=auth, timeout=TIMEOUT)
    else:
        expect = {200}

        def call(i):
            return session(factory).post(f"{api}/api/v1/auth/login", data={"username": args.login, "password": args.password}, timeout=TIMEOUT)

    results = []  # (ok, code_or_error, ms)
    lock = threading.Lock()
    done = [0]

    def one(i):
        t0 = time.perf_counter()
        try:
            resp = call(i)
            ms = (time.perf_counter() - t0) * 1000
            good = resp.status_code in expect and (expect_text is None or expect_text in resp.text)
            res = (good, f"HTTP {resp.status_code}", ms, None if good else resp.text[:160])
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
    print(f"  Successful  : {len(good)}/{len(results)}  ({100 * len(good) / len(results):.1f}%)   expected {', '.join(f'HTTP {c}' for c in sorted(expect))}" + (f' "{expect_text}"' if expect_text else ""))
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
