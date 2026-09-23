# Vichitrapay Merchant Panel — Redesign Specification

**Style**: Corporate Pro (matches Admin Panel v2)
**Scope**: `/merchant/*` routes only (role=2)

---

## Design Philosophy

Merchant-facing = client-facing. Clean, trustworthy, minimal cognitive load. The merchant sees their money — every element should feel secure and precise. Less data density than admin (they only see their own data), more whitespace, clearer call-to-actions.

---

## Routes & Pages

| Route | Tab ID | Page | Component |
|-------|--------|------|-----------|
| `/merchant` | dashboard | Dashboard | MerchantDashboard (inline) |
| `/merchant/transactions` | transactions | Transactions | txnView.tsx |
| `/merchant/paymentLink` | paymentLink | Payment Link | paymentLinkGenerator.tsx |
| `/merchant/bankAccount` | bankAccount | Payout Accounts | accountView.tsx |
| `/merchant/settlements` | settlements | Settlements | MerchantDashboard (inline) |
| `/merchant/merchantsTopup` | merchantsTopup | Top Up | MerchantTopup.jsx |
| `/merchant/passbook` | passbook | Passbook | passbook.tsx |
| `/merchant/developer` | developer | Developer / API Docs | apiDocs.tsx |
| `/merchant/changePassword` | changePassword | Change Password | changePassword.tsx |

---

## Shared Layout (same as Admin)

Same `DashboardLayout.tsx` + `Navbar.tsx` — the sidebar tabs change based on role.

### Sidebar (merchant-specific tabs)
```
┌──────────────────────┐
│  Dashboard           │  ← LayoutDashboard icon
│  Transactions        │  ← CreditCard
│  Payment Link        │  ← Link
│  Payout Accounts     │  ← PiggyBank
│  Settlements         │  ← FileText
│  Top Up              │  ← Users
│  Passbook            │  ← CreditCard
│  Developer           │  ← Code
│  Change Password     │  ← Lock
└──────────────────────┘
```

Same navy sidebar (`#0F2744`), same active state (`bg-white/10 border-l-2 border-indigo-400`), same `w-[220px]`.

---

## Color Palette (same tokens as Admin)

```
Primary:     #4F6BF6 (indigo)       Actions, links, active states
Success:     #22C55E (green)        PayIn success, balance positive
Warning:     #F59E0B (amber)        Pending, in-progress
Danger:      #EF4444 (red)          Failed, errors
Info:        #3B82F6 (blue)         Informational badges
Navy:        #0F2744                Sidebar
```

---

## Typography (Inter — same as Admin)

```
Page heading:     text-xl font-semibold tracking-tight    (20px)
Section heading:  text-base font-semibold                 (16px)
Card value:       text-[28px] font-bold tabular-nums      (28px)
Card label:       text-[11px] font-medium uppercase tracking-widest
Table header:     text-[11px] font-semibold uppercase tracking-wider
Table cell:       text-[13px]
Button:           text-[13px] font-medium
Badge:            text-[11px] font-medium
Monospace:        font-mono text-xs
```

---

## Component Patterns (all match Admin v2)

### Stat Cards — flat, bordered, no accent bar
```
className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200
  dark:border-gray-800 p-4"
```
No shadow, no `border-l-4`. Icon: `w-8 h-8 rounded-md bg-indigo-50`.

### Buttons — solid, compact
```
Primary:    bg-indigo-600 text-white h-8 px-3 rounded-md
Secondary:  border border-gray-300 text-gray-700 h-8 rounded-md
Success:    bg-green-600 text-white h-8 rounded-md
Danger:     border border-red-200 text-red-600 h-8 rounded-md
```

### Badges — rectangular pills
```
Success:    bg-green-50 text-green-700 border border-green-200 rounded-md
Pending:    bg-amber-50 text-amber-700 border border-amber-200 rounded-md
Failed:     bg-red-50 text-red-700 border border-red-200 rounded-md
```
Size: `text-[11px] font-medium px-2 py-0.5`

### Tables — flat headers, dense rows
```
Header:     bg-gray-50 dark:bg-gray-800/50
            text-[11px] font-semibold uppercase tracking-wider text-gray-500
Cells:      px-4 py-2.5 text-[13px]
Hover:      hover:bg-gray-50 dark:hover:bg-gray-800/50
```
No gradient headers. No colored backgrounds.

### Inputs
```
h-8 px-3 text-[13px] border border-gray-300 dark:border-gray-700
rounded-md bg-white dark:bg-gray-900
focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
```

