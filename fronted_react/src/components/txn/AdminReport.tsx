import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Download, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { EmptyState, PageHeader, Panel, StatusBadge, inputCls } from "@/components/admin-part/ui";
import { useToast } from "@/hooks/use-toast";

// --------------- types ---------------
type SummaryData = {
  today: { success_count: number; success_volume: number };
  yesterday: { success_count: number; success_volume: number };
};

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

type ReportResponse = {
  total: number;
  page: number;
  per_page: number;
  items: ReportItem[];
};

type MerchantOption = {
  id: string;
  username: string;
  company_name?: string | null;
};

// --------------- helpers ---------------
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const shortDate = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

function NumberOrDash(v?: number | null) {
  if (v === null || v === undefined) return "-";
  return v.toFixed(2);
}

// --------------- Pagination ---------------
function Pagination({
  total,
  page,
  per_page,
  onPage,
  onPerPage,
}: {
  total: number;
  page: number;
  per_page: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / per_page));
  const first = 1;
  const last = totalPages;
  const prev = Math.max(first, page - 1);
  const next = Math.min(last, page + 1);

  const pages = useMemo(() => {
    const pagesArr: number[] = [];
    const start = Math.max(first, page - 2);
    const end = Math.min(last, page + 2);
    for (let p = start; p <= end; p++) pagesArr.push(p);
    if (!pagesArr.includes(1)) pagesArr.unshift(1);
    if (!pagesArr.includes(last)) pagesArr.push(last);
    return pagesArr;
  }, [page, last]);

  const btn = "inline-flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2.5 text-[13px] font-medium disabled:opacity-50 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row">
      <div className="text-[13px] text-gray-500 dark:text-gray-400">
        Page <span className="font-medium text-gray-900 dark:text-gray-100">{page}</span> of{" "}
        <span className="font-medium text-gray-900 dark:text-gray-100">{totalPages}</span> · {total.toLocaleString("en-IN")} items
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
        <select
          value={per_page}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className={inputCls}
          aria-label="Rows per page"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <button className={btn} onClick={() => onPage(first)} disabled={page === first}>« First</button>
        <button className={btn} onClick={() => onPage(prev)} disabled={page === first}>‹ Prev</button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={p === page ? "inline-flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2.5 text-[13px] font-medium disabled:opacity-50 border-transparent bg-indigo-600 text-white" : btn}
          >
            {p}
          </button>
        ))}
        <button className={btn} onClick={() => onPage(next)} disabled={page === last}>Next ›</button>
        <button className={btn} onClick={() => onPage(last)} disabled={page === last}>Last »</button>
      </div>
    </div>
  );
}

