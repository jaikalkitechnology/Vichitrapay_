import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatusBadge, inputCls } from "@/components/admin-part/ui";
import useTransactions from "@/components/txn/useTransactions";
import { WalletTransactionOut } from "@/api/apiHelper";

const shortDate = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};



export default function TransactionsPage() {
  const {
    query,
    data,
    loading,
    error,
    setPage,
    setPerPage,
    setSort,
    setFilter,
    refresh,
  } = useTransactions();

  // local controlled filters
  const [transactionType, setTransactionType] = useState<string | "">("");
  const [creditDebit, setCreditDebit] = useState<string | "">("");
  const [status, setStatus] = useState<string | "">("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const applyFilters = (opts?: { resetPage?: boolean }) => {
    setFilter({
      transaction_type: transactionType || undefined,
      credit_debit: creditDebit || undefined,
      status: status || undefined,
      min_amount: minAmount ? Number(minAmount) : undefined,
      max_amount: maxAmount ? Number(maxAmount) : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search || undefined,
      page: opts?.resetPage ? 1 : undefined,
    });
  };

  const resetFilters = () => {
    setTransactionType("");
    setCreditDebit("");
    setStatus("");
    setMinAmount("");
    setMaxAmount("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setFilter({
      transaction_type: undefined,
      credit_debit: undefined,
      status: undefined,
      min_amount: undefined,
      max_amount: undefined,
      date_from: undefined,
      date_to: undefined,
      search: undefined,
      page: 1,
    });
  };

  const toggleSort = (field: string) => {
    const nextDesc = query.sort_by === field ? !query.sort_desc : true;
    setSort(field, nextDesc);
  };

  const items = data?.items ?? [];
  const pageVolume = items.reduce((sum, it) => sum + (it.amount || 0), 0);
  const successCount = items.filter((it) => it.status === "success" || it.status === "completed").length;
  const successRate = items.length ? (successCount / items.length) * 100 : 0;
  const avgValue = items.length ? pageVolume / items.length : 0;
  const total = data?.total ?? 0;
  const page = data?.page ?? query.page ?? 1;
  const perPage = data?.per_page ?? query.per_page ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Export the rows currently shown as CSV (there is no server-side export for transactions)
  const exportCsv = () => {
    const cols: (keyof WalletTransactionOut)[] = ["id", "transaction_type", "credit_debit", "status", "amount", "charges", "gst", "settle_amount", "balance_amount", "order_id", "txn_id", "created_at"];
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

  const TD = "px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-700 dark:text-gray-300";
  const MONO = "px-4 py-2.5 whitespace-nowrap font-mono text-[12px] text-gray-600 dark:text-gray-400";
  const AMT = "px-4 py-2.5 whitespace-nowrap text-right font-mono text-[13px] tabular-nums text-gray-700 dark:text-gray-300";
  const money = (v?: number | null) => (v === null || v === undefined ? "-" : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const sortHead = (field: string, label: string, align = "text-left") => (
    <th className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${align}`}>
      <button onClick={() => toggleSort(field)} className="inline-flex items-center gap-1 uppercase">
        {label}
        {query.sort_by === field && (query.sort_desc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transactions"
        description="Your PayIn and PayOut transaction history"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!items.length}>
              <Download /> Export
            </Button>
            <Button variant="outline" onClick={() => refresh()}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {/* Inline stat row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-[13px] dark:border-gray-800 dark:bg-gray-900">
        {[
          { label: "Total", value: total.toLocaleString("en-IN") },
          { label: "Volume (this page)", value: `₹${Math.round(pageVolume).toLocaleString("en-IN")}` },
          { label: "Success rate (this page)", value: `${successRate.toFixed(1)}%` },
          { label: "Avg value (this page)", value: `₹${Math.round(avgValue).toLocaleString("en-IN")}` },
        ].map((st) => (
          <div key={st.label} className="flex items-baseline gap-2">
            <span className="text-gray-500 dark:text-gray-400">{st.label}</span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{loading ? "…" : st.value}</span>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-[repeat(8,minmax(0,1fr))_auto]">
          <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className={inputCls} aria-label="Type">
            <option value="">All Types</option>
            <option value="PayIn">PayIn</option>
            <option value="PayOut">PayOut</option>
          </select>
          <select value={creditDebit} onChange={(e) => setCreditDebit(e.target.value)} className={inputCls} aria-label="Credit or debit">
            <option value="">Cr / Dr</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} aria-label="Status">
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min ₹" className={inputCls} aria-label="Min amount" />
          <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max ₹" className={inputCls} aria-label="Max amount" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} aria-label="From date" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} aria-label="To date" title="To date" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilter({ search: e.target.value }); }}
            placeholder="Order / Txn / Ref"
            className={inputCls}
            aria-label="Search"
          />
          <div className="col-span-2 flex gap-2 md:col-span-4 xl:col-span-1">
            <Button onClick={() => applyFilters({ resetPage: true })}>Apply</Button>
            <Button variant="outline" onClick={() => resetFilters()}>Reset</Button>
          </div>
        </div>
      </div>

      <Panel title="Transaction History" meta={`${total.toLocaleString("en-IN")} results`}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">ID</th>
                {sortHead("transaction_type", "Type")}
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">C/D</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Status</th>
                {sortHead("amount", "Amount", "text-right")}
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Charges</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">GST</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Settle Amt</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Balance</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Order ID</th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-left">Txn ID</th>
                {sortHead("created_at", "Created")}
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
                  <td colSpan={12}>
                    <EmptyState icon={AlertCircle} title="Could not load transactions" description={String(error)} />
                  </td>
                </tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters or search terms" />
                  </td>
                </tr>
              )}
              {!loading && !error && items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className={MONO}>{it.id}</td>
                  <td className={TD}><StatusBadge status={it.transaction_type} /></td>
                  <td className={TD}><StatusBadge status={it.credit_debit}>{it.credit_debit === "credit" ? "Cr" : it.credit_debit === "debit" ? "Dr" : "-"}</StatusBadge></td>
                  <td className={TD}><StatusBadge status={it.status} /></td>
                  <td className={`${AMT} font-medium text-gray-900 dark:text-gray-100`}>{money(it.amount)}</td>
                  <td className={AMT}>{money(it.charges)}</td>
                  <td className={AMT}>{money(it.gst)}</td>
                  <td className={AMT}>{money(it.settle_amount)}</td>
                  <td className={AMT}>{money(it.balance_amount)}</td>
                  <td className={MONO}>{it.order_id ?? "-"}</td>
                  <td className={MONO}>{it.txn_id ?? "-"}</td>
                  <td className={TD}>{shortDate(it.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row">
          <span className="text-[13px] text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className={inputCls} aria-label="Rows per page">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <Button variant="outline" size="icon" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p) => (
                <Button key={p} variant={p === page ? "default" : "outline"} size="icon" onClick={() => setPage(p)}>
                  {p}
                </Button>
              ))}
            <Button variant="outline" size="icon" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