### Modals
```
Overlay:    bg-black/50 (no blur)
Modal:      bg-white dark:bg-gray-900 rounded-lg border p-5 max-w-lg
Title:      text-base font-semibold text-gray-900
Footer:     flex gap-2 justify-end mt-5 pt-4 border-t
```

---

## Page Redesigns

### /merchant — Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  Welcome back, Amit!                              [Refresh]   │
│  Here's your business overview                                 │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Total Bal │ │Today Vol │ │Today Txn │ │Avg Value │        │
│  │₹24,580   │ │₹8,450    │ │47        │ │₹179      │        │
│  │Wallet+PO │ │↑23%      │ │↑12       │ │          │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│                                                                │
│  ┌─────────────────────────────────────────────┐              │
│  │  Quick Withdraw                              │              │
│  │  Amount: [________]  Bank: [Select ▾]       │              │
│  │                              [Withdraw →]    │              │
│  └─────────────────────────────────────────────┘              │
│                                                                │
│  ┌─────────────────────────────────────────────┐              │
│  │  Recent Settlements                          │              │
│  │  ┌─────┬────────┬────────┬────────┐         │              │
│  │  │ ID  │ Amount │ Status │ Date   │         │              │
│  │  └─────┴────────┴────────┴────────┘         │              │
│  └─────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────┘
```

**Stat cards**: 4-column flat cards (no accent bar)
- Total Balance (wallet + payout combined)
- Today's Volume (success only)
- Today's Transactions (success count)
- Avg Transaction Value

**Withdraw section**: compact card with inline form
- Amount input + Bank dropdown + Submit button in one row
- No heavy card styling — just bordered container

**Recent settlements**: compact table, last 5 items, "View All →" link

### /merchant/transactions — Transaction History

```
┌────────────────────────────────────────────────────────────────┐
│  Transactions                                     [Export ↓]  │
│                                                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                                │
│  │Tot │ │Vol  │ │Rate│ │Avg │  ← inline stat row              │
│  │247 │ │₹1.2L│ │96% │ │₹485│                                │
│  └────┘ └────┘ └────┘ └────┘                                │
│                                                                │
│  [Type ▾] [Status ▾] [From] [To] [Search___] [Apply] [Reset] │
│                                                                │
│  ID │ Type │ C/D │ Status │ Amount │ Charges │ GST │ Settle  │
│  ───┼──────┼─────┼────────┼────────┼─────────┼─────┼──────── │
│  142│PayIn │ Cr  │●Success│ ₹500   │ ₹10     │₹1.8 │ ₹488.2 │
│  141│PayOut│ Dr  │○Pending│ ₹1200  │ ₹18     │₹3.2 │₹1221.2 │
│                                                                │
│  Page 1 of 13                          [◀] [1] [2] [3] [▶]   │
└────────────────────────────────────────────────────────────────┘
```

- **Stats**: inline row (not big cards) — `flex gap-6 text-[13px]`
- **Filters**: single horizontal row, all `h-8 rounded-md`
- **Table**: NO gradient header, flat `bg-gray-50` header
- **Columns**: ID, Type, C/D, Status, Amount, Charges, GST, Settle Amt, Balance, Order ID, Txn ID, Created
- **Export**: outline button in toolbar, not a separate page

### /merchant/paymentLink — Payment Link Generator

```
┌─────────────────────────┬─────────────────────────┐
│  Generate Payment Link  │  API Request Preview     │
│                         │                          │
│  Amount    [________]   │  curl -X POST .../init   │
│  Order ID  [____] [⟳]  │    -H "Auth: Bearer ..." │
│  Channel   [web ▾]     │    -d '{ ... }'          │
│  Purpose   [________]  │                          │
│                         │  ── Response ──          │
│  Customer               │  { "payment_url": "..." }│
│  Name     [________]   │                          │
│  Email    [________]   │  [Copy URL] [Open ↗]    │
│  Phone    [________]   │                          │
│                         │                          │
│  [Generate Link →]      │                          │
└─────────────────────────┴─────────────────────────┘
```

- **Two-column layout**: Form (left) + Preview (right)
- **Form card**: `bg-white rounded-lg border p-4`
- **Preview card**: `bg-gray-900 rounded-lg p-4` (always dark — code view)
- **cURL preview**: live-updating as form changes, `font-mono text-xs text-green-400`
- **Success banner**: `bg-green-50 border border-green-200 rounded-md p-3` with Copy + Open buttons
- **Regenerate button**: ghost button next to Order ID input

### /merchant/bankAccount — Payout Accounts

```
┌────────────────────────────────────────────────────────────────┐
│  Payout Accounts                           [+ Add Account]    │
│                                                                │
│  ┌────┐ ┌────┐ ┌────┐                                       │
│  │Tot │ │Veri│ │Lim │                                        │
│  │ 3  │ │ 2  │ │ 5  │                                        │
│  └────┘ └────┘ └────┘                                        │
│                                                                │
│  ┌───────────────────────────────────────────────────┐        │
│  │  HDFC Bank ****5678        Savings   ✓ Verified   │        │
│  │  ICICI Bank ****1234       Current   ○ Pending    │        │
│  │  SBI ****9012              Savings   ✓ Verified   │        │
│  └───────────────────────────────────────────────────┘        │
│                                                                │
│  ┌── Add Account Form ──────────────────────────────┐        │
│  │  Holder Name  [________]  IFSC  [________]       │        │
│  │  Account No   [________]  Bank  [________]       │        │
│  │                                    [Add Account]  │        │
│  └──────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────┘
```

- **Account cards** instead of table rows: `bg-white rounded-lg border p-3 flex justify-between`
- **Verification badge**: green for verified, amber for pending
- **Add form**: inline at bottom (not modal) — collapsible section

### /merchant/settlements — Settlements

- Compact table: ID, Amount, Status, Requested, Settled Date
- Status badges: rectangular `rounded-md`
- No inline actions (view-only for merchant)

### /merchant/merchantsTopup — Top Up

```
┌────────────────────────────────────────────────────────────────┐
│  Payout Wallet Top Up                                          │
│                                                                │
│  ┌── Top Up Form ──────────────────────────────────┐          │
│  │  Amount      [________]                          │          │
│  │  Payment     [UPI ▾] [NEFT ▾] [Bank Transfer ▾] │          │
│  │  Reference   [________]                          │          │
│  │  Receipt     [Upload file]                       │          │
│  │                                    [Submit →]    │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                │
│  ┌── History ───────────────────────────────────────┐         │
│  │  ID │ Amount │ Mode │ Status │ Date              │         │
│  │  ───┼────────┼──────┼────────┼────────           │         │
│  │  5  │ ₹5000  │ UPI  │●Approved│ 23 Sep           │         │
│  │  4  │ ₹2000  │ NEFT │○Pending │ 22 Sep           │         │
│  └──────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────┘
```

- **Form section**: bordered card, compact inputs
- **History table**: flat header, dense rows
- **Status**: Approved (green), Pending (amber), Rejected (red)

### /merchant/passbook — Wallet Transactions

```
┌────────────────────────────────────────────────────────────────┐
│  Passbook                                    [Download Excel]  │
│                                                                │
│  ┌────┐ ┌────┐ ┌────┐                                       │
│  │Txns│ │Vol  │ │Fees│   ← summary cards                     │
│  │ 47 │ │₹24K │ │₹480│                                       │
│  └────┘ └────┘ └────┘                                        │
│                                                                │
│  [Status ▾] [Min] [Max] [From] [To] [Search] [Apply] [Reset] │
│                                                                │
│  Date │ Order │ Txn ID │ UTR │ Amount │ Charges │ Status │ ⚡ │
│  ─────┼───────┼────────┼─────┼────────┼─────────┼────────┼── │
│  23/9 │ ORD1  │ W260.. │ 607 │ ₹500   │ ₹10     │●Success│   │
│  23/9 │ ORD2  │ W261.. │  —  │ ₹1200  │ ₹18     │○Pend  │[✓]│
│                                                                │
│  ⚡ = Check Status (only for pending/in-progress rows)         │
└────────────────────────────────────────────────────────────────┘
```

- **Summary cards**: 3-column, flat bordered
- **Check Status**: icon button `w-7 h-7 rounded-md` — only visible for pending
- **UTR column**: monospace, truncated
- **Download**: outline button with download icon

### /merchant/developer — API Docs

```
┌────────────────────────────────────────────────────────────────┐
│  API Documentation                                             │
│                                                                │
│  ┌── Provider Credentials ─────────────────────────┐          │
│  │  Client ID: live_4b47...  [Copy]                │          │
│  │  Secret:    ●●●●●●●●●●●  [Show] [Copy]         │          │
│  └─────────────────────────────────────────────────┘          │
│                                                                │
│  ┌── Base URL ─────────────────────────────────────┐          │
│  │  POST  http://127.0.0.1:8000              [Copy]│          │
│  └─────────────────────────────────────────────────┘          │
│                                                                │
│  ┌── Endpoints ────────────────────────────────────┐          │
│  │  POST  /api/v1/auth/login                       │          │
│  │  POST  /live/payin/initiate                     │          │
│  │  GET   /live/payin/txns/status                  │          │
│  │  POST  /live/payout/initiate                    │          │
│  │  POST  /live/payout/txns/status                 │          │
│  └─────────────────────────────────────────────────┘          │
│                                                                │
│  ┌── 1. Authentication ────────────────────────────┐          │
│  │  POST /api/v1/auth/login                        │          │
│  │  ┌─────────────────────────────────────────┐    │          │
│  │  │ curl -X POST .../login \                │    │          │
│  │  │   -d "username=...&password=..."        │    │          │
│  │  └─────────────────────────────────────────┘    │          │
│  │  Response: { access_token, expires_in }         │          │
│  └─────────────────────────────────────────────────┘          │
│  ... (10 sections)                                             │
└────────────────────────────────────────────────────────────────┘
```

- **Sections**: `bg-gray-50 dark:bg-gray-800/50 rounded-lg border p-4`
- **Code blocks**: always dark `bg-gray-900 text-gray-100 rounded-md p-3 font-mono text-xs`
- **Endpoint cards**: `bg-white rounded-md border p-3` with method badge
- **Method badges**: `POST` = indigo, `GET` = green, inline `text-[11px] font-bold px-1.5 py-0.5 rounded`
- **Copy buttons**: `w-7 h-7 rounded-md hover:bg-gray-100` ghost

### /merchant/changePassword — Change Password

```
┌────────────────────────────────────────────────────────────────┐
│  Change Password                                               │
│  Update your account password                                  │
│                                                                │
│  ┌── Security Tips ────────────────────────────────┐          │
│  │  🔒 Use 8+ chars with letters, numbers, symbols │          │
│  └─────────────────────────────────────────────────┘          │
│                                                                │
│  ┌── Update Password ─────────────────────────────┐           │
│  │  Current Password  [________] 👁               │           │
│  │  New Password      [________] 👁               │           │
│  │  Strength: ████████░░ Good                     │           │
│  │  Confirm Password  [________] 👁               │           │
│  │                                                 │           │
│  │                    [Clear]  [Update Password →] │           │
│  └─────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

