# universepay_router.py
import os
import json
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from enum import Enum

from pydantic.v1 import validator

# ----------------------------
# Config via env vars (with defaults)
# ----------------------------
BASE_URL = os.getenv("UNIVERSEPAY_BASE_URL", "https://universepay.in/api")
LOGIN_URL = f"{BASE_URL}/auth/login"
TRANSFER_URL = f"{BASE_URL}/transfer"

EMAIL = os.getenv("UNIVERSEPAY_EMAIL", "deshmukh.techy@gmail.com")
PASSWORD = os.getenv("UNIVERSEPAY_PASSWORD", "deshmukh##432@@")

HTTP_TIMEOUT_SECONDS = int(os.getenv("HTTP_TIMEOUT_SECONDS", "30"))


# ----------------------------
# Helpers (from your script)
# ----------------------------
def _pretty(obj: Any) -> str:
    try:
        return json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(obj)

def _extract_bearer_token(resp_json: Dict[str, Any]) -> Optional[str]:
    """
    Tries common token field names/paths:
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
        for key in path:
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
            else:
                cur = None
                break
        if isinstance(cur, str) and cur.strip():
            return cur.strip()
    return None

async def _login(client: httpx.AsyncClient) -> str:
    """
    POST /auth/login (form-data). Returns Bearer token string.
    """
    # Safety: fail fast if creds look like placeholders
    if EMAIL in {"your email", "", None} or PASSWORD in {"your password", "", None}:
        raise HTTPException(status_code=500, detail="UniversePay credentials not configured")

    # Send as form-data (closest to your PHP example)
    files = {
        "email": (None, EMAIL),
        "password": (None, PASSWORD),
    }
    r = await client.post(LOGIN_URL, files=files)
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"UniversePay login failed: {r.text}")

    try:
        j = r.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="UniversePay login returned non-JSON response")

    token = _extract_bearer_token(j)
    if not token:
        raise HTTPException(status_code=502, detail=f"UniversePay login did not return access token: {j}")
    return token

async def _transfer(client: httpx.AsyncClient, token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    POST /transfer (JSON body) with Authorization: Bearer <token>.
    """
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    r = await client.post(TRANSFER_URL, json=payload, headers=headers)
    if r.status_code >= 400:
        # Bubble the upstream body for easier debugging
        raise HTTPException(status_code=502, detail=f"UniversePay transfer failed: {r.text}")
    try:
        return r.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="UniversePay transfer returned non-JSON response")

# ----------------------------
# Validation models
# ----------------------------


# ----------------------------
# Router endpoint
# ----------------------------
