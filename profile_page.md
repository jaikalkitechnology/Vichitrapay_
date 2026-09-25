# Vichitrapay Merchant Panel — Profile & Settings Page

**Route**: `/merchant/profile` (old `/merchant/changePassword` opens the Security tab)
**Role**: merchant (role=2) · admin review in the Merchants list (role=3)
**Style**: Corporate Pro — same tokens, cards and dark mode as the rest of the panel

---

## Files

| Layer | File | What it holds |
|-------|------|---------------|
| Page | `fronted_react/src/components/txn/MerchantProfile.tsx` | Header, tabs, KYC tab, PG Fees tab, Security tab |
| Shared UI | `fronted_react/src/components/txn/kycBits.tsx` | `KycStatusBadge`, `KycStatusIcon`, `KycStatusLine`, `KycDocLinks`, `KycItemCard` (text field / upload drop zone) |
| Admin UI | `fronted_react/src/components/txn/KycReviewDialog.tsx` | "Review KYC" dialog opened from `merchantlist.tsx` |
| Password | `fronted_react/src/components/txn/changePassword.tsx` | Change Password form (`embedded` prop used inside the profile page) |
| API client | `fronted_react/src/api/kyc.ts` | Types + calls for every endpoint below |
| Backend | `app/routers/kyc.py` | Merchant + admin KYC endpoints, item definitions, validation |
| Backend | `app/routers/merchant.py` → `GET /fees` | PG fees with worked examples |
| Model | `app/models/models.py` → `MerchantKycItem` | Table `merchant_kyc_items` |

## Navigation

- Sidebar → **Account** → **Profile & Settings** (`UserCog` icon) — replaces the old "Change Password" item
- Top-right account menu → **Profile & Settings** (merchants only)
- `/merchant/changePassword` → same page, **Security Settings** tab selected, sidebar highlights Profile & Settings

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Profile & Settings                                  ┌──────────────┐ │  indigo → purple gradient
│ Manage your account, KYC and company information    │ Merchant ID  │ │
│                                                     │ MER-78D75445 │ │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 🛡 KYC Status                                     [NOT APPROVED] │ │  APPROVED when kyc_verified
│ │ ██████████████████████░░░░░░░░░                                  │ │  = progress.percent
│ │ Complete your KYC verification to unlock all features…           │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────┬──────────────────────┬────────────────────────┐
│    Update KYC        │   PG Fees & Rates    │   Security Settings    │  segmented tabs
└──────────────────────┴──────────────────────┴────────────────────────┘
```

---

## Tab 1 — Update KYC

```
┌──────────────────────────────────────────────────────────┬───────────┐
│ 🛡 KYC Management Dashboard                              │    ⏱      │  blue gradient
│ Complete your verification to unlock all features        │In progress│
│ Verification progress                              71%   │  Under    │
│ ████████████████████████░░░░░░░░                         │verification│
│ 10 of 14 verification items approved                     │           │
└──────────────────────────────────────────────────────────┴───────────┘
┌ Verification Steps ──────────────────────────────────────────────────┐
│ [✓ Company Type]  [✓ Basic Info]  [✗ KYC Docs]  [✓ Bank Account]     │  click → scrolls to section
│  Step 1·Approved   Step 2·Approved  Step 3·Action   Step 4·Approved  │  first unfinished step ringed
└──────────────────────────────────────────────────────────────────────┘
┌ 🏢 Company Information                                   [Approved] ┐
│ Company Type  [ Sole Proprietorship              ▾ ]                │  locked once approved
│ ✓ Approved                                                          │
└─────────────────────────────────────────────────────────────────────┘
┌ 👤 Basic Information                                     [Approved] ┐
│ ┌ Registered Mobile Number [Appr.] ┐ ┌ Registered Email ID [Appr.] ┐│  2-column grid of item cards
│ │ [+91 7033647101        ]         │ │ [janvitech011@gmail.com ]   ││
│ │ ✓ Approved                       │ │ ✓ Approved                  ││
│ └──────────────────────────────────┘ └─────────────────────────────┘│
│ ┌ Complete Business Address ──────┐                                 │
│ └─────────────────────────────────┘                                 │
│ ✓ Basic information approved — every item has been verified…        │  section banner
└─────────────────────────────────────────────────────────────────────┘
┌ 📄 KYC Documents                                         [Rejected] ┐
│ text cards (PAN / Aadhaar / GSTIN numbers) and file cards:          │
│ ┌ Proprietor Aadhaar ─────────────────────────────── [Rejected] ┐   │
│ │ 👁 View uploaded document • ⬇ Download (aadhaar_doc.pdf)      │   │
│ │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐        │   │
│ │   ⬆ Click to upload or drag and drop                         │   │  hidden once approved
│ │   PDF, JPG or PNG (max 5 MB)                                 │   │
│ │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘        │   │
│ │ ✗ Rejected: Back side of the Aadhaar card is missing — resubmit│  │
│ └────────────────────────────────────────────────────────────────┘  │
│ ✗ Some items were rejected — check the reason on each item…         │
└─────────────────────────────────────────────────────────────────────┘
┌ 🏦 Bank Account                                          [Approved] ┐
│ 1 verified payout bank account on file.   [Manage payout accounts]  │  → /merchant/bankAccount
└─────────────────────────────────────────────────────────────────────┘
┌ ✓ KYC Guidelines ───────────────────────────────────────────────────┐
│ • Documents must be clear, complete and valid (not expired).        │
│ • Upload documents as PDF, JPG or PNG, up to 5 MB each.             │
│ • Each item is reviewed separately. Approved items are locked;      │
│   rejected items show the reason so you can fix and resubmit.       │
│ • Once every item is approved, our team completes the final         │
│   verification of your account.                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Item card (`KycItemCard`)