// --------------- main component ---------------
export default function AdminReport() {
  const { toast } = useToast();

  // merchant list for dropdown
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);

  // summary stats
  const [summary, setSummary] = useState<SummaryData | null>(null);

  // filters
  const [merchantId, setMerchantId] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // pagination & data
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dlLoading, setDlLoading] = useState(false);

  // fetch merchants for dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`${BASE_URL}/admin/merchants-list`);
        setMerchants(res.data as MerchantOption[]);
      } catch { /* non-critical */ }
    })();
  }, []);

  // fetch summary
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`${BASE_URL}/admin/summary`);
        setSummary(res.data as SummaryData);
      } catch { /* non-critical */ }
    })();
  }, []);

  // fetch report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (merchantId) params.set("merchant_id", merchantId);
      if (transactionType) params.set("transaction_type", transactionType);
      if (status) params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (search) params.set("search", search);

      const res = await api.get(`${BASE_URL}/admin/report?${params.toString()}`);
      setData(res.data as ReportResponse);
    } catch (err: any) {
      setError(err?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, merchantId, transactionType, status, dateFrom, dateTo, search]);

  useEffect(() => { fetchReport(); }, [page, perPage]);

  const applyFilters = () => { setPage(1); fetchReport(); };
  const resetFilters = () => {
    setMerchantId(""); setTransactionType(""); setStatus("");
    setDateFrom(""); setDateTo(""); setSearch(""); setPage(1);
  };

  // Download the CSV for the current filters (no separate dialog)
  const handleDownload = async () => {
    setDlLoading(true);
    try {
      const params = new URLSearchParams();
      if (merchantId) params.set("merchant_id", merchantId);
      if (transactionType) params.set("transaction_type", transactionType);
      if (status) params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await api.get(`${BASE_URL}/admin/report/download?${params.toString()}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: "Downloaded", description: "Report CSV downloaded successfully" });
    } catch (err: any) {
      toast({ title: "Download Failed", description: err?.message || "Error", variant: "destructive" });
    } finally {
      setDlLoading(false);
    }
  };

  const merchantLabel = (id: string) => {
    const m = merchants.find((m) => m.id === id);
    return m ? `${m.username} (${m.id})` : id;
  };

  const TD = "px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-700 dark:text-gray-300";
  const MONO = "px-4 py-2.5 whitespace-nowrap font-mono text-[12px] text-gray-600 dark:text-gray-400";
  const AMT = "px-4 py-2.5 whitespace-nowrap text-right font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300";

  const stats = [
    { label: "Today success", value: summary ? summary.today.success_count.toLocaleString("en-IN") : "—" },
    { label: "Today volume", value: summary ? inr.format(summary.today.success_volume) : "—" },
    { label: "Yesterday success", value: summary ? summary.yesterday.success_count.toLocaleString("en-IN") : "—" },
    { label: "Yesterday volume", value: summary ? inr.format(summary.yesterday.success_volume) : "—" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Report"
        description="Admin transaction report with filters"
        actions={
          <>
            <Button variant="outline" onClick={handleDownload} disabled={dlLoading}>
              {dlLoading ? <Loader2 className="animate-spin" /> : <Download />} Download CSV
            </Button>
            <Button onClick={fetchReport}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {/* Compact stat row */}
      <div className="grid grid-cols-2 divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-4 md:divide-x">
        {stats.map((st) => (
          <div key={st.label} className="px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">{st.label}</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{st.value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              list="report-merchants"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value.trim())}
              placeholder="All merchants"
              className={`${inputCls} w-full pl-8`}
              aria-label="Merchant"
            />
            <datalist id="report-merchants">
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username}{m.company_name ? ` — ${m.company_name}` : ""}
                </option>
              ))}
            </datalist>
          </div>
          <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className={inputCls} aria-label="Transaction type">
            <option value="">All Types</option>
            <option value="PayIn">PayIn</option>
            <option value="PayOut">PayOut</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} aria-label="Status">
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} aria-label="Date from" title="Date from" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} aria-label="Date to" title="Date to" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ID, Txn ID, UTR" className={inputCls} aria-label="Search" />
          <div className="col-span-2 flex gap-2 md:col-span-3 xl:col-span-1">
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
            <Button onClick={applyFilters}>Apply</Button>
          </div>
        </div>
      </div>

      <Panel title="Transactions" meta={data ? `${data.total.toLocaleString("en-IN")} results` : undefined}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">ID</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Merchant</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Type</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Status</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Order ID</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Amount</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Charges</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">GST</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Settle Amt</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">UTR</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Txn ID</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={12} className="py-10 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-[13px] text-red-600">
                    {error}
                    <Button variant="outline" onClick={fetchReport} className="ml-3">Retry</Button>
                  </td>
                </tr>
              )}
              {!loading && !error && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters" />
                  </td>
                </tr>
              )}
              {!loading && !error && data && data.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className={MONO}>{item.id}</td>
                  <td className={`${TD} font-medium text-gray-900 dark:text-gray-100`}>{merchantLabel(item.user_id)}</td>
                  <td className={TD}><StatusBadge status={item.transaction_type} /></td>
                  <td className={TD}><StatusBadge status={item.status} /></td>
                  <td className={MONO}>{item.order_id ?? "-"}</td>
                  <td className={`${AMT} font-medium text-gray-900 dark:text-gray-100`}>{inr.format(item.amount)}</td>
                  <td className={AMT}>{NumberOrDash(item.charges)}</td>
                  <td className={AMT}>{NumberOrDash(item.gst)}</td>
                  <td className={AMT}>{NumberOrDash(item.settle_amount)}</td>
                  <td className={MONO}>{item.utr ?? "-"}</td>
                  <td className={MONO}>{item.txn_id ?? "-"}</td>
                  <td className={TD}>{shortDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          total={data?.total ?? 0}
          page={data?.page ?? page}
          per_page={data?.per_page ?? perPage}
          onPage={(p) => setPage(p)}
          onPerPage={(n) => { setPerPage(n); setPage(1); }}
        />
      </Panel>
    </div>
  );
}
