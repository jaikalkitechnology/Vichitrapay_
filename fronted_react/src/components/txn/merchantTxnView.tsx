// src/pages/transactions/index.tsx
import React, { useCallback, useEffect, useState } from "react";
import useMerchantTransactions from "@/hooks/useMerchantTransactions";
import { fetchUsersWithWallets } from "@/api/apiHelper";
import { useToast } from "@/hooks/use-toast";
import api from "@/api/api"; // ensure this exists and is the axios instance you use
import type { PaginatedUsersWithWallets } from "@/api/apiHelper";
import { AlertCircle, ArrowUpDown, CheckCircle2, Inbox, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMenu, EmptyState, PageHeader, Panel, StatusBadge, inputCls } from "@/components/admin-part/ui";

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

  const sortBtn = (field: string, label: string) => (
    <button onClick={() => setSort(field, query.sort_dir === "asc" ? "desc" : "asc")} className="inline-flex items-center gap-1 uppercase">
      {label}
      {query.sort_by === field && <ArrowUpDown className="h-3 w-3" />}
    </button>
  );
  const TH = "px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap";
  const TD = "px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-700 dark:text-gray-300";
  const MONO = "px-4 py-2.5 whitespace-nowrap font-mono text-[12px] text-gray-600 dark:text-gray-400";
  const AMT = "px-4 py-2.5 whitespace-nowrap text-right font-mono text-[13px] tabular-nums";
  const money = (v?: number | null) => (v ? `₹${fmtINR(v)}` : "-");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transactions"
        description="All merchant PayIn and PayOut transactions"
        actions={
          <Button onClick={() => { refresh(); fetchAdminSummary(); }}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      {/* Filter bar — single row */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
          <select value={selectMerchant} onChange={(e) => setSelectMerchant(e.target.value)} className={inputCls} aria-label="Merchant">
            <option value="">All Merchants</option>
            {(merchantList?.items ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.username}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={query.search ?? ""}
              onChange={(e) => setFilter({ search: e.target.value || undefined })}
              placeholder="Order ID, Txn ID..."
              className={`${inputCls} w-full pl-8`}
              aria-label="Search"
            />
          </div>
          <input type="date" value={query.from_date ?? ""} onChange={(e) => setFilter({ from_date: e.target.value || undefined })} className={inputCls} aria-label="From date" title="From date" />
          <input type="date" value={query.to_date ?? ""} onChange={(e) => setFilter({ to_date: e.target.value || undefined })} className={inputCls} aria-label="To date" title="To date" />
          <select value={query.status ?? ""} onChange={(e) => setFilter({ status: e.target.value || undefined, page: 1 })} className={inputCls} aria-label="Status">
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select value={query.transaction_type ?? ""} onChange={(e) => setFilter({ transaction_type: e.target.value || undefined, page: 1 })} className={inputCls} aria-label="Type">
            <option value="">All Types</option>
            <option value="PayIn">PayIn</option>
            <option value="PayOut">PayOut</option>
          </select>
          <div className="col-span-2 flex gap-2 md:col-span-3 xl:col-span-1">
            <Button variant="outline" onClick={() => resetFilters()}>Reset</Button>
            <Button onClick={() => { applyFilters(); fetchAdminSummary(); }}>Apply</Button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <Panel
        title="Transaction History"
        meta={
          loading ? "Loading..." : data ? `${data.total.toLocaleString("en-IN")} results` : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-500 dark:text-gray-400">
            <span>Success volume <strong className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">{summaryLoading ? "…" : `₹${fmtINR(summary.total_volume)}`}</strong></span>
            <span>Charges <strong className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">{summaryLoading ? "…" : `₹${fmtINR(summary.total_charges)}`}</strong></span>
            <label className="flex items-center gap-1.5">
              Rows
              <select value={query.per_page} onChange={(e) => setPerPage(Number(e.target.value))} className={`${inputCls} px-2`}>
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        {error && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className={`${TH} text-left`}>{sortBtn("id", "ID")}</th>
                <th className={`${TH} text-left`}>{sortBtn("user_id", "Merchant")}</th>
                <th className={`${TH} text-left`}>Type</th>
                <th className={`${TH} text-left`}>C/D</th>
                <th className={`${TH} text-left`}>Order ID</th>
                <th className={`${TH} text-left`}>Txn ID</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={`${TH} text-right`}>Settle</th>
                <th className={`${TH} text-right`}>Charges</th>
                <th className={`${TH} text-right`}>GST</th>
                <th className={`${TH} text-left`}>Instrument</th>
                <th className={`${TH} text-left`}>API</th>
                <th className={`${TH} text-left`}>{sortBtn("status", "Status")}</th>
                <th className={`${TH} text-left`}>Ref ID</th>
                <th className={`${TH} text-left`}>{sortBtn("created_at", "Created")}</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-10 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={16}>
                    <EmptyState icon={AlertCircle} title="Could not load transactions" description={error} />
                  </td>
                </tr>
              ) : data && data.items.length === 0 ? (
                <tr>
                  <td colSpan={16}>
                    <EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters" />
                  </td>
                </tr>
              ) : data?.items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className={MONO}>{it.id}</td>
                  <td className={`${TD} font-medium text-gray-900 dark:text-gray-100`}>{it.user_id ?? "-"}</td>
                  <td className={TD}><StatusBadge status={it.transaction_type} /></td>
                  <td className={TD}><StatusBadge status={it.credit_debit} /></td>
                  <td className={MONO}>{it.order_id ?? "-"}</td>
                  <td className={MONO}>{it.txn_id ?? "-"}</td>
                  <td className={`${AMT} font-medium text-gray-900 dark:text-gray-100`}>{money(it.amount)}</td>
                  <td className={`${AMT} text-gray-700 dark:text-gray-300`}>{money(it.settle_amount)}</td>
                  <td className={`${AMT} text-gray-700 dark:text-gray-300`}>{money(it.charges)}</td>
                  <td className={`${AMT} text-gray-700 dark:text-gray-300`}>{money(it.gst)}</td>
                  <td className={TD}>{it.instrument_mode ?? "-"}</td>
                  <td className={TD}>{it.api_name ?? "-"}</td>
                  <td className={TD}><StatusBadge status={it.status} /></td>
                  <td className={MONO}>{it.reference_id ?? "-"}</td>
                  <td className={TD}>{it.created_at ? new Date(it.created_at).toLocaleString() : "-"}</td>
                  <td className="px-4 py-1.5 text-right">
                    {actionLoading[it.id] ? (
                      <Loader2 className="inline h-4 w-4 animate-spin text-indigo-600" />
                    ) : (
                      <div className="flex justify-end">
                        <ActionMenu
                          label={`Actions for transaction ${it.id}`}
                          items={
                            it.status === "success"
                              ? [{ label: "Mark Failed", icon: XCircle, destructive: true, onClick: () => handleMarkStatus(it.id, "mark-failed") }]
                              : it.status === "failed"
                              ? [{ label: "Mark Success", icon: CheckCircle2, onClick: () => handleMarkStatus(it.id, "mark-success") }]
                              : []
                          }
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[13px] text-gray-500 dark:text-gray-400">
                  Showing <span className="font-semibold">{((data.page - 1) * data.per_page) + 1}</span> to{" "}
                  <span className="font-semibold">{Math.min(data.page * data.per_page, data.total)}</span> of{" "}
                  <span className="font-semibold">{data.total}</span> transactions
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={data.page === 1}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, data.page - 1))}
                      className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={data.page === 1}
                    >
                      Previous
                    </button>
                    <div className="px-2 text-[13px] text-gray-500 dark:text-gray-400">
                      Page {data.page} of {data.total_pages}
                    </div>
                    <button
                      onClick={() => setPage(data.page + 1)}
                      className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={data.page >= data.total_pages}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setPage(data.total_pages)}
                      className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={data.page >= data.total_pages}
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </Panel>
    </div>
  );
}
