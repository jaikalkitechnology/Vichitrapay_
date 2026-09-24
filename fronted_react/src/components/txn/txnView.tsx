// Merchant Transactions — own PayIn / PayOut history
import { useState, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, BarChart3, Download, Eye, FileText, IndianRupee, Inbox, Loader2, Percent, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, StatusBadge } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import Pager from "@/components/admin-part/Pager";
import { changeLabel, filterInputCls, fmtDateTimeParts, lastNDays, rangeText } from "@/components/admin-part/listUtils";
import useTransactions from "@/components/txn/useTransactions";
import useAnalytics from "@/components/txn/useAnalytics";
import { WalletTransactionOut } from "@/api/apiHelper";

type Filters = {
  transaction_type: string;
  credit_debit: string;
  status: string;
  min_amount: string;
  max_amount: string;
  date_from: string;
  date_to: string;
  search: string;
};
const EMPTY: Filters = { transaction_type: "", credit_debit: "", status: "", min_amount: "", max_amount: "", date_from: "", date_to: "", search: "" };

const money = (v?: number | null) =>
  v === null || v === undefined ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inr0 = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

export default function TransactionsPage() {
  const { query, data, loading, error, setPage, setPerPage, setSort, setFilter, refresh } = useTransactions();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [view, setView] = useState<WalletTransactionOut | null>(null);

  // Cards: the applied date range, or the last 30 days when none is set
  const fallback = lastNDays(30);
  const range = { from: applied.date_from || fallback.from, to: applied.date_to || fallback.to };
  const analytics = useAnalytics(
    {
      from_date: range.from,
      to_date: range.to,
      transaction_type: applied.transaction_type || undefined,
      status: applied.status || undefined,
      search: applied.search || undefined,
    },
    "/merchant/analytics"
  );
  const rangeLabel = applied.date_from || applied.date_to ? rangeText(range.from, range.to) : "Last 30 days";

  const apply = (f: Filters) => {
    setApplied(f);
    setFilter({
      transaction_type: f.transaction_type || undefined,
      credit_debit: f.credit_debit || undefined,
      status: f.status || undefined,
      min_amount: f.min_amount ? Number(f.min_amount) : undefined,
      max_amount: f.max_amount ? Number(f.max_amount) : undefined,
      date_from: f.date_from || undefined,
      // inclusive end date
      date_to: f.date_to ? `${f.date_to}T23:59:59` : undefined,
      search: f.search.trim() || undefined,
    });
  };

  const toggleSort = (field: string) => setSort(field, query.sort_by === field ? !query.sort_desc : true);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? query.page ?? 1;
  const perPage = data?.per_page ?? query.per_page ?? 20;

  // Export the rows currently shown as CSV (there is no server-side export for transactions)
  const exportCsv = () => {
    const cols: (keyof WalletTransactionOut)[] = ["id", "created_at", "transaction_type", "credit_debit", "status", "amount", "charges", "gst", "settle_amount", "balance_amount", "order_id", "txn_id", "utr", "reference_id"];
    const esc = (v: unknown) => {
      const t = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const csv = [cols.join(","), ...items.map((it) => cols.map((c) => esc(it[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_page${page}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = analytics.data?.totals;
  const p = analytics.data?.previous;
  const daily = analytics.data?.daily ?? [];
  const cmp = (cur?: number | null, prev?: number | null) => {
    const c = cur == null ? null : changeLabel(cur, prev ?? null, false);
    return c ? { hint: c.text, hintTone: (c.up ? "up" : "down") as "up" | "down" } : { hint: "No earlier data to compare" };
  };

  const TH = "whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500";
  const TD = "whitespace-nowrap px-3 py-3 text-[13px] text-gray-700 dark:text-gray-300";
  const AMT = "whitespace-nowrap px-3 py-3 text-right text-[13px] tabular-nums";
  const sortHead = (field: string, label: string, align = "text-left") => (
    <th className={`${TH} ${align}`}>
      <button onClick={() => toggleSort(field)} className="inline-flex items-center gap-1 uppercase hover:text-gray-900 dark:hover:text-gray-100">
        {label}
        {query.sort_by === field && (query.sort_desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Transactions</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Your PayIn and PayOut transaction history</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={exportCsv} disabled={!items.length} className="h-11 rounded-xl px-4" title="Download the rows on this page as CSV">
            <Download /> Export
          </Button>
          <Button variant="outline" onClick={() => { refresh(); analytics.reload(); }} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <p className="-mb-2 text-[12px] text-gray-400">
        Figures for {rangeLabel.toLowerCase().startsWith("last") ? rangeLabel.toLowerCase() : rangeLabel}; volume and averages count successful transactions.
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Total Transactions"
          value={t ? t.txns.toLocaleString("en-IN") : "…"}
          icon={FileText}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          {...cmp(t?.txns, p?.txns)}
          trend={daily.map((d) => d.payin_total + d.payout_total)}
          color="#3B6BF6"
        />
        <TspStat
          label="Total Volume"
          value={t ? inr0(t.success_volume) : "…"}
          icon={BarChart3}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          {...cmp(t?.success_volume, p?.success_volume)}
          trend={daily.map((d) => d.payin_volume + d.payout_volume)}
          color="#22C55E"
        />
        <TspStat
          label="Success Rate"
          value={t ? (t.success_rate != null ? `${t.success_rate.toFixed(1)}%` : "—") : "…"}
          icon={Percent}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          hint="Successful / all transactions"
          trend={daily.map((d) => {
            const all = d.payin_total + d.payout_total;
            return all ? ((d.payin_count + d.payout_count) / all) * 100 : 0;
          })}
          color="#8B5CF6"
        />
        <TspStat
          label="Average Value"
          value={t ? (t.avg_txn_size != null ? inr0(t.avg_txn_size) : "—") : "…"}
          icon={IndianRupee}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          {...cmp(t?.avg_txn_size, p?.avg_txn_size)}
          trend={daily.map((d) => {
            const n = d.payin_count + d.payout_count;
            return n ? (d.payin_volume + d.payout_volume) / n : 0;
          })}
          color="#F59E0B"
        />
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
        className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-4 xl:grid-cols-[repeat(8,minmax(0,1fr))_auto]"
      >
        <select value={draft.transaction_type} onChange={(e) => setDraft((d) => ({ ...d, transaction_type: e.target.value }))} className={filterInputCls} aria-label="Type">
          <option value="">All Types</option>
          <option value="PayIn">PayIn</option>
          <option value="PayOut">PayOut</option>
        </select>
        <select value={draft.credit_debit} onChange={(e) => setDraft((d) => ({ ...d, credit_debit: e.target.value }))} className={filterInputCls} aria-label="Credit or debit">
          <option value="">Cr / Dr</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className={filterInputCls} aria-label="Status">
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <input type="number" min={0} value={draft.min_amount} onChange={(e) => setDraft((d) => ({ ...d, min_amount: e.target.value }))} placeholder="Min ₹" className={filterInputCls} aria-label="Min amount" />
        <input type="number" min={0} value={draft.max_amount} onChange={(e) => setDraft((d) => ({ ...d, max_amount: e.target.value }))} placeholder="Max ₹" className={filterInputCls} aria-label="Max amount" />
        <input type="date" value={draft.date_from} max={draft.date_to || undefined} onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))} className={`${filterInputCls} dark:[color-scheme:dark]`} aria-label="From date" title="From date" />
        <input type="date" value={draft.date_to} min={draft.date_from || undefined} onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))} className={`${filterInputCls} dark:[color-scheme:dark]`} aria-label="To date" title="To date" />
        <input value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} placeholder="Order / Txn / Ref ID" className={filterInputCls} aria-label="Search" />
        <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-1">
          <Button type="submit" className="h-11 flex-1 rounded-xl px-5 xl:flex-none">Apply</Button>
          <Button type="button" variant="outline" onClick={() => { setDraft(EMPTY); apply(EMPTY); }} className="h-11 flex-1 rounded-xl px-4 xl:flex-none">
            Reset
          </Button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Transaction History</h2>
              <p className="text-[13px] text-gray-500">{loading ? "Loading…" : `${total.toLocaleString("en-IN")} results`}</p>
            </div>
          </div>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className={`${filterInputCls.replace("w-full", "w-auto")} h-10`}
            aria-label="Rows per page"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr>
                <th className={`${TH} pl-5 text-left`}>#</th>
                {sortHead("created_at", "Date & Time")}
                {sortHead("transaction_type", "Type")}
                <th className={`${TH} text-left`}>C / D</th>
                <th className={`${TH} text-left`}>Status</th>
                {sortHead("amount", "Amount", "text-right")}
                <th className={`${TH} text-right`}>Charges</th>
                <th className={`${TH} text-right`}>GST</th>
                <th className={`${TH} text-right`}>Settle Amt</th>
                <th className={`${TH} text-right`}>Balance</th>
                <th className={`${TH} text-left`}>Order ID</th>
                <th className={`${TH} text-left`}>Txn ID</th>
                <th className={`${TH} sticky right-0 bg-slate-50 pr-5 text-center shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-gray-800`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={13} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : error ? (
                <tr><td colSpan={13}><EmptyState icon={AlertCircle} title="Could not load transactions" description={String(error)} /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={13}><EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters or search terms" /></td></tr>
              ) : (
                items.map((it) => {
                  const dt = fmtDateTimeParts(it.created_at);
                  return (
                    <tr key={it.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className={`${TD} pl-5 text-gray-500`}>{it.id}</td>
                      <td className={TD}>
                        <div>{dt.day}</div>
                        <div className="text-[12px] text-gray-500">{dt.time}</div>
                      </td>
                      <td className={TD}><StatusBadge status={it.transaction_type} /></td>
                      <td className={TD}>
                        <StatusBadge status={it.credit_debit}>{it.credit_debit === "credit" ? "Cr" : it.credit_debit === "debit" ? "Dr" : "—"}</StatusBadge>
                      </td>
                      <td className={TD}><StatusBadge status={it.status} /></td>
                      <td className={`${AMT} font-semibold text-gray-900 dark:text-gray-100`}>{money(it.amount)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(it.charges)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(it.gst)}</td>
                      <td className={`${AMT} text-gray-700 dark:text-gray-300`}>{money(it.settle_amount)}</td>
                      <td className={`${AMT} text-gray-700 dark:text-gray-300`}>{money(it.balance_amount)}</td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{it.order_id || "—"}</td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{it.txn_id || "—"}</td>
                      <td className="sticky right-0 bg-white px-3 py-2 pr-5 text-center shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800">
                        <button
                          onClick={() => setView(it)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-400"
                          aria-label={`View transaction ${it.id}`}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && <Pager page={page} perPage={perPage} total={total} noun="transactions" onPage={setPage} />}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>#{view?.id} · {view?.txn_id || "no txn id"}</DialogDescription>
          </DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3">
              {([
                ["Type", <StatusBadge key="t" status={view.transaction_type} />],
                ["Credit / Debit", <StatusBadge key="c" status={view.credit_debit} />],
                ["Status", <StatusBadge key="s" status={view.status} />],
                ["Amount", money(view.amount)],
                ["Charges", money(view.charges)],
                ["GST", money(view.gst)],
                ["Settle Amount", money(view.settle_amount)],
                ["Balance After", money(view.balance_amount)],
                ["Date", view.created_at ? new Date(view.created_at).toLocaleString() : "—"],
                ["Order ID", view.order_id || "—"],
                ["UTR", view.utr || "—"],
                ["Reference", view.reference_id || "—"],
                ["Channel", view.instrument_mode || "—"],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
              {view.description && (
                <div className="col-span-full">
                  <dt className="text-gray-500">Description</dt>
                  <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{view.description}</dd>
                </div>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
