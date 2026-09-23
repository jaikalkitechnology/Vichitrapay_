# Vichitrapay — Project Documentation

## Overview

**Vichitrapay** is a full-stack payment gateway aggregation platform that enables merchants to accept payments (PayIn) and send payouts (PayOut) through multiple third-party service providers (TSPs). It includes an admin panel for merchant management, transaction monitoring, and settlement processing.

- **Backend**: Python FastAPI + SQLAlchemy + MySQL
- **Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Base URL**: `https://api.neopayment.in`
- **Frontend URL**: Served from the same domain

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                      │
│  Admin Dashboard  │  Merchant Dashboard  │  Login Page    │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────────────────┐
│                   FASTAPI BACKEND                         │
│                                                           │
│  routers/           │  crud/gateway/      │  models/       │
│  ├─ admin.py        │  ├─ templamart.py   │  models.py     │
│  ├─ authenticate.py │  ├─ gurutvapay.py   │                │
│  ├─ merchant.py     │  ├─ zeepay.py       │  schemas/      │
│  ├─ live_payin.py   │  ├─ grv_payout.py   │  ├─ admin.py   │
│  ├─ live_payout.py  │  ├─ mizorpay.py     │  ├─ merchant.py│
│  ├─ live.py         │  ├─ phonepe.py      │  └─ ...        │
│  └─ tsp.py          │  ├─ gatepay.py      │                │
│                     │  ├─ universepay.py  │                │
│  crud/webhook/      │  ├─ torus.py        │                │
│  └─ handler.py      │  └─ live_payout.py  │                │
└──────────────────────┴───────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │Templamart│  │ GurutvaPay│  │  Zeepay  │  ... (TSPs)
   │ (PayIn)  │  │(PayIn+Out)│  │ (PayOut) │
   └─────────┘  └───────────┘  └──────────┘
```

---

## Router Mounting (main.py)

| Router | Prefix | Tags |
|--------|--------|------|
| `admin.py` | `/api/v1/admin` | Admin |
| `authenticate.py` | `/api/v1/auth` | Login |
| `live.py` | `/live` | Live |
| `merchant.py` | `/api/v1/merchant` | Merchants |
| `tsp.py` | `/tsp` | TSP |
| `live_payin.py` | `/live/payin` | Live PayIn |
| `live_payout.py` | `/live/payout` | Live Payout |

---

## API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | OAuth2 login → access_token, expires_in, expires_at |

### PayIn (`/live/payin`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/initiate` | Create PayIn txn (auto-selects provider from TSP config) |
| POST | `/initiate-payment` | GurutvaPay-only PayIn initiation |
| POST | `/upi-intent` | UPI Intent PayIn (returns intent_url + qr_data) |
| GET | `/ticket-sizes` | Get available ticket sizes for active provider |
| GET | `/txns/status` | Check PayIn status by order_id |
| POST | `/webhook/templamart` | Templamart webhook callback |
| POST | `/webhook/gurutvapay` | GurutvaPay webhook callback |

### PayOut (`/live/payout`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/initiate` | Create payout (auto-selects provider from TSP config) |
| POST | `/txns/status` | Unified payout status check (auto-detects provider) |
| GET | `/webhook/zeepay` | Zeepay callback (GET with query params) |
| POST | `/webhook/grv` | GurutvaPay payout webhook |
| POST | `/webhook/mizorpay` | MizorPay payout webhook |
| GET | `/balance/grv` | GurutvaPay payout wallet balance |
| GET | `/balance/mizorpay` | MizorPay payout wallet balance |

### Admin (`/api/v1/admin`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create merchant user |
| GET | `/` | List all users |
| GET | `/user/{id}` | Get user by ID |
| PUT | `/user/{id}` | Update user |
| PATCH | `/user/{id}/kyc` | Toggle KYC status |
| PATCH | `/user/{id}/password` | Change merchant password |
| DELETE | `/user/{id}` | Delete user |
| GET | `/transactions` | List all transactions (paginated + filtered) |
| GET | `/summary` | Dashboard summary (today/yesterday/30d metrics) |
| GET | `/report` | Paginated report with merchant-wise filters |
| GET | `/report/download` | Download report as CSV |
| GET | `/merchants-list` | Lightweight merchant list for dropdowns |
| POST | `/txn/{id}/mark-failed` | Admin: mark success txn as failed (debits wallet) |
| POST | `/txn/{id}/mark-success` | Admin: mark failed txn as success (credits wallet) |
| GET | `/settings/{id}` | Get merchant settings |
| POST | `/settings` | Create merchant settings |
| PUT | `/settings/{id}` | Update/create merchant settings (upsert) |
| POST | `/transfer` | Transfer between wallet ↔ payout wallet |
| POST | `/wallet-adjust` | Admin adjust wallet balance (increase/decrease) |
| GET | `/bank-accounts/pending` | List pending bank account approvals |
| POST | `/bank-accounts/{id}/approve` | Approve bank account |
| POST | `/bank-accounts/{id}/reject` | Reject bank account |
| GET | `/settled` | List settlements |
| POST | `/{txn_id}/approve` | Approve settlement |
| POST | `/{txn_id}/reject` | Reject settlement |

