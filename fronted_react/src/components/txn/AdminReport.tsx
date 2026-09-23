import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
      <div className="text-sm text-gray-600">
        Page <strong className="text-[#3871C2]">{page}</strong> of{" "}
        <strong className="text-[#3871C2]">{totalPages}</strong> —{" "}
        <strong className="text-[#41B93D]">{total}</strong> items
      </div>
      <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2 w-full sm:w-auto">
        <select
          value={per_page}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm focus:border-[#3871C2] focus:outline-none"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <button className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50" onClick={() => onPage(first)} disabled={page === first}>« First</button>
        <button className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50" onClick={() => onPage(prev)} disabled={page === first}>‹ Prev</button>
        <div className="flex gap-1">
          {pages.map((p) => (
            <button key={p} onClick={() => onPage(p)}
              className={`px-3 py-2 border rounded-lg text-sm font-medium min-w-[40px] ${p === page ? "bg-[#3871C2] text-white border-transparent" : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}`}
            >{p}</button>
          ))}
        </div>
        <button className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50" onClick={() => onPage(next)} disabled={page === last}>Next ›</button>
        <button className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50" onClick={() => onPage(last)} disabled={page === last}>Last »</button>
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

  // download dialog
  const [dlOpen, setDlOpen] = useState(false);
  const [dlMerchant, setDlMerchant] = useState("");
  const [dlType, setDlType] = useState("");
  const [dlStatus, setDlStatus] = useState("");
  const [dlFrom, setDlFrom] = useState("");
  const [dlTo, setDlTo] = useState("");
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

  // download handler
  const openDownloadDialog = () => {
    setDlMerchant(merchantId);
    setDlType(transactionType);
    setDlStatus(status);
    setDlFrom(dateFrom);
    setDlTo(dateTo);
    setDlOpen(true);
  };

  const handleDownload = async () => {
    setDlLoading(true);
    try {
      const params = new URLSearchParams();
      if (dlMerchant) params.set("merchant_id", dlMerchant);
      if (dlType) params.set("transaction_type", dlType);
      if (dlStatus) params.set("status", dlStatus);
      if (dlFrom) params.set("date_from", dlFrom);
      if (dlTo) params.set("date_to", dlTo);

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
      setDlOpen(false);
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

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Transaction Report
              </h1>
              <p className="text-sm text-[var(--vp-text-secondary)] mt-2">Comprehensive admin transaction report with filters</p>
            </div>
            <div className="flex gap-2">
              <button onClick={openDownloadDialog}
                className="px-4 py-2.5 bg-gradient-to-r from-[#41B93D] to-emerald-500 text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download CSV
              </button>
              <button onClick={fetchReport}
                className="px-4 py-2.5 bg-gradient-to-r from-[#3871C2] to-[#00ADEF] text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button onClick={resetFilters}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-2">
                Reset
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-[#41B93D]">
              <div className="text-sm text-[var(--vp-text-secondary)]">Today Success Count</div>
              <div className="text-[22px] font-semibold text-[#41B93D] mt-1">{summary?.today?.success_count?.toLocaleString() ?? "0"}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-[#3871C2]">
              <div className="text-sm text-[var(--vp-text-secondary)]">Today Success Volume</div>
              <div className="text-[22px] font-semibold text-[#3871C2] mt-1">{inr.format(Number(summary?.today?.success_volume || 0))}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-[#00ADEF]">
              <div className="text-sm text-[var(--vp-text-secondary)]">Yesterday Success Count</div>
              <div className="text-[22px] font-semibold text-[#00ADEF] mt-1">{summary?.yesterday?.success_count?.toLocaleString() ?? "0"}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-[#F68713]">
              <div className="text-sm text-[var(--vp-text-secondary)]">Yesterday Success Volume</div>
              <div className="text-[22px] font-semibold text-[#F68713] mt-1">{inr.format(Number(summary?.yesterday?.success_volume || 0))}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Merchant</label>
              <select
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:ring-2 focus:ring-[#3871C2]/20 focus:outline-none"
              >
                <option value="">All Merchants</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.username}{m.company_name ? ` — ${m.company_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Transaction Type</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:ring-2 focus:ring-[#3871C2]/20 focus:outline-none">
                <option value="">All</option>
                <option value="PayIn">PayIn</option>
                <option value="PayOut">PayOut</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:ring-2 focus:ring-[#3871C2]/20 focus:outline-none">
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:ring-2 focus:ring-[#3871C2]/20 focus:outline-none" />
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:ring-2 focus:ring-[#3871C2]/20 focus:outline-none" />
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Search (order/txn/utr)</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="order id, txn id, utr"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:ring-2 focus:ring-[#3871C2]/20 focus:outline-none" />
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <button onClick={applyFilters}
              className="px-4 py-2.5 bg-gradient-to-r from-[#41B93D] to-emerald-500 text-white rounded-lg font-medium shadow-md flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Apply Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Merchant</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Order ID</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Charges</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">GST</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Settle Amt</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">UTR</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Txn ID</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={12} className="p-8 text-center text-gray-500">
                    <div className="w-12 h-9 border-4 border-[#3871C2]/20 border-t-[#3871C2] rounded-full animate-spin mx-auto mb-4"></div>
                    Loading report...
                  </td></tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={12} className="p-8 text-center text-red-600">
                    {error}
                    <button onClick={fetchReport} className="ml-4 px-3 py-1 bg-[#3871C2] text-white rounded text-sm">Retry</button>
                  </td></tr>
                )}
                {!loading && !error && data && data.items.length === 0 && (
                  <tr><td colSpan={12} className="p-8 text-center text-gray-500">No transactions found</td></tr>
                )}
                {!loading && !error && data && data.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono">{item.id}</td>
                    <td className="px-6 py-4 text-sm font-medium">{merchantLabel(item.user_id)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        item.transaction_type === "PayIn"
                          ? "bg-[#3871C2]/10 text-[#3871C2] border border-[#3871C2]/20"
                          : "bg-[#41B93D]/10 text-[#41B93D] border border-[#41B93D]/20"
                      }`}>{item.transaction_type}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        item.status === "success" ? "bg-[#41B93D]/10 text-[#41B93D]"
                          : item.status === "pending" ? "bg-[#F68713]/10 text-[#F68713]"
                          : "bg-red-100 text-red-600"
                      }`}>{item.status ?? "-"}</span>
                    </td>
                    <td className="px-6 py-4 text-sm"><div className="font-mono bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300">{item.order_id ?? "-"}</div></td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">{inr.format(item.amount)}</td>
                    <td className="px-6 py-4 text-sm text-[#F68713]">{NumberOrDash(item.charges)}</td>
                    <td className="px-6 py-4 text-sm text-[#F68713]">{NumberOrDash(item.gst)}</td>
                    <td className="px-6 py-4 text-sm text-[#41B93D] font-bold">{NumberOrDash(item.settle_amount)}</td>
                    <td className="px-6 py-4 text-sm"><div className="font-mono bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300">{item.utr ?? "-"}</div></td>
                    <td className="px-6 py-4 text-sm"><div className="font-mono bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300">{item.txn_id ?? "-"}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{shortDate(item.created_at)}</td>
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
        </div>
      </div>

      {/* Download Dialog */}
      {dlOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--vp-blue)' }}>Download Report CSV</h3>
            <p className="text-sm text-gray-500 mb-4">Select filters for the download. Max 10,000 rows.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Merchant</label>
                <select value={dlMerchant} onChange={(e) => setDlMerchant(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:outline-none">
                  <option value="">All Merchants</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>{m.username}{m.company_name ? ` — ${m.company_name}` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Transaction Type</label>
                  <select value={dlType} onChange={(e) => setDlType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:outline-none">
                    <option value="">All</option>
                    <option value="PayIn">PayIn</option>
                    <option value="PayOut">PayOut</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Status</label>
                  <select value={dlStatus} onChange={(e) => setDlStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:outline-none">
                    <option value="">All</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Date From</label>
                  <input type="date" value={dlFrom} onChange={(e) => setDlFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Date To</label>
                  <input type="date" value={dlTo} onChange={(e) => setDlTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#3871C2] focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button variant="outline" onClick={() => setDlOpen(false)} className="rounded-lg h-9">Cancel</Button>
              <Button onClick={handleDownload} disabled={dlLoading} className="rounded-lg h-9 text-white"
                style={{ background: "linear-gradient(135deg, #41B93D, #00ADEF)" }}>
                {dlLoading ? "Downloading..." : "Download CSV"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
