// src/components/Passbook.jsx
import React, { useEffect, useState, useCallback } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { PageHeader, StatCard, StatusBadge, inputCls } from "@/components/admin-part/ui";
import { Download, IndianRupee, Receipt, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
  Passbook / Wallet Transactions UI + Download report + Monthly summary
  - LIST_URL fetches transactions (existing)
  - EXPORT_URL downloads .xlsx (existing)
  - SUMMARY_URL calls /merchant/summary to get aggregated totals for the selected date range + status
  - Backend route: /mnt/data/merchant.py (merchant/summary)
*/

const API_BASE = `${BASE_URL}/merchant`;
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

  const CHECK_STATUS_URL = `${API_ORIGIN}/live/payout/status/zeepay`;
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

  const resetFilters = () => {
    setStatus("");
    setMinAmount("");
    setMaxAmount("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Passbook"
        description="Complete ledger of your wallet transactions and charges"
        actions={
          <>
            <Button variant="outline" onClick={handleDownloadReport} disabled={downloadLoading}>
              {downloadLoading ? <RefreshCw className="animate-spin" /> : <Download />} Download Excel
            </Button>
            <Button variant="outline" onClick={() => { setPage(1); fetchList(); fetchSummary(); }}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Txns" value={summaryLoading ? "…" : summary.total_txns.toLocaleString("en-IN")} icon={Receipt} />
        <StatCard label="Volume" value={summaryLoading ? "…" : `₹${fmt(summary.total_volume)}`} icon={Wallet} />
        <StatCard label="Charges" value={summaryLoading ? "…" : `₹${fmt(summary.total_charges)}`} icon={IndianRupee} hint="Incl. GST" />
      </div>

      {/* Filter row */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-[repeat(8,minmax(0,1fr))_auto]">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} aria-label="Status">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="InProgress">In progress</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min ₹" className={inputCls} aria-label="Min amount" />
          <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max ₹" className={inputCls} aria-label="Max amount" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} aria-label="From date" title="From date" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} aria-label="To date" title="To date" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ID, Txn ID, UTR" className={inputCls} aria-label="Search" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={inputCls} aria-label="Sort by">
            <option value="created_at">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="status">Sort: Status</option>
            <option value="order_id">Sort: Order ID</option>
          </select>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className={inputCls} aria-label="Sort direction">
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-1">
            <Button onClick={() => { setPage(1); fetchList(); fetchSummary(); }}>Apply</Button>
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
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
        <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex items-center text-green-600 dark:text-green-400">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {info}
          </div>
        </div>
      )}

      {/* Table Section */}
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">

  {/* Header */}
  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
    <div className="flex items-baseline gap-2">
      <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Transaction History</h3>
      <span className="text-[11px] text-gray-500">{loading ? "Loading..." : `${meta.total} results`}</span>
    </div>
    <label className="flex items-center gap-1.5 text-[12px] text-gray-500">
      Rows
      <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className={`${inputCls} px-2`}>
        {[10, 20, 50, 100].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  </div>

  {/* Responsive Table */}
  <div className="overflow-x-auto w-full">
    <table className="min-w-[900px] w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead className="bg-gray-50 dark:bg-gray-800/50">
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

      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {loading ? (
          <tr>
            <td colSpan={11} className="px-6 py-8 text-center">
              <div className="flex flex-col items-center justify-center">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600 mx-auto"
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
                  className="w-12 h-8 text-gray-400 mb-3"
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
            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-900 dark:text-gray-100">
                {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
              </td>

              <td className="px-4 py-2.5 whitespace-nowrap text-[13px] font-medium text-gray-900 dark:text-gray-100">
                {r.order_id || "-"}
              </td>

              <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[12px] text-gray-600 dark:text-gray-400">{r.txn_id || "-"}</td>

              <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[12px] text-gray-600 dark:text-gray-400 max-w-[140px] truncate" title={r.utr || ""}>{r.utr || "-"}</td>

              <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-right font-mono tabular-nums font-medium text-gray-900 dark:text-gray-100">
                ₹{fmt(r.amount)}
              </td>

              <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                ₹{fmt(r.charges)}
              </td>

              <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                ₹{fmt(r.gst)}
              </td>

              <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                ₹{fmt(r.settle_amount)}
              </td>

              <td className="px-4 py-2.5 whitespace-nowrap">
                <StatusBadge status={r.status === "InProgress" ? "processing" : r.status}>
                  {r.status === "InProgress" ? "In progress" : undefined}
                </StatusBadge>
              </td>

              <td className="px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{r.description || "-"}</td>

              <td className="px-4 py-2.5 whitespace-nowrap text-center">
                {r.status === "pending" || r.status === "InProgress" ? (
                  <button
                    onClick={() => handleCheckStatus(r)}
                    disabled={!!loadingCheckMap[r.order_id]}
                    title="Check status"
                    aria-label={`Check status of ${r.order_id || r.txn_id}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-indigo-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-indigo-400 dark:hover:bg-gray-800"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingCheckMap[r.order_id] ? "animate-spin" : ""}`} />
                  </button>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600">—</span>
                )}
              </td>

            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>

  {/* Pagination (Responsive) */}
  {!loading && items.length > 0 && (
    <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-800">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

        <div className="text-sm text-center sm:text-left text-gray-900 dark:text-gray-100">
          Showing{" "}
          <span className="font-semibold">
            {(page - 1) * perPage + 1}-{Math.min(page * perPage, meta.total)}
          </span>{" "}
          of <span className="font-semibold">{meta.total}</span> transactions
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* Page info */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm text-gray-900 dark:text-gray-100">Page</span>
            <span className="text-sm font-semibold">{page}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">of</span>
            <span className="text-sm font-semibold">{meta.total_pages}</span>
          </div>

          {/* Buttons */}
          <button
            onClick={() => changePage(1)}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-8 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-[13px] border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            disabled={page === 1}
           
          >
            « First
          </button>

          <button
            onClick={() => changePage(page - 1)}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-8 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-[13px] border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            disabled={page === 1}
           
          >
            ‹ Prev
          </button>

          <button
            onClick={() => changePage(page + 1)}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-8 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-[13px]"
            disabled={page >= meta.total_pages}
            style={{ borderColor: "#06B6D4", color: "#4F6BF6" }}
          >
            Next ›
          </button>

          <button
            onClick={() => changePage(meta.total_pages)}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-8 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-[13px]"
            disabled={page >= meta.total_pages}
            style={{ borderColor: "#06B6D4", color: "#4F6BF6" }}
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