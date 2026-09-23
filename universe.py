#!/usr/bin/env python3
"""
One-page UniversePay test: auto-login, then hit /transfer.

Usage:
  - Put your creds in env vars OR inline below:
      UNIVERSEPAY_EMAIL
      UNIVERSEPAY_PASSWORD
  - Optionally override payout params via CLI or by editing PAYOUT_DATA.
"""

import os
import sys
import json
import requests
from typing import Any, Dict, Optional

BASE_URL = "https://universepay.in/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
TRANSFER_URL = f"{BASE_URL}/transfer"

# --- Put defaults here (override via env or edit directly) ---
EMAIL = os.getenv("UNIVERSEPAY_EMAIL", "deshmukh.techy@gmail.com")
PASSWORD = os.getenv("UNIVERSEPAY_PASSWORD", "deshmukh##432@@")

# Example payout payload — edit as needed:
PAYOUT_DATA = {
    "amount": "10",
    "ifsc": "IDFB0040104",
    "accountno": "10007309405",
    "name": "Shyamveer Pratap Singh",
    "branch": "Mumbai",
    "paymode": "IMPS",  # or "IMPS", "NEFT", "RTGS" if API requires a single value
    "remarks": "PAYOUT PAYMENT",
    "mode": "bank"
}

TIMEOUT = 30  # seconds


def pretty(obj: Any) -> str:
    try:
        return json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(obj)


def extract_bearer_token(resp_json: Dict[str, Any]) -> Optional[str]:
    """
    Tries several common token field names/paths:
      - access_token
      - token
      - data.access_token / data.token
      - result.access_token / result.token
    """
    candidates = [
        ("access_token",),
        ("token",),
        ("data", "access_token"),
        ("data", "token"),
        ("result", "access_token"),
        ("result", "token"),
    ]
    for path in candidates:
        cur: Any = resp_json
        ok = True
        for key in path:
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
            else:
                ok = False
                break
        if ok and isinstance(cur, str) and cur.strip():
            return cur.strip()
    return None


def login(email: str, password: str) -> str:
    """POST /auth/login (form-data). Returns Bearer token string."""
    # requests will encode form-data when using data= dict (Content-Type handled automatically)
    headers = {
        # Most servers infer multipart/form-data automatically; omit header to let requests pick.
        # If the API *requires* explicit multipart, you can switch to files=.
        "Accept": "application/json"
    }
    data = {"email": email, "password": password}

    r = requests.post(LOGIN_URL, data=data, headers=headers, timeout=TIMEOUT)
    # Raise on HTTP errors (4xx/5xx)
    try:
        r.raise_for_status()
    except requests.HTTPError as e:
        print("Login failed with HTTP error:", e, file=sys.stderr)
        print("Response text:", r.text, file=sys.stderr)
        sys.exit(1)

    try:
        j = r.json()
    except ValueError:
        print("Login response is not JSON.", file=sys.stderr)
        print("Raw response:", r.text, file=sys.stderr)
        sys.exit(1)

    token = extract_bearer_token(j)
    if not token:
        print("Could not find access token in login response.", file=sys.stderr)
        print("Login JSON:", pretty(j), file=sys.stderr)
        sys.exit(1)

    print("✅ Logged in successfully.")
    return token


def transfer(token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """POST /transfer (JSON body) with Authorization: Bearer <token>."""
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }

    # Using json= lets requests set Content-Type: application/json automatically.
    r = requests.post(TRANSFER_URL, json=payload, headers=headers, timeout=TIMEOUT)

    # Some APIs return 200 for both success and failure-with-message; don't raise immediately.
    # But still show details if it *is* an HTTP error:
    if r.status_code >= 400:
        print(f"Payout HTTP error {r.status_code}", file=sys.stderr)
        print("Response text:", r.text, file=sys.stderr)
        sys.exit(1)

    try:
        return r.json()
    except ValueError:
        print("Payout response is not JSON.", file=sys.stderr)
        print("Raw response:", r.text, file=sys.stderr)
        sys.exit(1)


def main():
    if EMAIL == "your email" or PASSWORD == "your password":
        print("⚠️ Please set UNIVERSEPAY_EMAIL and UNIVERSEPAY_PASSWORD env vars or edit the script.", file=sys.stderr)
        sys.exit(1)

    # Step 1: Login -> token
    token = login(EMAIL, PASSWORD)

    # Step 2: Transfer
    print("🚀 Initiating payout...")
    result = transfer(token, PAYOUT_DATA)

    print("✅ Payout API response JSON:")
    print(pretty(result))


if __name__ == "__main__":
    main()