| Part | Text item | File item |
|------|-----------|-----------|
| Header | icon · label · optional hint · status badge | same |
| Body | input + **Submit** / **Update** button (read-only when approved) | View / Download links when uploaded + drop zone (hidden when approved) |
| Footer | status line | status line |
| Client checks | — (server validates) | extension PDF/JPG/PNG, size ≤ 5 MB |

Cards remount on `updated_at` change, so the input shows the saved (e.g. upper-cased) value.

### Statuses

| Status | Badge | Status line | Merchant can edit |
|--------|-------|-------------|-------------------|
| `not_submitted` | grey "Not submitted" | Not submitted | yes |
| `pending` | amber "Under review" | Submitted — waiting for review | yes (resubmits) |
| `rejected` | red "Rejected" (card border red) | Rejected: *reason* — please resubmit | yes |
| `approved` | green "Approved" | Approved | **no** (locked) |

Section / step state: **approved** if every item approved → **rejected** if any rejected → **pending** if every item submitted → otherwise **incomplete** ("To do").

Status box in the blue card: *Verified* (`kyc_verified`) → *Final review* (100% but flag off) → *In progress* (anything submitted) → *Not verified*.

### KYC items by company type

Company types: `sole_proprietorship` Sole Proprietorship · `partnership` Partnership Firm · `llp` Limited Liability Partnership (LLP) · `private_limited` Private Limited Company · `public_limited` Public Limited Company.

The person word in labels follows the type: Proprietor / Partner / Designated Partner / Director.

| Section | Key | Label | Kind | Types |
|---------|-----|-------|------|-------|
| company | `company_type` | Company Type | select | all |
| basic | `mobile` | Registered Mobile Number | text (pre-filled from account) | all |
| basic | `email` | Registered Email ID | text (pre-filled from account) | all |
| basic | `business_address` | Complete Business Address | text | all |
| documents | `business_pan_id` | Business PAN Card ID | text | all |
| documents | `business_pan_doc` | Business PAN Card | file | all |
| documents | `owner_pan_id` | {Person} PAN Card ID | text | all |
| documents | `owner_pan_doc` | {Person} PAN Card | file | all |
| documents | `aadhaar_id` | {Person} Aadhaar ID | text | all |
| documents | `aadhaar_doc` | {Person} Aadhaar | file | all |
| documents | `gstin_id` | GSTIN ID | text | all |
| documents | `gstin_doc` | GSTIN Certificate | file | all |
| documents | `address_proof_doc` | Business Address Proof | file (hint lists accepted proofs) | all |
| documents | `partnership_deed_doc` | Partnership Deed | file | partnership |
| documents | `incorporation_doc` | Certificate of Incorporation | file | llp, private_limited, public_limited |
| documents | `llp_agreement_doc` | LLP Agreement | file | llp |
| documents | `moa_aoa_doc` | MOA & AOA | file | private_limited, public_limited |

