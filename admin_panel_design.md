# Vichitrapay Admin Panel — Redesign Specification v2

**Style**: Corporate Pro (inspired by Razorpay, PayU, Cashfree)
**Scope**: `/admin/*` routes only

---

## Design Philosophy

Clean, structured, data-dense. The admin sees hundreds of transactions daily — every pixel serves a purpose. No decorative gradients on tables, no playful animations. Information hierarchy through weight and color, not ornament.

---

## Color Palette (NEW)

### Primary
```
Navy:       #0F2744    Sidebar background, primary dark
Navy-mid:   #1B3A5C    Sidebar hover, card accents
Indigo:     #4F6BF6    Primary actions, links, active states
```

### Semantic
```
Success:    #22C55E    Completed, approved, credited
Warning:    #F59E0B    Pending, in-progress
Danger:     #EF4444    Failed, rejected, errors
Info:       #3B82F6    Informational, PayIn badge
```

### Neutrals
```
White:      #FFFFFF    Card surfaces
Gray-50:    #F8FAFC    Page background, table header
Gray-100:   #F1F5F9    Borders, dividers (light)
Gray-200:   #E2E8F0    Input borders
Gray-400:   #94A3B8    Placeholder, muted text
Gray-500:   #64748B    Secondary text, labels
Gray-700:   #334155    Body text
Gray-900:   #0F172A    Headings, primary text
```

### Dark Mode
```
Dark-bg:    #0B1120    Page background
Dark-card:  #111827    Card surfaces
Dark-hover: #1F2937    Table hover, active states
Dark-border:#1E293B    All borders
Dark-text:  #E2E8F0    Primary text
Dark-muted: #94A3B8    Secondary text
```

---

## Typography (NEW)

Font: **Inter** (Google Fonts) — the fintech standard

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Scale
```
Page title:       20px / 600 / -0.02em    (text-xl font-semibold tracking-tight)
Section title:    16px / 600              (text-base font-semibold)
Card value:       28px / 700 / tabular    (text-[28px] font-bold)
Card label:       11px / 500 / uppercase  (text-[11px] font-medium uppercase tracking-widest)
Table header:     11px / 600 / uppercase  (text-[11px] font-semibold uppercase tracking-wider)
Table cell:       13px / 400              (text-[13px])
Button:           13px / 500              (text-[13px] font-medium)
Badge:            11px / 600              (text-[11px] font-semibold)
Caption:          12px / 400              (text-xs)
Mono:             12px / JetBrains Mono   (font-mono text-xs)
```

---

## Layout (NEW)

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR  h-[52px]  bg-white  border-b                          │
│  ┌──────┐                     [Search] [🔔] [Theme] [Avatar▾] │
│  │ Logo │ Vichitrapay                                               │
│  └──────┘                                                       │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  SIDEBAR   │  CONTENT                                          │
│  w-[220px] │  bg-gray-50  p-6                                  │
│  bg-navy   │                                                    │
│            │  ┌─────────────────────────────────────────┐      │
│  Dashboard │  │  Page Title        [Filter] [Export]    │      │
│  Merchants │  └─────────────────────────────────────────┘      │
│  ──────── │                                                    │
│  Txns     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │
│  Settle   │  │Card│ │Card│ │Card│ │Card│  ← stat cards        │
│  Report   │  └────┘ └────┘ └────┘ └────┘                     │
│  ──────── │                                                    │
│  Payouts  │  ┌─────────────────────────────────────────┐      │
│  Bank     │  │  TABLE with pagination                   │      │
│            │  └─────────────────────────────────────────┘      │
│            │                                                    │
│  ┌──────┐ │                                                    │
│  │User  │ │                                                    │
│  │Card  │ │                                                    │
│  └──────┘ │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

### Topbar (replaces current Navbar)
- Height: `h-[52px]` (compact — not 56 or 64)
- Background: `bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800`
- No backdrop-blur (solid background)
- Left: Logo (24px) + "Vichitrapay" text (font-semibold text-gray-900)
- Right: Search input (w-64, hidden on mobile) → Notification bell → Theme toggle → Avatar dropdown

