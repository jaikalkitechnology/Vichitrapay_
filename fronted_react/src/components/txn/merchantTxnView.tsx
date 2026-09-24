// Admin Transactions — all merchant PayIn / PayOut wallet transactions
import { useCallback, useEffect, useState, type ReactNode } from "react";
import useMerchantTransactions from "@/hooks/useMerchantTransactions";
import { fetchUsersWithWallets } from "@/api/apiHelper";
import type { UserWithWallets, WalletTransactionOut } from "@/api/apiHelper";
import { useToast } from "@/hooks/use-toast";
import api from "@/api/api";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Eye,
  Globe,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Smartphone,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionMenu, EmptyState, StatusBadge } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import { avatarTone } from "@/components/admin-part/tspUtils";
import Pager from "@/components/admin-part/Pager";
import { DateRangeInput, FilterField } from "@/components/admin-part/filterBits";
import { changeLabel, currentMonthRange, filterInputCls, fmtDateTimeParts, isWholeMonth } from "@/components/admin-part/listUtils";
import { BASE_URL } from "@/config";

type TxnStats = {
  total_txns: number;
  payin_volume: number;
  payout_volume: number;
  total_charges: number;
  previous: Omit<TxnStats, "previous" | "daily"> | null;
  daily: { date: string; txns: number; payin_volume: number; payout_volume: number; charges: number }[];
};

type Filters = {
  user_id: string;
  from_date: string;
  to_date: string;
  transaction_type: string;
  status: string;
  search: string;
};

const initialFilters = (): Filters => {
  const { from, to } = currentMonthRange();
  return { user_id: "", from_date: from, to_date: to, transaction_type: "", status: "", search: "" };
};