- **Tips banner**: `bg-amber-50 border border-amber-200 rounded-md p-3 text-[13px]`
- **Form card**: flat bordered, `max-w-lg mx-auto`
- **Strength meter**: colored bar (`w-full h-1.5 rounded-full`)
- **Eye toggle**: `w-7 h-7 rounded-md`

---

## Key Differences from Current Merchant Design

| Current | Redesign |
|---------|----------|
| `text-[22px]` headings | `text-xl` (20px) |
| `border-l-4` accent cards | No accent bar (flat bordered) |
| `shadow-sm` cards | No shadow (border only) |
| `rounded-xl` cards | `rounded-lg` (tighter) |
| `rounded-lg` buttons | `rounded-md` (tighter) |
| `h-9` buttons | `h-8` (compact) |
| `p-5` card padding | `p-4` (tighter) |
| `space-y-6` sections | `gap-5` (tighter) |
| Gradient text headings | Plain `text-gray-900` headings |
| `rounded-full` badges | `rounded-md` badges |
| Gradient table headers | Flat `bg-gray-50` headers |
| `shadow-lg` modals | No shadow modals (border only) |
| DM Sans font | Inter font |
| `#3871C2` primary blue | `#4F6BF6` indigo |
| `#00ADEF` secondary cyan | `#06B6D4` cyan-500 |

