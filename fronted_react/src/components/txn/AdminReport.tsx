// Admin Report — filtered transaction report with trend, status mix and CSV export
import { useCallback, useEffect, useState, type ReactNode } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight, CalendarCheck, CheckCircle2, Coins, Copy, Download, Eye, Filter, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { ActionMenu, EmptyState, StatusBadge } from "@/components/admin-part/ui";
import { useToast } from "@/hooks/use-toast";
import { TspStat } from "@/components/admin-part/tspShared";
import { avatarTone } from "@/components/admin-part/tspUtils";
import Pager from "@/components/admin-part/Pager";
import { DateRangeInput, FilterField, RangeToggle } from "@/components/admin-part/filterBits";
import { currentMonthRange, errorText, filterInputCls, fmtDateTimeParts, lastNDays, rangeText, spanDays } from "@/components/admin-part/listUtils";
import DashboardCharts, { MiniBars } from "@/components/txn/DashboardCharts";
import useAnalytics, { toChartData } from "@/components/txn/useAnalytics";
import { downloadReportCsv } from "@/components/txn/reportDownload";

type ReportItem = {
  id: number;
  user_id: string;
  transaction_type: string;
  credit_debit: string;
  order_id?: string | null;
  status?: string | null;
  amount: number;
  charges?: number | null;
  gst?: number | null;
  settle_amount?: number | null;
  balance_amount?: number | null;
  txn_id?: string | null;
  utr?: string | null;
  created_at?: string | null;
};

type ReportResponse = { total: number; page: number; per_page: number; items: ReportItem[] };
type MerchantOption = { id: string; username: string; company_name?: string | null };
type Filters = { merchant_id: string; transaction_type: string; status: string; date_from: string; date_to: string; search: string };

const initialFilters = (): Filters => {
  const m = currentMonthRange();
  return { merchant_id: "", transaction_type: "", status: "", date_from: m.from, date_to: m.to, search: "" };
};

const money = (v?: number | null) =>
  v === undefined || v === null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "+12.0% from yesterday" vs a baseline, or null. */