### Sidebar (narrower, cleaner)
- Width: `w-[220px]` (was 260px — tighter)
- Background: `#0F2744` solid (no gradient)
- Nav items:
  - Inactive: `text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-md text-[13px]`
  - Active: `text-white bg-white/10 border-l-2 border-indigo-400 px-3 py-2`
  - Icons: `w-4 h-4` (smaller than current 5)
- Section dividers: `border-t border-white/10 my-2`
- User card at bottom: just initials circle + name, no email (compact)

### Content Area
- Background: `bg-gray-50 dark:bg-[#0B1120]`
- Padding: `px-6 py-5`
- Max width: none (fills available space — data tables need room)

---

## Component Redesign

### Stat Cards

```
┌────────────────────────────────┐
│  Total Merchants               │
│  1,247                    [📊] │
│  ↑ 12% from last week         │
└────────────────────────────────┘
```

- Container: `bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4`
- NO border-l-4 accent (cleaner)
- NO shadow (flat cards, border only)
- Label: `text-[11px] font-medium text-gray-500 uppercase tracking-widest`
- Value: `text-[28px] font-bold text-gray-900 dark:text-gray-100 mt-1` + tabular-nums
- Icon: `w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600` (top-right)
- Change: `text-xs text-green-600 flex items-center gap-1 mt-2`
- Grid: `grid grid-cols-2 lg:grid-cols-4 gap-4`

### Tables (major change — no colored headers)

```
┌─────────────────────────────────────────────────────────┐
│  Recent Transactions                    148 results     │
├─────┬──────────┬────────┬────────┬──────┬──────────────┤
│ ID  │ Merchant │ Amount │ Status │ Date │              │  ← bg-gray-50
├─────┼──────────┼────────┼────────┼──────┼──────────────┤
│ 142 │ Store X  │ ₹500   │ ● Done │ Sep  │ ···          │
│ 141 │ Shop Y   │ ₹1.2K  │ ○ Pend │ Sep  │ ···          │
└─────┴──────────┴────────┴────────┴──────┴──────────────┘
```

- Wrapper: `bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800`
- NO shadow on table wrapper
- Header: `bg-gray-50 dark:bg-gray-800/50`
- Header text: `text-[11px] font-semibold uppercase tracking-wider text-gray-500`
- Cells: `px-4 py-3 text-[13px] text-gray-700 dark:text-gray-300`
- Row border: `border-gray-100 dark:border-gray-800` (very subtle)
- Row hover: `hover:bg-gray-50 dark:hover:bg-gray-800/50` (subtle, not colored)
- Amounts: `font-mono text-[13px] tabular-nums font-medium`

### Buttons (simpler, no gradients)

```
Primary:    bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 rounded-md text-[13px]
Secondary:  bg-white border border-gray-300 text-gray-700 h-8 px-3 rounded-md text-[13px]
Success:    bg-green-600 hover:bg-green-700 text-white h-8 px-3 rounded-md
Danger:     bg-white border border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 rounded-md
Ghost:      text-gray-500 hover:text-gray-700 hover:bg-gray-100 h-8 px-3 rounded-md
```

- Height: `h-8` (compact — was h-9)
- Radius: `rounded-md` (was rounded-lg — tighter)
- NO gradient backgrounds anywhere
- NO shadow on buttons
- Icon buttons: `w-8 h-8 rounded-md` (square)

### Badges (compact, no gradients)

```
Success:    bg-green-50 text-green-700 border border-green-200    "Success"
Pending:    bg-amber-50 text-amber-700 border border-amber-200    "Pending"
Failed:     bg-red-50 text-red-700 border border-red-200          "Failed"
PayIn:      bg-blue-50 text-blue-700 border border-blue-200       "PayIn"
PayOut:     bg-purple-50 text-purple-700 border border-purple-200  "PayOut"
```