Document items appear only after a company type is chosen.

### Validation (server)

| Key | Rule | Error |
|-----|------|-------|
| `mobile` | optional `+91`, then 10 digits starting 6–9 | Enter a valid 10-digit Indian mobile number |
| `email` | `name@domain.tld` | Enter a valid email address |
| `business_address` | 10–500 characters | Enter the complete address (at least 10 characters) |
| `business_pan_id`, `owner_pan_id` | `ABCDE1234F` (upper-cased) | PAN must look like ABCDE1234F |
| `aadhaar_id` | 12 digits | Aadhaar must be 12 digits |
| `gstin_id` | `10ABCDE1234F1Z5` pattern (upper-cased) | GSTIN must be 15 characters, e.g. 10ABCDE1234F1Z5 |
| documents | `.pdf .jpg .jpeg .png`, 1 byte – 5 MB | Upload a PDF, JPG or PNG file / File is larger than 5 MB |

### Progress

`total` = company type + 3 basic items + document items for the chosen type + 1 bank step.
`approved` = approved items + 1 if the merchant has at least one verified payout bank account.
`percent` = `round(approved × 100 / total)`.

---

## Tab 2 — PG Fees & Rates

```
┌ % PayIn fee ────┐ ┌ % Payout up to ₹1,000 ┐ ┌ % Payout above ₹1,000 ┐
│   2.5%          │ │   ₹8                  │ │   1.2%                │
│ of each success │ │ flat per payout       │ │ of the payout amount  │
└─────────────────┘ └───────────────────────┘ └───────────────────────┘
GST at 18% is charged on every fee.
┌ PayIn examples ─────────────────────┐ ┌ Payout examples (API) ──────────────┐
│ Amount  Fee   GST   You receive     │ │ Amount  Fee  GST   Total debit      │
│ ₹1,000  ₹25   ₹4.5  ₹970.5          │ │ ₹500    ₹8   ₹1.44 ₹509.44          │
│ …                                   │ │ …                                   │
└─────────────────────────────────────┘ └─────────────────────────────────────┘
```

- Values come from `merchants_settings` (`payInCharges`, `payOutChargesFlat`, `payOutCharges`).
- PayIn example = the live webhook formula: fee = amount × % · GST = 18% of fee · net = amount − fee − GST.
- Payout example = `calculate_payout_charges()` used by the live payout API (flat up to ₹1,000, % above) · total debit = amount + fee + GST.
- No settings row → "Your fees have not been set up yet. Contact support…".

## Tab 3 — Security Settings

The Change Password form (`<ChangePassword embedded />`): password tips, current / new / confirm fields with show-hide toggles, strength meter, mismatch warning, Update / Clear. Calls `POST /api/v1/merchant/change-password`. The merchant stays signed in.

---

## API

All paths are under `/api/v1`. Merchant endpoints need a merchant bearer token, admin endpoints an admin token. Every KYC write returns the full KYC payload so the page re-renders from one response.

### Merchant

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/merchant/kyc` | — | KYC payload |
| PUT | `/merchant/kyc/company-type` | `{ "company_type": "sole_proprietorship" }` | 422 unknown type · 400 if already approved |
| PUT | `/merchant/kyc/field` | `{ "key": "business_pan_id", "value": "ABCDE1234F" }` | text keys only; validated; 400 if approved |
| POST | `/merchant/kyc/document` | form-data `key`, `file` | 400 before company type is chosen; replaces (and deletes) the previous file |
| GET | `/merchant/kyc/document/{key}` | — | file download; only the merchant's own files |
| GET | `/merchant/fees` | — | fees payload |
| POST | `/merchant/change-password` | `{ "old_password": "…", "new_password": "…" }` | existing endpoint |

Submitting or resubmitting any item sets it to `pending` and clears the previous reason.

### Admin

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/admin/kyc/{merchant_id}` | — | KYC payload; 404 if not a merchant |
| PATCH | `/admin/kyc/{merchant_id}/{key}` | `{ "status": "approved" }` or `{ "status": "rejected", "remark": "reason" }` | remark required for reject; 404 if the item was never submitted |
| GET | `/admin/kyc/{merchant_id}/document/{key}` | — | file download |
| PATCH | `/admin/user/{merchant_id}/kyc` | `{ "kyc_verified": true }` | existing endpoint — the final flag that enables live PayIn |

