"""
Vichitrapay — Test Webhook Receiver

Acts like a merchant's server: receives the webhook Vichitrapay sends when a PayIn
finishes (event "payin.completed" / "payin.failed"), prints it, saves it to a file
and replies 200 so Vichitrapay marks the delivery as "delivered".

Only uses Python's standard library — nothing to install.

    python webhook.py                       # listen on port 8090, path /webhook/payin
    python webhook.py --port 9000 --path /hook
    python webhook.py --fail                # reply 500 to test Vichitrapay's retries (3 attempts)
    python webhook.py --test                # send one sample webhook to the running receiver

Then set the merchant's webhook URL (admin → Merchants → merchant → Charges Setting → Webhook URL):
  - running on the same server as the Vichitrapay API:  http://127.0.0.1:8090/webhook/payin
  - running on another machine: a public URL to it, e.g.  http://<server-ip>:8090/webhook/payin
    (open the port in the firewall) or an ngrok / cloudflared tunnel URL

What Vichitrapay sends (app/crud/webhook/handler.py → _build_merchant_payload):
    {"event": "payin.completed", "merchantOrderId": "...", "txn_id": "...", "utr": "...",
     "amount": 100.0, "charges": 2.0, "gst": 0.36, "settle_amount": 97.64,
     "status": "success", "description": "PayIn successful", "balance": 1097.64}
Vichitrapay waits up to 10 seconds for a reply and retries up to 3 times on errors.
Every attempt shows in admin → System Logs → Webhook Deliveries.
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

received = []  # newest last, shown on GET /


def make_handler(path: str, log_file: str, fail: bool):
    class Handler(BaseHTTPRequestHandler):
        server_version = "VichitrapayTestWebhook/1.0"

        def _reply(self, code: int, body: dict):
            data = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self):
            if self.path.split("?")[0] != path:
                return self._reply(404, {"error": f"POST to {path}"})
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            try:
                payload = json.loads(raw or b"{}")
            except ValueError:
                payload = {"raw": raw.decode("utf-8", "replace")}

            entry = {
                "received_at": datetime.now().isoformat(timespec="seconds"),
                "from_ip": self.client_address[0],
                "headers": {k: v for k, v in self.headers.items()},
                "payload": payload,
            }
            received.append(entry)
            del received[:-50]
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")

            p = payload if isinstance(payload, dict) else {}
            ok = p.get("status") == "success"
            print(f"\n  {'✓' if ok else '✗'} Webhook #{len(received)}  {entry['received_at']}  from {entry['from_ip']}")
            print(f"    event         : {p.get('event')}")
            print(f"    order         : {p.get('merchantOrderId')}")
            print(f"    status        : {p.get('status')}  ({p.get('description')})")
            print(f"    amount        : ₹{p.get('amount')}   charges ₹{p.get('charges')}  gst ₹{p.get('gst')}")
            print(f"    settle amount : ₹{p.get('settle_amount')}   wallet balance ₹{p.get('balance')}")
            print(f"    txn / utr     : {p.get('txn_id')} / {p.get('utr')}")
            print(f"    saved to      : {log_file}")

            if fail:
                print("    → replying 500 (--fail), Vichitrapay will retry")
                return self._reply(500, {"received": False, "reason": "test failure (--fail)"})
            return self._reply(200, {"received": True, "merchantOrderId": p.get("merchantOrderId")})

        def do_GET(self):
            # quick check in a browser: shows the last webhooks received
            self._reply(200, {"listening_on": path, "received_count": len(received), "last": received[-5:][::-1]})

        def log_message(self, *args):  # keep the console clean; we print our own summary
            pass

    return Handler


SAMPLE = {
    "event": "payin.completed",
    "merchantOrderId": "TEST-SAMPLE-0001",
    "txn_id": "SAMPLETXN0001",
    "utr": "123456789012",
    "amount": 100.0,
    "charges": 2.0,
    "gst": 0.36,
    "settle_amount": 97.64,
    "status": "success",
    "description": "PayIn successful",
    "balance": 97.64,
}


def send_test(url: str) -> None:
    req = urllib.request.Request(url, data=json.dumps(SAMPLE).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"  ✓ Sample webhook sent to {url} — receiver replied HTTP {r.status}: {r.read().decode()}")
    except urllib.error.HTTPError as e:
        print(f"  ✗ Receiver replied HTTP {e.code}: {e.read().decode()}")
    except Exception as e:
        print(f"  ✗ Could not reach {url}: {e}\n    Is `python webhook.py` running?")
        sys.exit(1)


def main() -> None:
    ap = argparse.ArgumentParser(description="Test receiver for Vichitrapay merchant webhooks")
    ap.add_argument("--host", default="0.0.0.0", help="address to listen on (default 0.0.0.0 = all)")
    ap.add_argument("--port", type=int, default=8090, help="port (default 8090)")
    ap.add_argument("--path", default="/webhook/payin", help="URL path (default /webhook/payin)")
    ap.add_argument("--log", default="webhooks_received.jsonl", help="file to append each webhook to")
    ap.add_argument("--fail", action="store_true", help="reply 500 to test retries")
    ap.add_argument("--test", action="store_true", help="send one sample webhook to the receiver and exit")
    args = ap.parse_args()
    path = "/" + args.path.lstrip("/")

    if args.test:
        send_test(f"http://127.0.0.1:{args.port}{path}")
        return

    server = ThreadingHTTPServer((args.host, args.port), make_handler(path, args.log, args.fail))
    print("\n  Vichitrapay — Test Webhook Receiver")
    print("  ═══════════════════════════════════")
    print(f"  Listening : http://{args.host}:{args.port}{path}  (POST)")
    print(f"  Set merchant webhook URL to e.g. http://127.0.0.1:{args.port}{path}  (same server)")
    print(f"  Replying  : {'500 (testing retries)' if args.fail else '200'}")
    print("  Waiting for webhooks... (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")


if __name__ == "__main__":
    main()