### Merchant (`/api/v1/merchant`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Self profile with wallets |
| POST | `/change-password` | Change own password |
| GET | `/transactions` | My transactions (paginated) |
| GET | `/merchant/metrics` | PayIn/PayOut metrics |
| POST | `/payout-bank-accounts` | Add bank account |
| GET | `/payout-bank-accounts` | List bank accounts |
| POST | `/withdraw` | Request withdrawal |
| GET | `/settled` | My settlements |
| POST | `/payout/direct` | Direct payout (legacy) |
| POST | `/payout/status/check` | Check payout status (legacy) |
| GET | `/wallet-transactions` | Wallet transaction history |
| GET | `/payouts/export` | Export payouts as Excel |
| GET | `/merchant/summary` | Transaction summary by date |

### TSP Management (`/tsp`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/providers` | Create TSP provider |
| GET | `/providers` | List all providers |
| PUT | `/providers/{id}` | Update provider |
| DELETE | `/providers/{id}` | Delete provider |
| POST | `/mappings` | Create merchant-TSP mapping |
| GET | `/mappings` | List mappings |
| PUT | `/mappings/{id}` | Update mapping |
| DELETE | `/mappings/{id}` | Delete mapping |

---

## Payment Gateway Integrations (TSPs)

### PayIn Gateways

| Gateway | File | Auth | Endpoints |
|---------|------|------|-----------|
| **Templamart** | `crud/gateway/templamart.py` | Username/Password → Bearer token (cached) | Login, Ticket Sizes, Create Payment, UPI Intent |
| **GurutvaPay** | `crud/gateway/gurutvapay.py` | Username/Password/ClientID/Secret → Bearer token (cached) | Login, Initiate Payment, UPI QR/Intent |
| **PhonePe** | `crud/gateway/phonepe.py` | Mock | Mock initiation |
| **GetePay** | `crud/gateway/gatepay.py` | Mock | Mock initiation |

### PayOut Gateways

| Gateway | File | Auth | Endpoints |
|---------|------|------|-----------|
| **Zeepay** | `crud/gateway/zeepay.py` | Hardcoded credentials | Payout Initiate, Status Check, Webhook (GET callback) |
| **GurutvaPay Payout** | `crud/gateway/grv_payout.py` | Bearer token (cached) | Payout Initiate, Status Check, Balance |
| **MizorPay** | `crud/gateway/mizorpay.py` | Token-Id + Secret-Key headers | Bulk Payout, Status Check, Balance |
| **UniversePay** | `crud/gateway/universepay.py` | Mock | Mock payout |
| **Torus** | `crud/gateway/torus.py` | Mock | Mock payout |

### Webhook Handler

| File | Description |
|------|-------------|
| `crud/webhook/handler.py` | Central PayIn webhook processor: updates txn, credits wallet (with charges/GST deduction), forwards to merchant webhook URL with 3 retries |

---

## Database Models (19 tables)

| Model | Table | Description |
|-------|-------|-------------|
| `User` | `users` | Merchants, admins, partners (role-based). Has `view_password` for admin view |
| `Wallet` | `wallets` | PayIn wallet balance per user |
| `PayOutWallet` | `payout_wallet` | PayOut wallet balance per user |
| `LiveCustomer` | `live_customers` | Customer records for PayIn transactions |
| `WalletTransaction` | `wallet_transactions` | All PayIn/PayOut transactions with charges, GST, settle_amount, UTR |
| `TransactionInstrument` | `transaction_instruments` | Payment instrument details per transaction |
| `PayoutBankAccount` | `payout_bank_accounts` | Merchant bank accounts for payouts (with `is_validate` approval flag) |
| `TransactionSettled` | `transactions_settled` | Settlement/withdrawal records |
| `MerchantSettings` | `merchants_settings` | Per-merchant: payInCharges, payOutCharges, webhook, webhook_payout, IP whitelist |
| `LiveWebhookPhonePeLog` | `live_webhook_Phonepe_logs` | PhonePe webhook logs |
| `PayoutTopUp` | `payout_topups` | Payout wallet top-up requests |
| `DisplayAccount` | `display_accounts` | Beneficiary display accounts |
| `PayOutLog` | `pay_out_logs` | Payout API request/response logs |
| `TemplamartApiLog` | `templamart_api_logs` | PayIn gateway API logs (used by all gateways) |
| `WebhookLog` | `webhook_logs` | Inbound webhook logs |
| `WebhookDeliveryLog` | `webhook_delivery_logs` | Outbound merchant webhook delivery attempts |
| `TspProvider` | `tsp_providers` | Registry of TSP providers |
| `MerchantTspSetting` | `merchant_tsp_settings` | Per-merchant TSP configuration |
| `ProviderCredential` | `provider_credentials` | Per-merchant provider credentials |

