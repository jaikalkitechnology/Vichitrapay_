// src/pages/transactions/index.tsx
import React, { useCallback, useEffect, useState } from "react";
import useMerchantTransactions from "@/hooks/useMerchantTransactions";
import { fetchUsersWithWallets } from "@/api/apiHelper";
import { useToast } from "@/hooks/use-toast";
import api from "@/api/api"; // ensure this exists and is the axios instance you use
import type { PaginatedUsersWithWallets } from "@/api/apiHelper";

function toYMD(v?: string | null): string | undefined {
  if (!v) return undefined;
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
}

function fmtINR(v: number | string | undefined | null) {
  if (v === undefined || v === null) return "-";
  const n = typeof v === "number" ? v : Number(v || 0);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function MerchantTransactionsPage() {
  const API_BASE = "http://127.0.0.1:8000/api/v1/admin";
  const { toast } = useToast();
  const {
    query, data, loading, error,
    setPage, setPerPage, setSort, setFilter, refresh
  } = useMerchantTransactions({ page: 1, per_page: 50, sort_by: "created_at", sort_dir: "desc" });

  const [merchantList, setMerchantList] = useState<PaginatedUsersWithWallets | null>(null);
  const [selectMerchant, setSelectMerchant] = useState<string>("");

  // SUMMARY state
  const [summary, setSummary] = useState({
    total_txns: 0,
    total_volume: "0.00",
    total_charges: "0.00",
    date_from: null as string | null,
    date_to: null as string | null,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  // load merchants once
  useEffect(() => {
    fetchUsersWithWallets({ page: 1, per_page: 200 }).then(setMerchantList).catch((e) => {
      toast({ title: "Failed to load users", description: e?.message ?? "Unknown" });
    });
  }, [toast]);

  // when merchant select changes, update filter (only send user_id when non-empty)
  useEffect(() => {
    setFilter({ user_id: selectMerchant || undefined, page: 1 });
  }, [selectMerchant, setFilter]);

  const applyFilters = useCallback(() => {
    // you can collect other filter state and call setFilter(...) here
    setFilter({ page: 1 });
  }, [setFilter]);

  const resetFilters = useCallback(() => {
    setSelectMerchant("");
    setFilter({
      user_id: undefined,
      status: undefined,
      min_amount: undefined,
      max_amount: undefined,
      from_date: undefined,
      to_date: undefined,
      search: undefined,
      page: 1,
    });
  }, [setFilter]);

  // action loading map
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const handleMarkStatus = async (txnId: number, action: "mark-failed" | "mark-success") => {
    if (!window.confirm(`Are you sure you want to ${action === "mark-failed" ? "MARK FAILED" : "MARK SUCCESS"} txn #${txnId}? This will adjust the merchant wallet.`)) return;
    setActionLoading(m => ({ ...m, [txnId]: true }));
    try {
      const res = await api.post(`${API_BASE}/txn/${txnId}/${action}`);
      toast({ title: "Updated", description: res.data?.message || "Status changed" });
      refresh();
      fetchAdminSummary();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.response?.data?.detail || err?.message || "Error" });
    } finally {
      setActionLoading(m => ({ ...m, [txnId]: false }));
    }
  };

  // fetch summary (admin route)
  const fetchAdminSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params: Record<string, any> = {
        date_from: toYMD(query.from_date),
        date_to: toYMD(query.to_date),
        status: "success",
      };
      if (selectMerchant) params.merchant_id = selectMerchant;

      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);

      const res = await api.get(`${API_BASE}/admin/summary`, { params });
      const d = res.data || {};

      const total_txns = Number(d.total_txns ?? d.total ?? 0) || 0;
      const total_volume = (Number(d.total_volume ?? d.volume ?? 0) || 0).toFixed(2);
      const total_charges = (Number(d.total_charges ?? d.charges ?? 0) || 0).toFixed(2);

      setSummary({
        total_txns,
        total_volume,
        total_charges,
        date_from: d.date_from ?? null,
        date_to: d.date_to ?? null,
      });
    } catch (err: any) {
      console.error("admin summary fetch error", err);
    } finally {
      setSummaryLoading(false);
    }
  }, [selectMerchant, query.from_date, query.to_date]);

  // fetch summary whenever selected merchant or date range changes or when refresh() is called
  useEffect(() => {
    fetchAdminSummary();
  }, [fetchAdminSummary, refresh]);

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Transaction Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Monitor and analyze all merchant transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => resetFilters()} 
              className="px-4 h-9 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Reset Filters
            </button>
            <button
              onClick={() => { refresh(); fetchAdminSummary(); }}
              className="px-4 h-9 rounded-lg font-medium bg-[#3871C2] text-white hover:bg-[#2d5ea0] transition-colors"
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh All
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#3871C2]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
                <p className="text-2xl font-bold mt-2" style={{ color: '#3871C2' }}>
                  {summaryLoading ? (
                    <span className="inline-block h-8 w-24 bg-gray-200 animate-pulse rounded"></span>
                  ) : (
                    summary.total_txns.toLocaleString()
                  )}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{summary.date_from || "Any"} to {summary.date_to || "Any"}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-full bg-[#F0F9FF] dark:bg-gray-700">
                <svg className="w-6 h-6" style={{ color: '#3871C2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#41B93D]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Volume</p>
                <p className="text-2xl font-bold mt-2" style={{ color: '#41B93D' }}>
                  {summaryLoading ? (
                    <span className="inline-block h-8 w-32 bg-gray-200 animate-pulse rounded"></span>
                  ) : (
                    `₹${fmtINR(summary.total_volume)}`
                  )}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Transaction value</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-full bg-[#F0FDF4] dark:bg-gray-700">
                <svg className="w-6 h-6" style={{ color: '#41B93D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#F68713]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Charges (incl. GST)</p>
                <p className="text-2xl font-bold mt-2" style={{ color: '#F68713' }}>
                  {summaryLoading ? (
                    <span className="inline-block h-8 w-28 bg-gray-200 animate-pulse rounded"></span>
                  ) : (
                    `₹${fmtINR(summary.total_charges)}`
                  )}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Fees and taxes</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchAdminSummary()}
                  disabled={summaryLoading}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
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
                <div className="p-3 rounded-full bg-[#FFF7ED] dark:bg-gray-700">
                  <svg className="w-6 h-6" style={{ color: '#F68713' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transaction Filters</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Filter transactions by merchant, date range, or search criteria</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {selectMerchant ? 'Merchant Selected' : 'All Merchants'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            {/* Merchant Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Merchant</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <select
                  value={selectMerchant}
                  onChange={(e) => setSelectMerchant(e.target.value)}
                  className="pl-10 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                >
                  <option value="">All Merchants</option>
                  {(merchantList?.items ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  value={query.search ?? ""}
                  onChange={(e) => setFilter({ search: e.target.value || undefined })}
                  placeholder="Order ID, Txn ID, Description"
                  className="pl-10 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                />
              </div>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="date"
                  value={query.from_date ?? ""}
                  onChange={(e) => setFilter({ from_date: e.target.value || undefined })}
                  className="pl-10 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                />
              </div>
            </div>

            {/* To Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="date"
                  value={query.to_date ?? ""}
                  onChange={(e) => setFilter({ to_date: e.target.value || undefined })}
                  className="pl-10 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={query.status ?? ""}
                onChange={(e) => setFilter({ status: e.target.value || undefined, page: 1 })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
              >
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
              <select
                value={query.transaction_type ?? ""}
                onChange={(e) => setFilter({ transaction_type: e.target.value || undefined, page: 1 })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
              >
                <option value="">All Types</option>
                <option value="PayIn">PayIn</option>
                <option value="PayOut">PayOut</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show:</label>
                <select
                  value={query.per_page}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} rows
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {data && (
                  <span>
                    Showing {((data.page - 1) * data.per_page) + 1} - {Math.min(data.page * data.per_page, data.total)} of {data.total} transactions
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { resetFilters(); }}
                className="px-5 h-9 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Reset Filters
              </button>
              <button
                onClick={() => { applyFilters(); fetchAdminSummary(); }}
                className="px-5 h-9 rounded-lg font-medium bg-[#41B93D] text-white hover:bg-[#379e34] transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transaction History</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {loading ? 'Loading transactions...' : data ? `${data.total} transactions found` : 'No data'}
                </p>
              </div>
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-700">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <button onClick={() => setSort("id", query.sort_dir === "asc" ? "desc" : "asc")} className="flex items-center gap-1">
                      ID
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <button onClick={() => setSort("user_id", query.sort_dir === "asc" ? "desc" : "asc")} className="flex items-center gap-1">
                      Merchant
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">C/D</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Order ID</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Txn ID</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Settle</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Charges</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">GST</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Instrument</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">API</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <button onClick={() => setSort("status", query.sort_dir === "asc" ? "desc" : "asc")} className="flex items-center gap-1">
                      Status
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ref ID</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <button onClick={() => setSort("created_at", query.sort_dir === "asc" ? "desc" : "asc")} className="flex items-center gap-1">
                      Created
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={18} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" style={{ borderColor: '#3871C2' }}></div>
                        <p className="mt-3 text-gray-600 dark:text-gray-400">Loading transactions...</p>
                      </div>
                    </td>
                  </tr>
                ) : !loading && error ? (
                  <tr>
                    <td colSpan={18} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="inline-flex items-center justify-center w-12 h-9 rounded-full bg-red-100 mb-4">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 font-medium">{error}</p>
                      </div>
                    </td>
                  </tr>
                ) : data && data.items.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-12 h-9 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-gray-600 dark:text-gray-400 font-medium">No transactions found</p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : data?.items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#3871C2' }}>
                      {it.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {it.user_id ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {it.transaction_type ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        it.credit_debit === 'credit' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {it.credit_debit ?? "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">
                      {it.order_id ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">
                      {it.txn_id ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold" style={{ color: '#3871C2' }}>
                      ₹{it.amount?.toFixed(2) ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold" style={{ color: '#41B93D' }}>
                      {it.settle_amount ? `₹${it.settle_amount.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                      {it.charges ? `₹${it.charges.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                      {it.gst ? `₹${it.gst.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {it.instrument_mode ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {it.api_name ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        it.status === "success"
                          ? "bg-green-100 text-green-800"
                          : it.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {it.status ?? "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">
                      {it.reference_id ?? "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {it.created_at
                        ? new Date(it.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {it.status === "success" ? (
                        <button
                          onClick={() => handleMarkStatus(it.id, "mark-failed")}
                          disabled={!!actionLoading[it.id]}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {actionLoading[it.id] ? "..." : "Mark Failed"}
                        </button>
                      ) : it.status === "failed" ? (
                        <button
                          onClick={() => handleMarkStatus(it.id, "mark-success")}
                          disabled={!!actionLoading[it.id]}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-green-300 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                          {actionLoading[it.id] ? "..." : "Mark Success"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm" style={{ color: '#3871C2' }}>
                  Showing <span className="font-semibold">{((data.page - 1) * data.per_page) + 1}</span> to{" "}
                  <span className="font-semibold">{Math.min(data.page * data.per_page, data.total)}</span> of{" "}
                  <span className="font-semibold">{data.total}</span> transactions
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={data.page === 1}
                      style={{ borderColor: '#00ADEF', color: '#3871C2' }}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, data.page - 1))}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={data.page === 1}
                      style={{ borderColor: '#00ADEF', color: '#3871C2' }}
                    >
                      Previous
                    </button>
                    <div className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                      Page {data.page} of {data.total_pages}
                    </div>
                    <button
                      onClick={() => setPage(data.page + 1)}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={data.page >= data.total_pages}
                      style={{ borderColor: '#00ADEF', color: '#3871C2' }}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setPage(data.total_pages)}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={data.page >= data.total_pages}
                      style={{ borderColor: '#00ADEF', color: '#3871C2' }}
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}