---

## Dark Mode (same tokens as Admin)

| Light | Dark |
|-------|------|
| `bg-white` | `dark:bg-gray-900` |
| `bg-gray-50` | `dark:bg-gray-800/50` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-500` | `dark:text-gray-400` |
| `border-gray-200` | `dark:border-gray-800` |
| `hover:bg-gray-50` | `dark:hover:bg-gray-800/50` |

---

## Responsive Behavior

| Width | Layout |
|-------|--------|
| > 1024px | Sidebar + content, 4-col stat cards |
| 768-1024px | Hamburger, 2-col cards, table scrolls |
| < 768px | Single column, card-based mobile views |
| < 480px | Filters stack, buttons full-width |

### Mobile-specific
- Payment Link: stacks to single column (form above, preview below)
- Passbook: horizontal scroll on table, sticky first column
- API Docs: code blocks scroll independently

---

## Implementation Priority

1. **Dashboard** — flat stat cards, compact withdraw form
2. **Transactions** — inline stats, flat table, no gradient
3. **Passbook** — same flat treatment, check status as icon
4. **Payment Link** — dark code preview panel
5. **API Docs** — section cards, method badges
6. **Account View** — card-based accounts instead of table
7. **Change Password** — strength meter bar
8. **Top Up** — compact form + history table
9. **Settlements** — simple read-only table