---

## Fee Calculation

### PayIn Fees
```
charges = amount × payInCharges%
gst     = charges × 18%
settle_amount = amount - charges - gst  (credited to wallet)
```

### PayOut Fees
```
If amount ≤ ₹1000 → charges = payOutChargesFlat
If amount > ₹1000 → charges = amount × payOutCharges%
gst = charges × 18%
total_debit = amount + charges + gst  (debited from payout wallet)
```

---

## Frontend Structure

### Pages

| Page | Route | Description |
|------|-------|-------------|
| `Login.tsx` | `/login` | OAuth2 login form |
| `AdminDashboard.tsx` | `/admin/*` | Admin panel with URL-based tabs |
| `MerchantDashboard.tsx` | `/merchant/*` | Merchant panel with URL-based tabs |

### Admin Tabs

| Tab ID | Label | Component |
|--------|-------|-----------|
| `dashboard` | Dashboard | Inline (stats, pending actions) |
| `merchants` | Merchants | `merchantlist.tsx` |
| `tspMappings` | TSP Mappings | `TspMappingPage.tsx` |
| `tspProviders` | TSP Providers | `TspProvidersPage.tsx` |
| `transactions` | Transactions | `merchantTxnView.tsx` |
| `settlements` | Settlements | Inline |
| `analytics` | Analytics | Inline |
| `payouts` | Payout Management | `AdminPayoutManagement.tsx` |
| `report` | Report | `AdminReport.tsx` |
| `bankApproval` | Bank Approval | `BankApproval.tsx` |

### Merchant Tabs

| Tab ID | Label | Component |
|--------|-------|-----------|
| `dashboard` | Dashboard | Inline (stats, withdraw) |
| `transactions` | Transactions | `txnView.tsx` |
| `paymentLink` | Payment Link | `paymentLinkGenerator.tsx` |
| `bankAccount` | Payout Accounts | `accountView.tsx` |
| `settlements` | Settlements | Inline |
| `merchantsTopup` | Top Up | `MerchantTopup.tsx` |
| `passbook` | Passbook | `passbook.tsx` |
| `developer` | Developer | `apiDocs.tsx` |
| `changePassword` | Change Password | `changePassword.tsx` |

### Key Frontend Components

| Component | Description |
|-----------|-------------|
| `merchantlist.tsx` | Merchant CRUD with actions dropdown (edit, settings, credentials, password change, wallet adjust, transfer) |
| `txnView.tsx` | Merchant transaction table with charges, GST, settle amount, balance, UTR columns |
| `merchantTxnView.tsx` | Admin transaction view with mark-failed/mark-success actions |
| `passbook.tsx` | Payout transaction history with check status for pending txns |
| `paymentLinkGenerator.tsx` | Generate payment link with live cURL preview |
| `apiDocs.tsx` | Full API documentation (10 sections) |
| `changePassword.tsx` | Password change with strength meter |
| `AdminReport.tsx` | Admin report with merchant dropdown, CSV download dialog |
| `BankApproval.tsx` | Pending bank account approval/rejection |
| `DashboardLayout.tsx` | Shared layout with sidebar navigation (URL-based routing) |

---

## Security Features

- **JWT Authentication**: OAuth2 password flow, 180-minute token expiry
- **Role-based Access**: Admin (role=3), Merchant (role=2), Partner (role=1)
- **IP Whitelisting**: Per-merchant IP restriction on PayIn/PayOut initiate
- **Idempotency**: Webhook handlers check for duplicate processing
- **Token Caching**: Gateway tokens cached in-memory with 5-min refresh margin
- **Password Storage**: Bcrypt hash + plain text `view_password` for admin view

---

## Webhook Flow

### PayIn Webhook
```
Provider → POST /live/payin/webhook/{provider}
  → Normalize payload
  → Find WalletTransaction by merchantOrderId
  → Idempotency check
  → Update instrument status
  → Calculate charges (payInCharges% + 18% GST)
  → Credit settle_amount to Wallet
  → Forward to merchant webhook URL (3 retries)
  → Log to webhook_logs + webhook_delivery_logs
```

### PayOut Webhook
```
Provider → POST/GET /live/payout/webhook/{provider}
  → Normalize payload
  → Find WalletTransaction by order_id/txn_id/reference_id
  → Success: mark complete
  → Failed: refund settle_amount to PayOutWallet
  → Forward to merchant webhook_payout URL (3 retries)
```

---

## Test Scripts

| Script | Description |
|--------|-------------|
| `test_live_payin.py` | Tests login → ticket sizes → initiate PayIn → UPI intent |
| `test_live_payout.py` | Tests login → initiate payout → status check |

---

## Project Stats

- **Python files**: 39
- **TSX files**: 76
- **Database tables**: 19
- **API endpoints**: ~80+
- **Payment gateways**: 7 (2 PayIn live, 3 PayOut live, 2 mock)
- **Frontend tabs**: 10 admin + 9 merchant