### KYC payload

```json
{
  "merchant_id": "MER-78D75445",
  "kyc_verified": false,
  "company_type": "sole_proprietorship",
  "company_types": [{ "value": "sole_proprietorship", "label": "Sole Proprietorship" }],
  "sections": {
    "company":   [{ "key": "company_type", "label": "Company Type", "kind": "select", "value": "sole_proprietorship", "status": "approved" }],
    "basic":     [{ "key": "mobile", "label": "Registered Mobile Number", "kind": "text", "value": "+91 7033647101", "status": "approved" }],
    "documents": [{
      "key": "aadhaar_doc", "label": "Proprietor Aadhaar", "kind": "file", "hint": null,
      "value": null, "has_file": true, "file_name": "aadhaar_doc.pdf",
      "status": "rejected", "remark": "Back side of the Aadhaar card is missing",
      "updated_at": "2026-09-24T13:02:11"
    }]
  },
  "bank": { "total": 1, "verified": 1 },
  "progress": { "approved": 10, "total": 14, "percent": 71 }
}
```

### Fees payload

```json
{
  "configured": true,
  "gst_percent": 18.0,
  "payin":  { "percent": 2.5, "examples": [{ "amount": 1000, "charges": 25.0, "gst": 4.5, "net": 970.5 }] },
  "payout": { "flat": 8.0, "percent": 1.2, "flat_up_to": 1000.0,
              "examples": [{ "amount": 500, "charges": 8.0, "gst": 1.44, "total_debit": 509.44 }] }
}
```

---

## Data model — `merchant_kyc_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | int PK | |
| `user_id` | FK `users.id` (cascade delete) | indexed |
| `key` | varchar(50) | unique with `user_id` |
| `value` | text | text items / company type |
| `file_path` | varchar(500) | private path on disk |
| `file_name`, `file_mime` | varchar | original name, served content type |
| `status` | varchar(20) | `pending` · `approved` · `rejected` (no row = not submitted) |
| `remark` | text | admin's rejection reason |
| `reviewed_by`, `reviewed_at` | varchar / datetime | last review |
| `created_at`, `updated_at` | datetime (IST) | |

Created automatically by `Base.metadata.create_all` at startup — no migration needed.

## File storage

- Saved to `private_uploads/kyc/<merchant_id>/<key>-<uuid>.<ext>` (override with env `KYC_UPLOAD_DIR`).
- Outside `/static`, so files are reachable only through the authenticated download endpoints. `private_uploads/` is git-ignored — include it in server backups.
- The frontend fetches documents with the auth header as a blob, then opens them in a new tab or saves them (`openKycDocument` in `api/kyc.ts`).

---

## Admin — Review KYC dialog

Merchants list → row **⋯** menu (or mobile **Review KYC** button):

```
┌ Review KYC — merchant1 ──────────────────────────────────────── ✕ ┐
│ Approve or reject each item. Rejected items go back to the        │
│ merchant with your reason.                                        │
│ [ Progress 71% ] [ Awaiting review 2 ] [ Verified bank accts 1/1 ]│
│ COMPANY                                                           │
│ ┌ Company Type                                   [Approved]       ┐│
│ │ Sole Proprietorship                            [✗ Reject]       ││
│ └─────────────────────────────────────────────────────────────────┘│
│ BASIC INFORMATION · DOCUMENTS  (same rows; files have View/Download)│
│ Reject → inline "Reason shown to the merchant" [Reject] [Cancel]  │
│ ┌ 🛡 Account KYC: Not verified                [Mark KYC verified] ┐│
│ │ 10 of 14 items approved. This flag enables live PayIn.          ││
│ └─────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

Approving every item does **not** set `kyc_verified` automatically — the admin confirms it with the button, which also refreshes the merchants list.

---

## Responsive & dark mode

- Tabs stay a 3-column segmented control; icons hide below `sm`.
- Item grids: 1 column on mobile, 2 from `md`. Steps: 2 columns, 4 from `lg`.
- Fee cards: 1 → 3 columns (`md`); example tables side by side from `xl`, horizontally scrollable on small screens.
- All cards, badges, section tints and the drop zone have `dark:` variants; the gradients stay the same in both themes.
