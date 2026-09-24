// Merchant Passbook — ledger of payout-wallet transactions and charges
import { useCallback, useEffect, useState, type ReactNode } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { AlertCircle, ArrowLeftRight, BarChart3, BookOpen, Coins, Download, Eye, FileText, Inbox, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, StatusBadge } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import Pager from "@/components/admin-part/Pager";
import { currentMonthRange, errorText, filterInputCls, rangeText } from "@/components/admin-part/listUtils";
import useAnalytics from "@/components/txn/useAnalytics";

// All endpoints are scoped to the logged-in merchant's payout wallet (PayOut ledger)
const API_BASE = `${BASE_URL}/merchant`;
const LIST_URL = `${API_BASE}/wallet-transactions`;
const EXPORT_URL = `${API_BASE}/payouts/export`;
const SUMMARY_URL = `${API_BASE}/merchant/summary`;
const CHECK_STATUS_URL = `${API_ORIGIN}/live/payout/status/zeepay`;

type Row = {
  id: number;
  order_id?: string | null;
  txn_id?: string | null;
  utr?: string | null;
  amount: number;
  charges?: number | null;
  gst?: number | null;
  settle_amount?: number | null;
  balance_amount?: number | null;
  status?: string | null;
  credit_debit?: string | null;
  transaction_type?: string | null;
  instrument_mode?: string | null;
  description?: string | null;
  reference_id?: string | null;
  created_at?: string | null;
};

type Filters = { status: string; min: string; max: string; from: string; to: string; search: string; sort: string };
const EMPTY: Filters = { status: "", min: "", max: "", from: "", to: "", search: "", sort: "created_at:desc" };