- Size: `text-[11px] font-medium px-2 py-0.5 rounded-md` (not rounded-full — rectangular pills)
- NO dot indicator before text

### Inputs / Selects

```
className="h-8 px-3 text-[13px] bg-white dark:bg-gray-900
  border border-gray-300 dark:border-gray-700 rounded-md
  text-gray-900 dark:text-gray-100
  focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
  placeholder:text-gray-400"
```

### Modals (cleaner)

- Overlay: `bg-black/50` (no blur — faster render)
- Modal: `bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 max-w-lg`
- Title: `text-base font-semibold text-gray-900 dark:text-gray-100`
- Description: `text-[13px] text-gray-500 mt-0.5`
- Footer: `flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100 dark:border-gray-800`
- NO rounded-xl on modals (use rounded-lg)
- Close X: top-right, `w-8 h-8 rounded-md hover:bg-gray-100`

### Action Menu (replaces dropdown)

- Trigger: `w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center` with `···` icon
- Menu: `w-52 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 shadow-lg z-50 py-1`
- Items: `px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 flex items-center gap-2`
- Destructive items: `text-red-600 hover:bg-red-50`

---

## Page Redesigns

### /admin — Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                        [Refresh]   │
│  Overview of today's platform activity                         │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Merchants │ │Volume    │ │Success   │ │Fees      │        │
│  │1,247     │ │₹18.4L   │ │1,842     │ │₹36,908   │        │
│  │↑12%      │ │↑49%     │ │96.2%     │ │↑29%      │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│                                                                │
│  ┌─────────────────────────────┐ ┌───────────────────┐       │
│  │  Revenue Chart              │ │  Status Donut     │       │
│  │  ═══════════════            │ │    ╭────╮         │       │
│  │  [7D] [14D] [30D]          │ │   │ 96% │         │       │
│  └─────────────────────────────┘ └───────────────────┘       │
│                                                                │
│  ┌──────────────────┐ ┌──────────────────┐                   │
│  │  Daily Bar        │ │  Fees Trend       │                  │
│  └──────────────────┘ └──────────────────┘                   │
│                                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │KYC:8 │ │Settle│ │Bank:3│ │Bal:₹4L│  ← pending actions    │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
└────────────────────────────────────────────────────────────────┘
```

### /admin/merchants

- NO "Add Merchant" button as a big CTA — move to top-right, small `h-8` primary
- Stats: 2-column (Total + KYC) not 4
- Table: denser rows (py-2.5 not py-4), more columns visible
- Password column: masked by default, click to reveal
- Actions: `···` icon button, not "Actions ▾" text button

### /admin/transactions

- No summary cards at top — just the filter bar + table (data-first)
- Filter bar: single row, 6 inputs inline
- Mark Failed/Success: in `···` menu, not as visible buttons

### /admin/report

- Compact stat row (inline numbers, not big cards)
- Download button in toolbar, not separate dialog (use browser native)
- Merchant filter as searchable input, not dropdown

---

## Spacing Rules

```
Page padding:      px-6 py-5
Between sections:  gap-5 (was gap-6 — tighter)
Card padding:      p-4 (was p-5 — tighter)
Card gap:          gap-4
Table cell:        px-4 py-2.5 (denser)
Table header:      px-4 py-2
Modal padding:     p-5
Button height:     h-8 (was h-9)
Input height:      h-8
Badge padding:     px-2 py-0.5
```

---

## Key Differences from Current Design

| Current | Redesign |
|---------|----------|
| Gradient sidebar (#2C5FA8→#1e3a6e) | Solid navy (#0F2744) |
| Sidebar 260px | 220px (narrower) |
| Active: white bg + blue text | White/10 bg + left border accent |
| Gradient table headers (blue→cyan) | Flat bg-gray-50 |
| rounded-xl cards | rounded-lg (tighter) |
| shadow-sm cards | No shadow (border only) |
| border-l-4 accent on cards | No accent bar |
| Gradient buttons | Solid color buttons |
| rounded-full badges | rounded-md badges |
| h-9 buttons | h-8 buttons |
| text-[22px] headings | text-xl headings |
| 3-color brand gradient text | Plain text headings |
| DM Sans font | Inter font |
| Space-y-6 sections | gap-5 sections |
| p-5 card padding | p-4 card padding |

---

## Implementation Priority

1. **Topbar + Sidebar** — new layout, narrower sidebar, solid navy
2. **Stat cards** — remove accents/shadows, flat bordered cards
3. **Tables** — remove gradient headers, denser rows
4. **Buttons** — solid colors, h-8, rounded-md
5. **Badges** — rectangular, bordered
6. **Modals** — rounded-lg, no blur backdrop
7. **Charts** — keep Chart.js, update colors to indigo palette
8. **Dark mode** — update all tokens to new dark palette

---

## Charts & Data Visualization

### Library
Chart.js 4.4.1 loaded via CDN (`cdnjs.cloudflare.com`).
Font: Inter (same as UI).

### Chart Color Palette (NEW — Indigo-based)
```
PayIn line:       #4F6BF6 (indigo-600)       fill: rgba(79,107,246,.12)
PayOut line:      #06B6D4 (cyan-500)          fill: rgba(6,182,212,.08)
Success:          #22C55E (green-500)
Pending:          #F59E0B (amber-500)
Failed:           #EF4444 (red-500)
Fees:             #F59E0B (amber-500)         fill: rgba(245,158,11,.12)
Grid:             rgba(0,0,0,0.04)            (dark: rgba(255,255,255,0.04))
Text/Labels:      #64748B (gray-500)          (dark: #94A3B8)
Tooltip bg:       #0F172A                     border: #1E293B
```

### Global Chart Config
```js
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = "#64748B";
Chart.defaults.animation.duration = 600;
Chart.defaults.animation.easing = "easeOutQuart";