/** ₹18.4L / ₹2.1Cr */
const inrCompact = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const money = (v?: number | null) =>
  v === undefined || v === null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CHANNELS: { match: RegExp; label: string; icon: LucideIcon; cls: string }[] = [
  { match: /UPI/i, label: "UPI", icon: Smartphone, cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400" },
  { match: /CARD/i, label: "Card", icon: CreditCard, cls: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400" },
  { match: /NET|NB/i, label: "NetBank", icon: Globe, cls: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-400" },
  { match: /WALLET/i, label: "Wallet", icon: Wallet, cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400" },
  { match: /IMPS|NEFT|RTGS|BANK/i, label: "Bank", icon: Building2, cls: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-400" },
];

function ChannelBadge({ mode }: { mode?: string | null }) {
  if (!mode) return <span className="text-gray-400">—</span>;
  const c = CHANNELS.find((x) => x.match.test(mode));
  if (!c) return <span className="text-[12px] text-gray-600 dark:text-gray-400">{mode}</span>;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[12px] font-medium ${c.cls}`} title={mode}>
      <c.icon className="h-3.5 w-3.5" /> {c.label}
    </span>
  );
}

export default function MerchantTransactionsPage() {
  const API_BASE = `${BASE_URL}/admin`;
  const { toast } = useToast();
  const initial = initialFilters();
  const { query, data, loading, error, setPage, setPerPage, setSort, setFilter, refresh } = useMerchantTransactions({
    page: 1,
    per_page: 10,
    sort_by: "created_at",
    sort_dir: "desc",
    from_date: initial.from_date,
    to_date: initial.to_date,
  });

  const [merchants, setMerchants] = useState<UserWithWallets[]>([]);
  const [draft, setDraft] = useState<Filters>(initial);
  const [stats, setStats] = useState<TxnStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [viewTxn, setViewTxn] = useState<WalletTransactionOut | null>(null);
  const [confirm, setConfirm] = useState<{ txn: WalletTransactionOut; action: "mark-failed" | "mark-success" } | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    fetchUsersWithWallets({ page: 1, per_page: 500 })
      .then((r) => setMerchants(r.items))
      .catch((e) => toast({ title: "Failed to load merchants", description: e?.message ?? "Unknown" }));
  }, [toast]);

  const merchantIndex = (id?: string | null) => Math.max(0, merchants.findIndex((m) => m.id === id));

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params: Record<string, string> = {};
      (["user_id", "status", "transaction_type", "from_date", "to_date", "search"] as const).forEach((k) => {
        const v = query[k];
        if (v) params[k] = String(v);
      });
      const res = await api.get(`${API_BASE}/wallet-transactions/stats`, { params });
      setStats(res.data);
    } catch (err) {
      console.error("transaction stats error", err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [API_BASE, query]);

  useEffect(() => {
    fetchStats();
    // re-run only when the applied filters change, not on page/sort changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.user_id, query.status, query.transaction_type, query.from_date, query.to_date, query.search]);

  const apply = () =>
    setFilter({
      user_id: draft.user_id || undefined,
      from_date: draft.from_date || undefined,
      to_date: draft.to_date || undefined,
      transaction_type: draft.transaction_type || undefined,
      status: draft.status || undefined,
      search: draft.search.trim() || undefined,
      page: 1,
    });

  const reset = () => {
    const f = initialFilters();
    setDraft(f);
    setFilter({ user_id: undefined, from_date: f.from_date, to_date: f.to_date, transaction_type: undefined, status: undefined, search: undefined, page: 1 });
  };

  const runAction = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      const res = await api.post(`${API_BASE}/txn/${confirm.txn.id}/${confirm.action}`);
      toast({ title: "Updated", description: res.data?.message || "Status changed" });
      setConfirm(null);
      refresh();
      fetchStats();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.response?.data?.detail || err?.message || "Error" });
    } finally {
      setActing(false);
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

  const monthly = isWholeMonth(query.from_date, query.to_date);
  const prev = stats?.previous;
  const daily = stats?.daily ?? [];
  const card = (cur: number | undefined, prevVal: number | undefined, fallback: string) => {
    const c = cur === undefined ? null : changeLabel(cur, prevVal, monthly);
    return c ? { hint: c.text, hintTone: (c.up ? "up" : "down") as "up" | "down" } : { hint: fallback, hintTone: "muted" as const };
  };
  const scope = query.from_date || query.to_date ? "in selected range" : "all time";

  const sortBtn = (field: string, label: string) => (
    <button
      onClick={() => setSort(field, query.sort_by === field && query.sort_dir === "desc" ? "asc" : "desc")}
      className="inline-flex items-center gap-1 uppercase hover:text-gray-900 dark:hover:text-gray-100"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${query.sort_by === field ? "text-indigo-600" : "opacity-40"}`} />
    </button>
  );

  const TH = "whitespace-nowrap px-2.5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
  const TD = "whitespace-nowrap px-2.5 py-3 text-[13px] text-gray-700 dark:text-gray-300";
  const MONO = "whitespace-nowrap px-2.5 py-3 font-mono text-[12px] text-gray-600 dark:text-gray-400";
  const AMT = "whitespace-nowrap px-2.5 py-3 text-right font-mono text-[12.5px] tabular-nums";
  const total = data?.total ?? 0;
  const startRow = data ? (data.page - 1) * data.per_page : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Transactions</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">All merchant PayIn and PayOut transactions</p>
        </div>
        <Button variant="outline" onClick={() => { refresh(); fetchStats(); }} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
          <RefreshCw /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Total Transactions"
          value={statsLoading && !stats ? "…" : (stats?.total_txns ?? 0).toLocaleString("en-IN")}
          icon={ArrowLeftRight}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          {...card(stats?.total_txns, prev?.total_txns, `All statuses, ${scope}`)}
          trend={daily.map((d) => d.txns)}
          color="#3B6BF6"
        />
        <TspStat
          label="PayIn Volume"
          value={statsLoading && !stats ? "…" : inrCompact(stats?.payin_volume ?? 0)}
          icon={ArrowUpCircle}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          {...card(stats?.payin_volume, prev?.payin_volume, query.status ? `Status: ${query.status}` : "Successful PayIns")}
          trend={daily.map((d) => d.payin_volume)}
          color="#8B5CF6"
        />
        <TspStat
          label="PayOut Volume"
          value={statsLoading && !stats ? "…" : inrCompact(stats?.payout_volume ?? 0)}
          icon={ArrowDownCircle}
          tile="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          {...card(stats?.payout_volume, prev?.payout_volume, query.status ? `Status: ${query.status}` : "Successful PayOuts")}
          trend={daily.map((d) => d.payout_volume)}
          color="#F43F5E"
        />
        <TspStat
          label="Total Charges"
          value={statsLoading && !stats ? "…" : inrCompact(stats?.total_charges ?? 0)}
          icon={Coins}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          {...card(stats?.total_charges, prev?.total_charges, "Charges + GST")}
          trend={daily.map((d) => d.charges)}
          color="#F59E0B"
        />
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => { e.preventDefault(); apply(); }}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 xl:grid-cols-[1fr_minmax(270px,1.5fr)_0.85fr_0.85fr_1.25fr_auto] xl:items-end"
      >
        <FilterField label="Merchant">
          <select value={draft.user_id} onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))} className={filterInputCls}>
            <option value="">All Merchants</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.username}{m.company_name ? ` — ${m.company_name}` : ""}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Date Range">
          <DateRangeInput from={draft.from_date} to={draft.to_date} onChange={(from_date, to_date) => setDraft((d) => ({ ...d, from_date, to_date }))} />
        </FilterField>
        <FilterField label="Transaction Type">
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
        <FilterField label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              placeholder="Search by Order ID, TXN ID, UTR..."
              className={`${filterInputCls} pl-10`}
            />
          </div>
        </FilterField>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <Button type="button" variant="outline" onClick={reset} className="h-11 flex-1 rounded-xl px-5 text-indigo-600 dark:text-indigo-400 xl:flex-none">Reset</Button>
          <Button type="submit" className="h-11 flex-1 rounded-xl px-6 xl:flex-none">Apply</Button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">Transaction History</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Manage and view all merchant transactions</p>
          </div>
          <div className="flex items-center gap-4 text-[13px] text-gray-500">
            {data && total > 0 && (
              <span className="whitespace-nowrap">
                Showing <strong className="text-gray-900 dark:text-gray-100">{(startRow + 1).toLocaleString("en-IN")}–{Math.min(startRow + data.per_page, total).toLocaleString("en-IN")}</strong> of{" "}
                <strong className="text-gray-900 dark:text-gray-100">{total.toLocaleString("en-IN")}</strong> transactions
              </span>
            )}
            <select value={query.per_page} onChange={(e) => setPerPage(Number(e.target.value))} className={`${filterInputCls} h-10 w-auto`} aria-label="Rows per page">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 border-y border-red-200 bg-red-50 px-5 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr>
                <th className={`${TH} pl-5 text-left`}>#</th>
                <th className={`${TH} text-left`}>Merchant</th>
                <th className={`${TH} text-left`}>Type</th>
                <th className={`${TH} text-left`}>Channel</th>
                <th className={`${TH} text-left`}>Order ID</th>
                <th className={`${TH} text-left`}>Txn ID</th>
                <th className={`${TH} text-right`}>{sortBtn("amount", "Amount")}</th>
                <th className={`${TH} text-right`}>Charges</th>
                <th className={`${TH} text-right`}>GST</th>
                <th className={`${TH} text-right`}>Net Amount</th>
                <th className={`${TH} text-left`}>{sortBtn("status", "Status")}</th>
                <th className={`${TH} text-left`}>{sortBtn("created_at", "Date & Time")}</th>
                <th className={`${TH} sticky right-0 bg-slate-50 pr-5 text-center shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-gray-800`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13}>
                    <EmptyState icon={AlertCircle} title="Could not load transactions" description={error} />
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={13}>
                    <EmptyState icon={Inbox} title="No transactions found" description="Try adjusting your filters" />
                  </td>
                </tr>
              ) : (
                data.items.map((it, i) => {
                  const dt = fmtDateTimeParts(it.created_at);
                  return (
                    <tr key={it.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className={`${TD} pl-5 text-gray-500`}>{startRow + i + 1}</td>
                      <td className={TD}>
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${avatarTone(merchantIndex(it.user_id))}`}>
                            {(merchants.find((m) => m.id === it.user_id)?.username ?? it.user_id ?? "?").charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{it.user_id ?? "—"}</span>
                        </div>
                      </td>
                      <td className={TD}><StatusBadge status={it.transaction_type} /></td>
                      <td className={TD}><ChannelBadge mode={it.instrument_mode} /></td>
                      <td className={MONO}>{it.order_id ?? "—"}</td>
                      <td className={MONO}>{it.txn_id ?? "—"}</td>
                      <td className={`${AMT} font-semibold text-gray-900 dark:text-gray-100`}>{money(it.amount)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(it.charges)}</td>
                      <td className={`${AMT} text-gray-600 dark:text-gray-400`}>{money(it.gst)}</td>
                      <td className={`${AMT} font-semibold text-gray-900 dark:text-gray-100`}>{money(it.settle_amount)}</td>
                      <td className={TD}><StatusBadge status={it.status} /></td>
                      <td className={TD}>
                        <div>{dt.day}</div>
                        <div className="text-[12px] text-gray-500">{dt.time}</div>
                      </td>
                      <td className="sticky right-0 bg-white px-2.5 py-2 pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewTxn(it)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-indigo-600 shadow-sm hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                            aria-label={`View transaction ${it.id}`}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <ActionMenu
                            label={`Actions for transaction ${it.id}`}
                            items={[
                              ...(it.txn_id ? [{ label: "Copy Txn ID", icon: Copy, onClick: () => copy(it.txn_id!) }] : []),
                              ...(it.status === "success"
                                ? [{ label: "Mark Failed", icon: XCircle, destructive: true, onClick: () => setConfirm({ txn: it, action: "mark-failed" }) }]
                                : it.status === "failed"
                                ? [{ label: "Mark Success", icon: CheckCircle2, onClick: () => setConfirm({ txn: it, action: "mark-success" }) }]
                                : []),
                            ]}
                          />
                        </div>
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

      {/* Details */}
      <Dialog open={!!viewTxn} onOpenChange={(o) => !o && setViewTxn(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>#{viewTxn?.id} · {viewTxn?.txn_id || "no txn id"}</DialogDescription>
          </DialogHeader>
          {viewTxn && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3">
              {([
                ["Merchant", viewTxn.user_id],
                ["Type", <StatusBadge key="t" status={viewTxn.transaction_type} />],
                ["Credit / Debit", <StatusBadge key="cd" status={viewTxn.credit_debit} />],
                ["Status", <StatusBadge key="s" status={viewTxn.status} />],
                ["Channel", viewTxn.instrument_mode || "—"],
                ["API", viewTxn.api_name || "—"],
                ["Amount", money(viewTxn.amount)],
                ["Charges", money(viewTxn.charges)],
                ["GST", money(viewTxn.gst)],
                ["Net Amount", money(viewTxn.settle_amount)],
                ["Balance After", money(viewTxn.balance_amount)],
                ["Date", viewTxn.created_at ? new Date(viewTxn.created_at).toLocaleString() : "—"],
                ["Order ID", viewTxn.order_id || "—"],
                ["UTR", viewTxn.utr || "—"],
                ["Reference", viewTxn.reference_id || "—"],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
              {viewTxn.description && (
                <div className="col-span-full">
                  <dt className="text-gray-500">Description</dt>
                  <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{viewTxn.description}</dd>
                </div>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark success / failed */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && !acting && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.action === "mark-failed" ? "Mark transaction failed?" : "Mark transaction successful?"}</DialogTitle>
            <DialogDescription>
              Transaction #{confirm?.txn.id} ({money(confirm?.txn.amount)}) for {confirm?.txn.user_id}. This adjusts the merchant's wallet balance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
            <Button variant={confirm?.action === "mark-failed" ? "destructive" : "default"} onClick={runAction} disabled={acting}>
              {acting && <Loader2 className="animate-spin" />}
              {confirm?.action === "mark-failed" ? "Mark Failed" : "Mark Success"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