const vs = (cur: number, prev: number, what: string) => {
  if (!prev) return null;
  const pct = ((cur - prev) / prev) * 100;
  return { hint: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% from ${what}`, hintTone: (pct >= 0 ? "up" : "down") as "up" | "down" };
};

export default function AdminReport() {
  const { toast } = useToast();
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [view, setView] = useState<ReportItem | null>(null);

  // trend + status for the applied filters
  const analytics = useAnalytics({
    from_date: applied.date_from || undefined,
    to_date: applied.date_to || undefined,
    user_id: applied.merchant_id || undefined,
    transaction_type: applied.transaction_type || undefined,
    status: applied.status || undefined,
    search: applied.search || undefined,
  });
  // today / yesterday cards: last 7 days, same merchant & type
  const week = lastNDays(7);
  const recent = useAnalytics({
    from_date: week.from,
    to_date: week.to,
    user_id: applied.merchant_id || undefined,
    transaction_type: applied.transaction_type || undefined,
  });

  useEffect(() => {
    api
      .get(`${BASE_URL}/admin/merchants-list`)
      .then((res) => setMerchants(res.data as MerchantOption[]))
      .catch(() => setMerchants([]));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, per_page: perPage };
      (Object.keys(applied) as (keyof Filters)[]).forEach((k) => {
        if (applied[k]) params[k] = applied[k].trim();
      });
      const res = await api.get(`${BASE_URL}/admin/report`, { params });
      setData(res.data as ReportResponse);
    } catch (err) {
      setError(errorText(err, "Failed to load report"));
    } finally {
      setLoading(false);
    }
  }, [applied, page, perPage]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const refreshAll = () => {
    fetchReport();
    analytics.reload();
    recent.reload();
  };

  const apply = (f: Filters = draft) => {
    setPage(1);
    setApplied(f);
  };

  const handleDownload = async () => {
    setDlLoading(true);
    try {
      const { merchant_id, transaction_type, status, date_from, date_to } = applied;
      await downloadReportCsv({ merchant_id, transaction_type, status, date_from, date_to });
      toast({ title: "Downloaded", description: "Report CSV downloaded (up to 10,000 rows)" });
    } catch (err) {
      toast({ title: "Download Failed", description: errorText(err, "Error"), variant: "destructive" });
    } finally {
      setDlLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: text });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const merchantIdx = (id: string) => Math.max(0, merchants.findIndex((m) => m.id === id));

  // today = last element, yesterday = second last, day before = third last
  const days = recent.data?.daily ?? [];
  const at = (back: number) => days[days.length - 1 - back];
  const cnt = (d?: (typeof days)[number]) => (d ? d.payin_count + d.payout_count : 0);
  const vol = (d?: (typeof days)[number]) => (d ? d.payin_volume + d.payout_volume : 0);
  const ready = !!recent.data;

  const span = spanDays(applied.date_from, applied.date_to);
  const quick = span && applied.date_to === lastNDays(1).to && [7, 14, 30].includes(span) ? span : null;
  const label = quick ? `Last ${quick} days` : rangeText(applied.date_from, applied.date_to);
  const setQuick = (n: number) => {
    const r = lastNDays(n);
    const f = { ...draft, date_from: r.from, date_to: r.to };
    setDraft(f);
    apply(f);
  };

  const total = data?.total ?? 0;
  const startRow = data ? (data.page - 1) * data.per_page : 0;
  const TH = "whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500";
  const TD = "whitespace-nowrap px-3 py-3 text-[13px] text-gray-700 dark:text-gray-300";
  const MONO = "whitespace-nowrap px-3 py-3 font-mono text-[12px] text-gray-600 dark:text-gray-400";
  const AMT = "whitespace-nowrap px-3 py-3 text-right font-mono text-[12.5px] tabular-nums";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Report</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Admin transaction report with filters</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDownload} disabled={dlLoading} className="h-11 rounded-xl px-4">
            {dlLoading ? <Loader2 className="animate-spin" /> : <Download />} Download CSV
          </Button>
          <Button onClick={refreshAll} className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25">
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats — last 7 days bars */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Today Success"
          value={ready ? cnt(at(0)).toLocaleString("en-IN") : "…"}
          icon={CheckCircle2}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          {...(vs(cnt(at(0)), cnt(at(1)), "yesterday") ?? { hint: "Successful transactions today" })}
          chart={<MiniBars values={days.map(cnt)} color="#3B6BF6" className="h-12 w-20 flex-shrink-0" />}
        />
        <TspStat
          label="Today Volume"
          value={ready ? `₹${Math.round(vol(at(0))).toLocaleString("en-IN")}` : "…"}
          icon={ArrowUpRight}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          {...(vs(vol(at(0)), vol(at(1)), "yesterday") ?? { hint: "Successful volume today" })}
          chart={<MiniBars values={days.map(vol)} color="#8B5CF6" className="h-12 w-20 flex-shrink-0" />}
        />
        <TspStat
          label="Yesterday Success"
          value={ready ? cnt(at(1)).toLocaleString("en-IN") : "…"}
          icon={CalendarCheck}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          {...(vs(cnt(at(1)), cnt(at(2)), "previous day") ?? { hint: "Successful transactions" })}
          chart={<MiniBars values={days.slice(0, -1).map(cnt)} color="#22C55E" className="h-12 w-20 flex-shrink-0" />}
        />
        <TspStat
          label="Yesterday Volume"
          value={ready ? `₹${Math.round(vol(at(1))).toLocaleString("en-IN")}` : "…"}
          icon={Coins}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          {...(vs(vol(at(1)), vol(at(2)), "previous day") ?? { hint: "Successful volume" })}
          chart={<MiniBars values={days.slice(0, -1).map(vol)} color="#F59E0B" className="h-12 w-20 flex-shrink-0" />}
        />
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr_0.8fr_minmax(270px,1.4fr)_1.2fr_auto] xl:items-end"
      >
        <FilterField label="Merchant">
          <select value={draft.merchant_id} onChange={(e) => setDraft((d) => ({ ...d, merchant_id: e.target.value }))} className={filterInputCls}>
            <option value="">All Merchants</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.username}{m.company_name ? ` — ${m.company_name}` : ""}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Type">
          <select value={draft.transaction_type} onChange={(e) => setDraft((d) => ({ ...d, transaction_type: e.target.value }))} className={filterInputCls}>
            <option value="">All Types</option>
            <option value="PayIn">PayIn</option>
            <option value="PayOut">PayOut</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className={filterInputCls}>
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </FilterField>
        <FilterField label="Date Range">
          <DateRangeInput from={draft.date_from} to={draft.date_to} onChange={(date_from, date_to) => setDraft((d) => ({ ...d, date_from, date_to }))} />
        </FilterField>
        <FilterField label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} placeholder="Order ID, TXN ID, UTR..." className={`${filterInputCls} pl-10`} />
          </div>
        </FilterField>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <Button type="button" variant="outline" onClick={() => { const f = initialFilters(); setDraft(f); apply(f); }} className="h-11 flex-1 rounded-xl px-5 text-indigo-600 dark:text-indigo-400 xl:flex-none">
            Reset
          </Button>
          <Button type="submit" className="h-11 flex-1 rounded-xl px-5 xl:flex-none">
            <Filter /> Apply
          </Button>
        </div>
      </form>

      {/* Trend + status */}
      <DashboardCharts
        data={toChartData(analytics.data)}
        loading={analytics.loading}
        title="Transaction Trend"
        rangeLabel={label}
        statusSubtitle="Overall transaction distribution"
        headerRight={<RangeToggle value={quick} onChange={setQuick} />}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">Transactions</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Detailed transaction records</p>
          </div>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
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
                <th className={`${TH} text-left`}>Merchant</th>
                <th className={`${TH} text-left`}>Type</th>
                <th className={`${TH} text-left`}>Status</th>
                <th className={`${TH} text-left`}>Order ID</th>
                <th className={`${TH} text-left`}>Txn ID</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={`${TH} text-right`}>Charges</th>
                <th className={`${TH} text-right`}>GST</th>
                <th className={`${TH} text-right`}>Settle Amt</th>
                <th className={`${TH} text-left`}>UTR</th>
                <th className={`${TH} text-left`}>Created</th>
                <th className={`${TH} sticky right-0 bg-slate-50 pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-gray-800`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-[13px] text-red-600">
                    {error}
                    <Button variant="outline" onClick={fetchReport} className="ml-3">Retry</Button>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={13}><EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters" /></td>
                </tr>
              ) : (
                data.items.map((it, i) => {
                  const dt = fmtDateTimeParts(it.created_at);
                  return (
                    <tr key={it.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className={`${TD} pl-5 text-gray-500`}>{startRow + i + 1}</td>
                      <td className={TD}>
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${avatarTone(merchantIdx(it.user_id))}`}>
                            {(merchants.find((m) => m.id === it.user_id)?.username ?? it.user_id).charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{it.user_id}</span>
                        </div>
                      </td>
                      <td className={TD}><StatusBadge status={it.transaction_type} /></td>
                      <td className={TD}><StatusBadge status={it.status} /></td>
                      <td className={MONO}>{it.order_id || "—"}</td>
                      <td className={MONO}>{it.txn_id || "—"}</td>
                      <td className={`${AMT} font-semibold text-gray-900 dark:text-gray-100`}>{money(it.amount)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(it.charges)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(it.gst)}</td>
                      <td className={`${AMT} font-semibold text-gray-900 dark:text-gray-100`}>{money(it.settle_amount)}</td>
                      <td className={MONO}>{it.utr || "—"}</td>
                      <td className={TD}>{dt.day}, {dt.time}</td>
                      <td className="sticky right-0 bg-white px-3 py-2 pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800">
                        <ActionMenu
                          label={`Actions for transaction ${it.id}`}
                          items={[
                            { label: "View details", icon: Eye, onClick: () => setView(it) },
                            ...(it.txn_id ? [{ label: "Copy Txn ID", icon: Copy, onClick: () => copy(it.txn_id!) }] : []),
                            ...(it.utr ? [{ label: "Copy UTR", icon: Copy, onClick: () => copy(it.utr!) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data && total > 0 && <Pager page={data.page} perPage={data.per_page} total={total} noun="transactions" onPage={setPage} />}
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
                ["Merchant", view.user_id],
                ["Type", <StatusBadge key="t" status={view.transaction_type} />],
                ["Credit / Debit", <StatusBadge key="c" status={view.credit_debit} />],
                ["Status", <StatusBadge key="s" status={view.status} />],
                ["Amount", money(view.amount)],
                ["Charges", money(view.charges)],
                ["GST", money(view.gst)],
                ["Settle Amount", money(view.settle_amount)],
                ["Balance After", money(view.balance_amount)],
                ["Order ID", view.order_id || "—"],
                ["UTR", view.utr || "—"],
                ["Created", view.created_at ? new Date(view.created_at).toLocaleString() : "—"],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