// Tooltips
Chart.defaults.plugins.tooltip.backgroundColor = "#0F172A";
Chart.defaults.plugins.tooltip.borderColor = "#1E293B";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.plugins.tooltip.padding = { top: 6, bottom: 6, left: 10, right: 10 };
Chart.defaults.plugins.tooltip.titleFont = { size: 11, weight: "600" };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
```

### Chart Layout

```
┌──────────────────────────────────────────────┬──────────────────┐
│  Revenue Overview                     [30D]  │  Status          │
│                                              │     ╭────╮       │
│  ₹18L ┤              ╭──●                    │   ╭─╯96% ╰─╮    │
│  ₹12L ┤    ●───╮───╯                        │   │        │    │
│   ₹8L ┤───╯                                  │   ╰─╮    ╭─╯    │
│       └──┬──┬──┬──┬──┬──                     │     ╰────╯       │
│         1   5  10  15  20  23                │                  │
│                                              │  ● 96% Success   │
│  ── PayIn   - - PayOut                       │  ● 3%  Pending   │
│                                              │  ● 1%  Failed    │
│  height: 220px                               │  height: 220px   │
├──────────────────────────┬───────────────────┴──────────────────┤
│  Daily Transactions      │  Platform Fees                       │
│                          │                                      │
│  400 ┤  ■                │  ₹37K ┤                    ●         │
│  300 ┤  ■  ■             │  ₹30K ┤   ╭────╯──────╮  ╱          │
│  200 ┤  ■  ■  ■          │  ₹28K ┤──●╯           ╰─╯           │
│  100 ┤  ■  ■  ■  ■       │       └──W1───W2───W3───W4          │
│      └──Mo Tu We Th Fr   │                                      │
│                          │  height: 200px                       │
│  height: 200px           │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

Grid: `grid grid-cols-1 lg:grid-cols-3 gap-4` (row 1) + `grid grid-cols-1 md:grid-cols-2 gap-4` (row 2)

### 1. Revenue Line Chart (2/3 width)

