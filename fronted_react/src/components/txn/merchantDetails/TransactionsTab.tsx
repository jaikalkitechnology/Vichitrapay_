import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, Download, FileText, IndianRupee, ListOrdered, Loader2, RefreshCw, Search, TrendingUp, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls, fmtDateTimeParts, lastNDays } from "@/components/admin-part/listUtils";
import { DateRangeInput, RangeToggle } from "@/components/admin-part/filterBits";
import Pager from "@/components/admin-part/Pager";
import { EmptyState, StatusBadge } from "@/components/admin-part/ui";
import { DailyTransactionsChart } from "@/components/txn/AnalyticsCharts";
import useAnalytics, { dayLabel } from "@/components/txn/useAnalytics";
import { fetchMerchantTxns, type WalletTxnPage } from "@/api/merchantAdmin";
import { MdBanner, MdStat } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, outlineBtn, primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import { inr, type MdCtx } from "@/components/txn/merchantDetails/mdTypes";

const PER_PAGE = 10;
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default function TransactionsTab({ ctx }: { ctx: MdCtx }) {
  const { toast } = useToast();
  const uid = ctx.user.id;
  const s = ctx.summary;
  const [days, setDays] = useState(7);
  const range = lastNDays(days);
  const { data: analytics, loading: chartLoading } = useAnalytics({ user_id: uid, from_date: range.from, to_date: range.to });

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WalletTxnPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const filters = { user_id: uid, search: q, from_date: from, to_date: to, status };
  const key = JSON.stringify(filters);
  const load = useCallback(() => {
    setError(null);
    fetchMerchantTxns({ ...JSON.parse(key), page, per_page: PER_PAGE })
      .then(setRows)
      .catch((e) => setError(errorText(e, "Failed to load transactions")));
  }, [key, page]);
  useEffect(load, [load]);

  const refresh = () => {
    load();
    ctx.reload();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchMerchantTxns({ ...filters, page: 1, per_page: 200 });
      const head = ["Txn ID", "Order ID", "Type", "Amount", "Charges", "GST", "Status", "Method", "UTR", "Created At"];
      const lines = all.items.map((t) => [t.txn_id, t.order_id, t.transaction_type, t.amount, t.charges, t.gst, t.status, t.instrument_mode, t.utr, t.created_at].map(csvCell).join(","));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
      a.download = `transactions-${uid}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (all.meta.total > all.items.length) toast({ title: `Exported the latest ${all.items.length} of ${all.meta.total}`, description: "Narrow the filters to export older transactions." });
    } catch (e) {
      toast({ title: "Export failed", description: errorText(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const points = (analytics?.daily ?? []).map((d) => ({ label: dayLabel(d.date), payin: d.payin_total, payout: d.payout_total }));
  const hasFilters = !!(search || from || to || status);

  return (
    <div className="space-y-4">
      <MdBanner
        icon={BarChart3}
        title="Transaction Dashboard"
        subtitle="All payment transactions of this merchant"
        right={
          <div className="flex gap-2">
            <button type="button" onClick={refresh} className={outlineBtn}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" onClick={exportCsv} disabled={exporting} className={primaryBtn}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MdStat icon={ListOrdered} tone="blue" label="Today's Transactions" value={s?.today.txns ?? "…"} sub={s && `Yesterday: ${s.yesterday.txns}`} />
        <MdStat icon={IndianRupee} tone="blue" label="Today's Volume" value={s ? inr(s.today.volume) : "…"} sub={s && `Yesterday: ${inr(s.yesterday.volume)}`} />
        <MdStat icon={CheckCircle2} tone="green" label="Today's Success" value={s?.today.success ?? "…"} sub={s && `Success rate: ${s.today.success_rate}%`} />
        <MdStat icon={XCircle} tone="red" label="Today's Failed / Pending" value={s ? `${s.today.failed} / ${s.today.pending}` : "…"} valueCls="text-red-600 dark:text-red-400" sub="Failed / Pending" />
        <MdStat icon={CalendarDays} tone="blue" label="This Month's Txns" value={s?.month.txns ?? "…"} sub={s && `Volume: ${inr(s.month.volume)}`} />
        <MdStat icon={TrendingUp} tone="green" label="Monthly Success Rate" value={s ? `${s.month.success_rate}%` : "…"} sub={s && `${s.month.success} successful of ${s.month.txns}`} />
        <MdStat icon={FileText} tone="blue" label="Overall Transactions" value={s?.overall.txns ?? "…"} sub="All time total" />
        <MdStat icon={IndianRupee} tone="blue" label="Overall Volume" value={s ? inr(s.overall.volume) : "…"} sub={s && `Success rate: ${s.overall.success_rate}%`} />
      </div>

      <div className="relative">
        <DailyTransactionsChart points={points} loading={chartLoading} subtitle={`Transactions per day · last ${days} days`} />
        <div className="absolute right-5 top-5">
          <RangeToggle value={days} onChange={setDays} />
        </div>
      </div>

      <div className={cn(mdCard, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40"><FileText className="h-5 w-5" /></span>
            <div>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Transaction List</h3>
              <p className="text-[12px] text-gray-500">{rows ? `${rows.meta.total} transaction${rows.meta.total === 1 ? "" : "s"}` : "Loading…"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, txn ID, UTR…" className={cn(filterInputCls, "pl-9")} />
            </div>
            <DateRangeInput from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={cn(filterInputCls, "w-auto")}>
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="InProgress">In progress</option>
              <option value="failed">Failed</option>
            </select>
            <button type="button" disabled={!hasFilters} onClick={() => { setSearch(""); setFrom(""); setTo(""); setStatus(""); setPage(1); }} className={outlineBtn}>Clear</button>
          </div>
        </div>
        {error ? (
          <p className="p-5 text-[13px] text-red-600">{error}</p>
        ) : !rows ? (
          <div className="flex items-center gap-2 p-5 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.items.length === 0 ? (
          <div className="p-6"><EmptyState icon={FileText} title="No Transactions Found" description={hasFilters ? "Nothing matches these filters." : "No transactions found for this merchant."} /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 [&>th]:px-4 [&>th]:py-3">
                    <th>#</th><th>Txn ID</th><th>Type</th><th>Amount</th><th>Status</th><th>Payment Method</th><th>Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800 [&>tr>td]:px-4 [&>tr>td]:py-3">
                  {rows.items.map((t, i) => {
                    const dt = fmtDateTimeParts(t.created_at);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="text-gray-500">{(page - 1) * PER_PAGE + i + 1}</td>
                        <td>
                          <div className="font-mono text-[12px] font-medium text-gray-900 dark:text-gray-100">{t.txn_id || "—"}</div>
                          <div className="font-mono text-[11px] text-gray-500">{t.order_id}</div>
                        </td>
                        <td><StatusBadge status={String(t.transaction_type)} /></td>
                        <td className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{inr(t.amount)}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td className="text-gray-700 dark:text-gray-300">{t.instrument_mode || "—"}</td>
                        <td className="whitespace-nowrap"><div className="text-gray-900 dark:text-gray-100">{dt.day}</div><div className="text-[12px] text-gray-500">{dt.time}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} perPage={PER_PAGE} total={rows.meta.total} noun="transactions" onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