const money = (v?: number | null) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const money0 = (v?: number | string | null) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (d?: string | null) => (d ? new Date(d).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

/** "PayOut - Bank" style description from the row's own fields. */
const describe = (r: Row) => {
  const kind = r.credit_debit === "credit" ? "Credit" : "PayOut";
  const mode = r.instrument_mode ? r.instrument_mode.replace(/_/g, " ") : null;
  return mode ? `${kind} - ${mode}` : r.description || kind;
};

export default function Passbook() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [items, setItems] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ total_txns: number; total_volume: string; total_charges: string; date_from?: string; date_to?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [downloading, setDownloading] = useState(false);
  const [view, setView] = useState<Row | null>(null);

  const [sortBy, sortDir] = applied.sort.split(":");
  // summary defaults to the current month when no dates are chosen
  const month = currentMonthRange();
  const range = { from: applied.from || month.from, to: applied.to || month.to };
  const trend = useAnalytics({ from_date: range.from, to_date: range.to, transaction_type: "PayOut", status: applied.status || undefined }, "/merchant/analytics");

  const fetchList = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, per_page: perPage, sort_by: sortBy, sort_dir: sortDir };
      if (applied.status) params.status = applied.status;
      if (applied.min) params.min_amount = applied.min;
      if (applied.max) params.max_amount = applied.max;
      if (applied.from) params.from_date = applied.from;
      if (applied.to) params.to_date = applied.to;
      if (applied.search.trim()) params.search = applied.search.trim();
      const { data } = await api.get(LIST_URL, { params });
      setItems(data.items || []);
      setTotal(data.meta?.total ?? 0);
    } catch (err) {
      setError(errorText(err, "Failed to load transactions"));
      setItems([]);
    }
  }, [applied, page, perPage, sortBy, sortDir]);

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get(SUMMARY_URL, {
        params: { status: applied.status || undefined, date_from: applied.from || undefined, date_to: applied.to || undefined },
      });
      setSummary(data);
    } catch (err) {
      console.error("summary error", err);
      setSummary(null);
    }
  }, [applied]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const refreshAll = () => {
    fetchList();
    fetchSummary();
    trend.reload();
  };

  const checkStatus = async (r: Row) => {
    if (!r.txn_id) return setError("No transaction ID available for this row.");
    setChecking((m) => ({ ...m, [r.id]: true }));
    setError(null);
    setInfo(null);
    try {
      const { data } = await api.post(CHECK_STATUS_URL, null, { params: { txn_id: r.txn_id } });
      const ps = String(data?.status || "").toUpperCase();
      const next = ps === "SUCCESS" ? "success" : ps === "FAILED" || ps === "FAILURE" ? "failed" : ps === "INPROGRESS" || ps === "PENDING" ? "InProgress" : r.status;
      setItems((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: next, utr: data?.utr || x.utr, txn_id: data?.txn_id || x.txn_id } : x)));
      setInfo(`Order ${r.order_id ?? r.id}: ${ps || "unknown"}${data?.utr ? ` · UTR ${data.utr}` : ""}`);
    } catch (err) {
      setError(errorText(err, "Failed to check status"));
    } finally {
      setChecking((m) => ({ ...m, [r.id]: false }));
    }
  };

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      const params = {
        status: applied.status || undefined,
        min_amount: applied.min || undefined,
        max_amount: applied.max || undefined,
        from_date: applied.from || undefined,
        to_date: applied.to || undefined,
        search: applied.search.trim() || undefined,
      };
      const res = await api.get(EXPORT_URL, { params, responseType: "blob" });
      const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      let filename = `passbook_${applied.from || "start"}_to_${applied.to || "end"}.xlsx`;
      const cd = res.headers["content-disposition"];
      const m = typeof cd === "string" ? cd.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i) : null;
      if (m?.[1]) {
        try {
          filename = decodeURIComponent(m[1]);
        } catch {
          filename = m[1];
        }
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorText(err, "Failed to download report"));
    } finally {
      setDownloading(false);
    }
  };

  const daily = trend.data?.daily ?? [];
  const scope = rangeText(summary?.date_from || range.from, summary?.date_to || range.to);
  const statusBadge = (s?: string | null) => (
    <StatusBadge status={s === "InProgress" ? "processing" : s}>{s === "InProgress" ? "In progress" : undefined}</StatusBadge>
  );
  const TH = "whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500";
  const TD = "whitespace-nowrap px-3 py-3 text-[13px] text-gray-700 dark:text-gray-300";
  const AMT = "whitespace-nowrap px-3 py-3 text-right text-[13px] tabular-nums";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <BookOpen className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Passbook</h1>
            <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Complete ledger of your payout wallet transactions and charges</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={download} disabled={downloading} className="h-11 rounded-xl px-4">
            {downloading ? <Loader2 className="animate-spin" /> : <Download />} Download Excel
          </Button>
          <Button variant="outline" onClick={refreshAll} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <TspStat
          label="Total Transactions"
          value={summary ? summary.total_txns.toLocaleString("en-IN") : "…"}
          icon={ArrowLeftRight}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={scope}
          trend={daily.map((d) => d.payout_total)}
          color="#3B6BF6"
        />
        <TspStat
          label="Total Volume"
          value={summary ? money0(summary.total_volume) : "…"}
          icon={BarChart3}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint="Payout debits"
          trend={daily.map((d) => d.payout_volume)}
          color="#22C55E"
        />
        <TspStat
          label="Total Charges"
          value={summary ? money0(summary.total_charges) : "…"}
          icon={Coins}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          hint="Incl. GST"
          trend={daily.map((d) => d.fees)}
          color="#F59E0B"
        />
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(draft);
        }}
        className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-4 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
      >
        <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className={filterInputCls} aria-label="Status">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="InProgress">In progress</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <input type="number" min={0} value={draft.min} onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))} placeholder="Min ₹" className={filterInputCls} aria-label="Min amount" />
        <input type="number" min={0} value={draft.max} onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))} placeholder="Max ₹" className={filterInputCls} aria-label="Max amount" />
        <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className={`${filterInputCls} dark:[color-scheme:dark]`} aria-label="From date" />
        <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className={`${filterInputCls} dark:[color-scheme:dark]`} aria-label="To date" />
        <input value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} placeholder="Order ID, Txn ID" className={filterInputCls} aria-label="Search" />
        <select value={draft.sort} onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))} className={filterInputCls} aria-label="Sort">
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="amount:desc">Amount: high</option>
          <option value="amount:asc">Amount: low</option>
          <option value="status:asc">By status</option>
        </select>
        <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-1">
          <Button type="submit" className="h-11 flex-1 rounded-xl px-5 xl:flex-none">Apply</Button>
          <Button type="button" variant="outline" onClick={() => { setDraft(EMPTY); setApplied(EMPTY); setPage(1); }} className="h-11 flex-1 rounded-xl px-4 xl:flex-none">
            Reset
          </Button>
        </div>
      </form>

      {(error || info) && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] ${
            error ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
          }`}
        >
          {error ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />} {error || info}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Transaction History</h2>
              <p className="text-[13px] text-gray-500">{items === null ? "Loading…" : `${total.toLocaleString("en-IN")} results`}</p>
            </div>
          </div>
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className={`${filterInputCls.replace("w-full", "w-auto")} h-10`} aria-label="Rows per page">
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
                <th className={`${TH} text-left`}>Date &amp; Time</th>
                <th className={`${TH} text-left`}>Order ID</th>
                <th className={`${TH} text-left`}>Txn ID</th>
                <th className={`${TH} text-left`}>UTR</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={`${TH} text-right`}>Charges</th>
                <th className={`${TH} text-right`}>GST</th>
                <th className={`${TH} text-right`}>Settle Amt</th>
                <th className={`${TH} text-left`}>Status</th>
                <th className={`${TH} text-left`}>Description</th>
                <th className={`${TH} sticky right-0 bg-slate-50 pr-5 text-center shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-gray-800`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items === null ? (
                <tr><td colSpan={12} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={12}><EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters" /></td></tr>
              ) : (
                items.map((r, i) => {
                  const canCheck = r.status === "pending" || r.status === "InProgress";
                  return (
                    <tr key={r.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className={`${TD} pl-5 text-gray-500`}>{(page - 1) * perPage + i + 1}</td>
                      <td className={TD}>{when(r.created_at)}</td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{r.order_id || "—"}</td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{r.txn_id || "—"}</td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{r.utr || "—"}</td>
                      <td className={`${AMT} font-semibold text-gray-900 dark:text-gray-100`}>{money0(r.amount)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(r.charges)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(r.gst)}</td>
                      <td className={`${AMT} text-gray-700 dark:text-gray-300`}>{money(r.settle_amount)}</td>
                      <td className={TD}>{statusBadge(r.status)}</td>
                      <td className={`${TD} max-w-[180px] truncate`} title={r.description ?? undefined}>{describe(r)}</td>
                      <td className="sticky right-0 bg-white px-3 py-2 pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setView(r)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-400"
                            aria-label={`View transaction ${r.id}`}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canCheck && (
                            <button
                              onClick={() => checkStatus(r)}
                              disabled={!!checking[r.id]}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                              aria-label={`Check status of ${r.order_id ?? r.id}`}
                              title="Check status with the payout provider"
                            >
                              <RefreshCw className={`h-4 w-4 ${checking[r.id] ? "animate-spin" : ""}`} />
                            </button>
                          )}
                        </div>
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
            <DialogDescription>{view?.order_id || `#${view?.id}`}</DialogDescription>
          </DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3">
              {([
                ["Status", statusBadge(view.status)],
                ["Credit / Debit", view.credit_debit || "—"],
                ["Channel", view.instrument_mode || "—"],
                ["Amount", money(view.amount)],
                ["Charges", money(view.charges)],
                ["GST", money(view.gst)],
                ["Settle Amount", money(view.settle_amount)],
                ["Balance After", money(view.balance_amount)],
                ["Date", view.created_at ? new Date(view.created_at).toLocaleString() : "—"],
                ["Txn ID", view.txn_id || "—"],
                ["UTR", view.utr || "—"],
                ["Reference", view.reference_id || "—"],
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