```js
{
  type: "line",
  datasets: [
    {
      label: "PayIn",
      borderColor: "#4F6BF6",
      backgroundColor: gradientFill,   // rgba(79,107,246,.12) → transparent
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointRadius: 0,                  // no dots (cleaner)
      pointHoverRadius: 4,             // show on hover only
    },
    {
      label: "PayOut",
      borderColor: "#06B6D4",
      borderWidth: 1.5,
      borderDash: [4, 3],
      tension: 0.3,
      fill: false,                     // no fill for secondary line
      pointRadius: 0,
    }
  ],
  options: {
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
        ticks: { callback: v => "₹" + formatLakhs(v) }
      }
    }
  }
}
```

**Time pills**: `[7D] [14D] [30D]` — `h-7 px-2.5 text-[11px] rounded-md`
- Active: `bg-indigo-600 text-white`
- Inactive: `bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200`

**Custom legend** (below chart):
```
── PayIn Volume    - - PayOut Volume
```
`text-[11px] text-gray-500 flex gap-4 mt-2`

### 2. Status Doughnut (1/3 width)

```js
{
  type: "doughnut",
  data: {
    datasets: [{
      data: [success, pending, failed],
      backgroundColor: ["#22C55E", "#F59E0B", "#EF4444"],
      borderWidth: 0,
      hoverOffset: 4,
    }]
  },
  options: {
    cutout: "72%",                     // thinner ring
    plugins: { legend: { display: false } }
  }
}
```

**Center text** (overlay on canvas): Large percentage + "Success Rate" label
**Side legend**: vertical list with colored dots + count + percentage

### 3. Daily Bar Chart (1/2 width)

```js
{
  type: "bar",
  datasets: [
    {
      label: "PayIn",
      backgroundColor: "#4F6BF6",
      borderRadius: 4,                // slightly rounded (was 6)
      barPercentage: 0.5,
      categoryPercentage: 0.7,
    },
    {
      label: "PayOut",
      backgroundColor: "#06B6D4",
      borderRadius: 4,
      barPercentage: 0.5,
      categoryPercentage: 0.7,
    }
  ],
  options: {
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 8, padding: 12, font: { size: 11 } }
      }
    }
  }
}
```

### 4. Fees Area Chart (1/2 width)

```js
{
  type: "line",
  datasets: [{
    label: "Fees",
    borderColor: "#F59E0B",
    backgroundColor: gradientFill,     // rgba(245,158,11,.12) → transparent
    borderWidth: 2,
    tension: 0.3,
    fill: true,
    pointRadius: 0,
    pointHoverRadius: 4,
  }],
  options: {
    scales: {
      y: { ticks: { callback: v => "₹" + (v/1000).toFixed(0) + "K" } }
    }
  }
}
```

### Chart Card Container

```
className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200
  dark:border-gray-800 p-4"
```

- Title: `text-[13px] font-semibold text-gray-900 dark:text-gray-100`
- Subtitle: `text-[11px] text-gray-500 mt-0.5`
- NO shadow on chart cards (flat, border only)
- Chart height: 220px (row 1), 200px (row 2)

### Chart Dark Mode

```
Grid:        rgba(255,255,255,0.04)
Labels:      #94A3B8
Tooltip bg:  #1E293B
Tooltip border: #334155
Point hover: pointBorderColor: dark ? "#1F2937" : "#fff"
```

### Chart Loading State

```
<div className="flex items-center justify-center" style={{ height: 220 }}>
  <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600
    rounded-full animate-spin" />
</div>
```

### Chart Empty State (no data)

```
<div className="flex flex-col items-center justify-center text-gray-400"
  style={{ height: 220 }}>
  <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
  <span className="text-[11px]">No data for this period</span>
</div>
```

### Chart Responsive Behavior

| Width | Layout |
|-------|--------|
| > 1024px | 2/3 + 1/3 (row 1), 1/2 + 1/2 (row 2) |
| 768-1024px | Full width stacked, heights unchanged |
| < 768px | Full width, heights reduced to 180px |
