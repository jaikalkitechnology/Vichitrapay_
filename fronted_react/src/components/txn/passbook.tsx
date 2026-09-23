// src/components/Passbook.jsx
import React, { useEffect, useState, useCallback } from "react";
import api from "@/api/api";

/*
  Passbook / Wallet Transactions UI + Download report + Monthly summary
  - LIST_URL fetches transactions (existing)
  - EXPORT_URL downloads .xlsx (existing)
  - SUMMARY_URL calls /merchant/summary to get aggregated totals for the selected date range + status
  - Backend route: /mnt/data/merchant.py (merchant/summary)
*/

const API_BASE = "http://127.0.0.1:8000/api/v1/merchant";
const LIST_URL = `${API_BASE}/wallet-transactions`;
const EXPORT_URL = `${API_BASE}/payouts/export`;
const SUMMARY_URL = `${API_BASE}/merchant/summary`; // <-- new

// small util to format number
const fmt = (v) =>
  v == null ? "-" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function Passbook() {
  // table data + meta
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 20, total: 0, total_pages: 0 });

  // filters / sort
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [status, setStatus] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  // summary state
  const [summary, setSummary] = useState({
    total_txns: 0,
    total_volume: "0.00",
    total_charges: "0.00",
    date_from: null,
    date_to: null,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  // UX state
  const [loading, setLoading] = useState(false);
  const [loadingCheckMap, setLoadingCheckMap] = useState({}); // txnOrderId -> boolean
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const CHECK_STATUS_URL = "http://127.0.0.1:8000/live/payout/status/zeepay";
  const CHECK_STATUS = async (txnId) => {
    const { data } = await api.post(CHECK_STATUS_URL, null, { params: { txn_id: txnId } });
    return data;
  };

  // Build request params object (used by both list & summary)
  const buildParams = () => {
    return {
      page,
      per_page: perPage,
      status: status || undefined,
      min_amount: minAmount || undefined,
      max_amount: maxAmount || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      search: search || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
    };
  };

  // Forces date into YYYY-MM-DD regardless of timezone or input format
const toYMD = (v) => {
  if (!v) return undefined; // backend default month logic works
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return undefined;
  }
};


  // fetch summary (new)
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setError(null);
    try {
      // summary endpoint expects date_from/date_to/status (no pagination)
      const params = {
        status: status || undefined,
        date_from: toYMD(fromDate) || undefined,
        date_to: toYMD(toDate) || undefined,
      };
      const { data } = await api.get(SUMMARY_URL, { params });
      // backend returns total_volume/total_charges as decimal strings
      setSummary({
        total_txns: data.total_txns ?? 0,
        total_volume: data.total_volume ?? "0.00",
        total_charges: data.total_charges ?? "0.00",
        date_from: toYMD(data.date_from) ?? null,
        date_to: toYMD(data.date_to) ?? null,
      });
      //console.log("Fetched summary", data);
    } catch (err) {
      console.error("Summary error", err);
      setError(err?.response?.data?.detail || err.message || "Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [status, fromDate, toDate]);

  // fetch list
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const { data } = await api.get(LIST_URL, { params });
      setItems(data.items || []);
      setMeta(data.meta || { page: 1, per_page: perPage, total: 0, total_pages: 0 });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, status, minAmount, maxAmount, fromDate, toDate, search, sortBy, sortDir]);

  // call both when filters change / page changes
  useEffect(() => {
    fetchList();
    fetchSummary();
  }, [fetchList, fetchSummary]);

  // Reset page when certain filters change (so user sees page 1 results)
  useEffect(() => {
    setPage(1);
  }, [status, minAmount, maxAmount, fromDate, toDate, search, perPage]);

  // check status action — only for pending/InProgress txns
  const handleCheckStatus = async (row) => {
    const txnId = row.txn_id;
    if (!txnId) {
      setError("No transaction ID available for this row.");
      return;
    }
    setLoadingCheckMap((m) => ({ ...m, [row.order_id]: true }));
    setError(null);
    setInfo(null);

    try {
      const result = await CHECK_STATUS(txnId);
      const providerStatus = (result?.status || "").toUpperCase();
      const utr = result?.utr || row.utr;

      let uiStatus = row.status;
      if (providerStatus === "SUCCESS") uiStatus = "success";
      else if (providerStatus === "FAILED" || providerStatus === "FAILURE") uiStatus = "failed";
      else if (providerStatus === "INPROGRESS" || providerStatus === "PENDING") uiStatus = "InProgress";

      setItems((prev) =>
        prev.map((r) =>
          r.order_id === row.order_id
            ? { ...r, status: uiStatus, utr: utr || r.utr, txn_id: result?.txn_id || r.txn_id }
            : r
        )
      );

      setInfo(`Status: ${providerStatus}${utr ? ` | UTR: ${utr}` : ""}`);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to check status");
    } finally {
      setLoadingCheckMap((m) => ({ ...m, [row.order_id]: false }));
    }
  };

  // change page handler
  const changePage = (p) => {
    if (p < 1 || p > meta.total_pages) return;
    setPage(p);
  };

  // Download report (xlsx) using current filters
  const handleDownloadReport = async () => {
    setError(null);
    setInfo(null);
    setDownloadLoading(true);
    try {
      const params = {
        status: status || undefined,
        min_amount: minAmount || undefined,
        max_amount: maxAmount || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: search || undefined,
      };

      const res = await api.get(EXPORT_URL, { params, responseType: "blob" });

      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      let filename = `payouts_${fromDate || "start"}_to_${toDate || "end"}.xlsx`;
      const cd = res.headers["content-disposition"] || res.headers["Content-Disposition"];
      if (cd) {
        const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
        if (m && m[1]) {
          try {
            filename = decodeURIComponent(m[1]);
          } catch (e) {
            filename = m[1];
          }
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

      setInfo(`Download started: ${filename}`);
    } catch (err) {
      console.error("Download error", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to download report";
      setError(msg);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Wallet Transactions Passbook</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage all your transaction history</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPage(1); fetchList(); fetchSummary(); }}
            className="px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 transition-colors"
            style={{ borderColor: '#00ADEF' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh All
          </button>
        </div>
      </div>

      {/* SUMMARY CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#3871C2]">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-[#F0F9FF] dark:bg-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="#3871C2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#3871C2' }}>
                {summaryLoading ? (
                  <span className="inline-block h-6 w-16 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  summary.total_txns.toLocaleString()
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#41B93D]">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-[#F0FDF4] dark:bg-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="#41B93D" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Volume</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#3871C2' }}>
                {summaryLoading ? (
                  <span className="inline-block h-6 w-24 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  `₹${fmt(summary.total_volume)}`
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#F68713]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[#FEF2F2] dark:bg-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="#F68713" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Charges (incl. GST)</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#3871C2' }}>
                  {summaryLoading ? (
                    <span className="inline-block h-6 w-20 bg-gray-200 animate-pulse rounded"></span>
                  ) : (
                    `₹${fmt(summary.total_charges)}`
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchSummary()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              disabled={summaryLoading}
              style={{ 
                backgroundColor: summaryLoading ? '#CBD5E1' : '#3871C2',
                color: 'white'
              }}
            >
              {summaryLoading ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading
                </span>
              ) : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
     <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filter Transactions</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Apply filters to find specific transactions</p>
  </div>

  {/* FORM GRID — FULLY RESPONSIVE */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

    {/* Status */}
    <div>
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none transition"
      >
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="InProgress">InProgress</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
      </select>
    </div>

    {/* Min Amount */}
    <div>
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Min Amount</label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">₹</span>
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          className="pl-10 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none transition"
          placeholder="Minimum"
        />
      </div>
    </div>

    {/* Max Amount */}
    <div>
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Max Amount</label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">₹</span>
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          className="pl-10 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none transition"
          placeholder="Maximum"
        />
      </div>
    </div>

    {/* DATE RANGE — STACKS ON MOBILE */}
    <div>
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Date Range</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-full sm:w-1/2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none transition"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-full sm:w-1/2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none transition"
        />
      </div>
    </div>

    {/* SEARCH FIELD — FULL WIDTH ALWAYS */}
    <div className="sm:col-span-2 md:col-span-2">
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Search</label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 focus:outline-none transition"
        placeholder="Search by Order ID, Transaction ID or Description..."
      />
    </div>

    {/* ACTION BUTTONS — PERFECT MOBILE + DESKTOP */}
    <div className="col-span-1 sm:col-span-2 md:col-span-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <button
          onClick={() => { setPage(1); fetchList(); fetchSummary(); }}
          className="px-5 h-9 rounded-lg font-medium transition-colors flex-1 whitespace-nowrap bg-[#3871C2] text-white hover:bg-[#2d5ea0]"
        >
          Apply Filters
        </button>

        <button
          onClick={() => {
            setStatus("");
            setMinAmount("");
            setMaxAmount("");
            setFromDate("");
            setToDate("");
            setSearch("");
            setPage(1);
          }}
          className="px-5 h-9 border border-gray-200 dark:border-gray-600 rounded-lg font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-1 whitespace-nowrap"
        >
          Reset
        </button>
      </div>
    </div>

    {/* FOOTER FILTERS — FULLY RESPONSIVE */}
    <div className="md:col-span-4 flex flex-col lg:flex-row flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      
      {/* LEFT SIDE OPTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">

        {/* SHOW ROWS */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap text-gray-700 dark:text-gray-300">Show:</label>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} rows</option>
            ))}
          </select>
        </div>

        {/* SORTING */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm font-medium whitespace-nowrap text-gray-700 dark:text-gray-300">Sort by:</label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none"
          >
            <option value="created_at">Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
            <option value="order_id">Order ID</option>
          </select>

          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* DOWNLOAD BUTTON (RIGHT SIDE) */}
      <button
        onClick={handleDownloadReport}
        disabled={downloadLoading}
        className="px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all whitespace-nowrap"
        style={{
          background: downloadLoading ? "#CBD5E1" : "linear-gradient(135deg, #41B93D, #2E8B29)",
          color: "white",
        }}
      >
        {downloadLoading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Preparing Report...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Excel Report
          </>
        )}
      </button>
    </div>
  </div>
</div>


      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#FEF2F2', borderColor: '#F68713' }}>
          <div className="flex items-center text-red-700">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Error:</span>
            <span className="ml-2">{String(error)}</span>
          </div>
        </div>
      )}
      
      {info && (
        <div className="p-4 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#41B93D' }}>
          <div className="flex items-center" style={{ color: '#41B93D' }}>
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {info}
          </div>
        </div>
      )}

      {/* Table Section */}
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">

  {/* Header */}
  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transaction History</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
      {loading ? "Loading transactions..." : `${meta.total} transactions found`}
    </p>
  </div>

  {/* Responsive Table */}
  <div className="overflow-x-auto w-full">
    <table className="min-w-[900px] w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead className="bg-gray-50 dark:bg-gray-900">
        <tr>
          {[
            "Date",
            "Order ID",
            "Txn ID",
            "UTR",
            "Amount",
            "Charges",
            "GST",
            "Settle",
            "Status",
            "Description",
            "Actions",
          ].map((col) => (
            <th
              key={col}
              className={`px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${
                col === "Amount" || col === "Charges" || col === "GST" || col === "Settle"
                  ? "text-right"
                  : col === "Actions"
                  ? "text-center"
                  : "text-left"
              }`}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {loading ? (
          <tr>
            <td colSpan={11} className="px-6 py-8 text-center">
              <div className="flex flex-col items-center justify-center">
                <div
                  className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
                  style={{ borderColor: "#3871C2" }}
                ></div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">Loading transactions...</p>
              </div>
            </td>
          </tr>
        ) : items.length === 0 ? (
          <tr>
            <td colSpan={11} className="px-6 py-8 text-center">
              <div className="flex flex-col items-center justify-center">
                <svg
                  className="w-12 h-9 text-gray-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 font-medium">No transactions found</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try adjusting your filters</p>
              </div>
            </td>
          </tr>
        ) : (
          items.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: "#3871C2" }}>
                {r.order_id || "-"}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{r.txn_id || "-"}</td>

              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{r.utr || "-"}</td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold" style={{ color: "#3871C2" }}>
                ₹{fmt(r.amount)}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                ₹{fmt(r.charges)}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                ₹{fmt(r.gst)}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold" style={{ color: "#41B93D" }}>
                ₹{fmt(r.settle_amount)}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "success"
                      ? "bg-green-100 text-green-800"
                      : r.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : r.status === "InProgress"
                      ? "bg-yellow-100 text-yellow-800"
                      : r.status === "pending"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {r.status}
                </span>
              </td>

              <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{r.description || "-"}</td>

              <td className="px-6 py-4 whitespace-nowrap text-center">
                <div className="flex flex-wrap justify-center items-center gap-2">

                  {(r.status === "pending" || r.status === "InProgress") ? (
                    <button
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                      onClick={() => handleCheckStatus(r)}
                      disabled={!!loadingCheckMap[r.order_id]}
                      style={{
                        backgroundColor: loadingCheckMap[r.order_id] ? "#CBD5E1" : "#3871C2",
                        color: "white",
                      }}
                    >
                      {loadingCheckMap[r.order_id] ? (
                        <>
                          <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Checking...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Check Status
                        </>
                      )}
                    </button>
                  ) : r.status === "success" ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Completed
                    </span>
                  ) : r.status === "failed" ? (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700">
                      Failed
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}

                </div>
              </td>

            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>

  {/* Pagination (Responsive) */}
  {!loading && items.length > 0 && (
    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

        <div className="text-sm text-center sm:text-left" style={{ color: "#3871C2" }}>
          Showing{" "}
          <span className="font-semibold">
            {(page - 1) * perPage + 1}-{Math.min(page * perPage, meta.total)}
          </span>{" "}
          of <span className="font-semibold">{meta.total}</span> transactions
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* Page info */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm" style={{ color: "#3871C2" }}>Page</span>
            <span className="text-sm font-semibold">{page}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">of</span>
            <span className="text-sm font-semibold">{meta.total_pages}</span>
          </div>

          {/* Buttons */}
          <button
            onClick={() => changePage(1)}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            disabled={page === 1}
            style={{ borderColor: "#00ADEF", color: "#3871C2" }}
          >
            « First
          </button>

          <button
            onClick={() => changePage(page - 1)}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            disabled={page === 1}
            style={{ borderColor: "#00ADEF", color: "#3871C2" }}
          >
            ‹ Prev
          </button>

          <button
            onClick={() => changePage(page + 1)}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            disabled={page >= meta.total_pages}
            style={{ borderColor: "#00ADEF", color: "#3871C2" }}
          >
            Next ›
          </button>

          <button
            onClick={() => changePage(meta.total_pages)}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            disabled={page >= meta.total_pages}
            style={{ borderColor: "#00ADEF", color: "#3871C2" }}
          >
            Last »
          </button>
        </div>

      </div>
    </div>
  )}
</div>

    </div>
  );
}