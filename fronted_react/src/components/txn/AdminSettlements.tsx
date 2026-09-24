// Admin Settlements — merchant withdrawal (settlement) requests
import { useCallback, useEffect, useState, type ReactNode } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { fetchUsersWithWallets } from "@/api/apiHelper";
import type { UserWithWallets } from "@/api/apiHelper";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Check, CheckCircle2, Clock, Eye, Filter, Hourglass, IndianRupee, Loader2, RefreshCw, X, XCircle } from "lucide-react";
import { EmptyState } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import { avatarTone } from "@/components/admin-part/tspUtils";
import Pager from "@/components/admin-part/Pager";
import { DateRangeInput, FilterField } from "@/components/admin-part/filterBits";
import { changeLabel, filterInputCls } from "@/components/admin-part/listUtils";
import { MiniBars } from "@/components/txn/DashboardCharts";

type Settlement = {
  id: number;
  txn_id: string;
  user_id: string;
  amount: number;
  status: string;
  txn_type?: string | null;
  settled_date?: string | null;
  created_date?: string | null;
};

type SettleStats = {
  total: number;
  pending: number;
  approved_month: number;
  rejected_month: number;
  settled_amount_month: number;
  settled_amount_last_month: number;
  daily: { date: string; approved: number; rejected: number; pending: number; settled_amount: number }[];
};

type Filters = { user_id: string; status: string; min_amount: string; max_amount: string; from_date: string; to_date: string };
const EMPTY: Filters = { user_id: "", status: "", min_amount: "", max_amount: "", from_date: "", to_date: "" };

/** Settlement requests are the "debit" rows; "credit" rows are the top-up ledger. */
const TXN_TYPE = "debit";

const money = (v?: number | null) =>
  v === undefined || v === null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtWhen = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS = {
  pending: { label: "Pending", icon: Clock, cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400" },
  success: { label: "Approved", icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400" },
  failed: { label: "Rejected", icon: XCircle, cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400" },
} as const;

function SettleStatus({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS];
  if (!s) return <span className="rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] capitalize text-gray-600 dark:border-gray-700">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${s.cls}`}>
      <s.icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

const toParams = (f: Filters) => {
  const p: Record<string, string> = { txn_type: TXN_TYPE };
  (Object.keys(f) as (keyof Filters)[]).forEach((k) => {
    if (f[k]) p[k] = f[k];
  });
  return p;
};

export default function AdminSettlements() {
  const { toast } = useToast();
  const [merchants, setMerchants] = useState<UserWithWallets[]>([]);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [items, setItems] = useState<Settlement[] | null>(null);
  const [stats, setStats] = useState<SettleStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<Settlement | null>(null);
  const [confirm, setConfirm] = useState<{ s: Settlement; action: "approve" | "reject" } | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    fetchUsersWithWallets({ page: 1, per_page: 500 })
      .then((r) => setMerchants(r.items))
      .catch(() => setMerchants([]));
  }, []);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    const params = toParams(applied);
    try {
      const [list, st] = await Promise.all([
        api.get(`${BASE_URL}/admin/settled`, { params: { ...params, page, per_page: perPage } }),
        api.get(`${BASE_URL}/admin/settled/stats`, { params }),
      ]);
      setItems(Array.isArray(list.data) ? list.data : []);
      setStats(st.data);
    } catch (err: any) {
      console.error("settlements load error", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to load settlements");
      setItems([]);
    }
  }, [applied, page, perPage]);

  useEffect(() => {
    load();
  }, [load]);

  const merchant = (id: string) => merchants.find((m) => m.id === id);
  const merchantIdx = (id: string) => Math.max(0, merchants.findIndex((m) => m.id === id));

  const runAction = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      await api.post(`${BASE_URL}/admin/${encodeURIComponent(confirm.s.txn_id)}/${confirm.action}`);
      toast({ title: confirm.action === "approve" ? "Settlement approved" : "Settlement rejected", description: confirm.s.txn_id });
      setConfirm(null);
      load();
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      toast({ title: "Update failed", description: typeof d === "string" ? d : d?.error || err?.message || "Failed to update settlement", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const daily = stats?.daily ?? [];
  const amtChange = stats ? changeLabel(stats.settled_amount_month, stats.settled_amount_last_month, true) : null;
  const total = stats?.total ?? 0;
  const startRow = (page - 1) * perPage;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Settlements</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Approve and manage settlement requests</p>
        </div>
        <Button variant="outline" onClick={load} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
          <RefreshCw /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Pending Settlements"
          value={stats ? stats.pending.toLocaleString("en-IN") : "…"}
          icon={Hourglass}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          hint="Awaiting approval"
          hintTone={stats?.pending ? "warn" : "muted"}
          chart={<MiniBars values={daily.map((d) => d.pending)} color="#F59E0B" className="h-12 w-20 flex-shrink-0" />}
        />
        <TspStat
          label="Approved Settlements"
          value={stats ? stats.approved_month.toLocaleString("en-IN") : "…"}
          icon={CheckCircle2}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint="This month"
          hintTone="up"
          chart={<MiniBars values={daily.map((d) => d.approved)} color="#22C55E" className="h-12 w-20 flex-shrink-0" />}
        />
        <TspStat
          label="Rejected Settlements"
          value={stats ? stats.rejected_month.toLocaleString("en-IN") : "…"}
          icon={XCircle}
          tile="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          hint="This month"
          hintTone={stats?.rejected_month ? "down" : "muted"}
          chart={<MiniBars values={daily.map((d) => d.rejected)} color="#F43F5E" className="h-12 w-20 flex-shrink-0" />}
        />
        <TspStat
          label="Total Settled Amount"
          value={stats ? `₹${Math.round(stats.settled_amount_month).toLocaleString("en-IN")}` : "…"}
          icon={IndianRupee}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={amtChange ? amtChange.text : "Approved this month"}
          hintTone={amtChange ? (amtChange.up ? "up" : "down") : "muted"}
          chart={<MiniBars values={daily.map((d) => d.settled_amount)} color="#3B6BF6" className="h-12 w-20 flex-shrink-0" />}
        />
      </div>
      <p className="-mt-2 text-[12px] text-gray-400">Bars show the last 14 days.</p>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(draft);
        }}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 xl:grid-cols-[1fr_0.9fr_1.4fr_minmax(270px,1.4fr)_auto] xl:items-end"
      >
        <FilterField label="Merchant">
          <select value={draft.user_id} onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))} className={filterInputCls}>
            <option value="">All Merchants</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.username}{m.company_name ? ` — ${m.company_name}` : ""}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className={filterInputCls}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="success">Approved</option>
            <option value="failed">Rejected</option>
          </select>
        </FilterField>
        <FilterField label="Amount Range">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">₹</span>
              <input type="number" min={0} value={draft.min_amount} onChange={(e) => setDraft((d) => ({ ...d, min_amount: e.target.value }))} placeholder="Min Amount" className={`${filterInputCls} pl-7`} aria-label="Minimum amount" />
            </div>
            <span className="text-gray-400">-</span>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">₹</span>
              <input type="number" min={0} value={draft.max_amount} onChange={(e) => setDraft((d) => ({ ...d, max_amount: e.target.value }))} placeholder="Max Amount" className={`${filterInputCls} pl-7`} aria-label="Maximum amount" />
            </div>
          </div>
        </FilterField>
        <FilterField label="Request Date">
          <DateRangeInput from={draft.from_date} to={draft.to_date} onChange={(from_date, to_date) => setDraft((d) => ({ ...d, from_date, to_date }))} ariaLabel="Request date range" />
        </FilterField>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <Button type="button" variant="outline" onClick={() => { setDraft(EMPTY); setApplied(EMPTY); setPage(1); }} className="h-11 flex-1 rounded-xl px-5 text-indigo-600 dark:text-indigo-400 xl:flex-none">
            Reset
          </Button>
          <Button type="submit" className="h-11 flex-1 rounded-xl px-5 xl:flex-none">
            <Filter /> Apply
          </Button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">Settlement Requests</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Review and process merchant settlement requests</p>
          </div>
          <div className="flex items-center gap-4 text-[13px] text-gray-500">
            {total > 0 && items && (
              <span className="whitespace-nowrap">
                Showing <strong className="text-gray-900 dark:text-gray-100">{startRow + 1}–{Math.min(startRow + perPage, total)}</strong> of{" "}
                <strong className="text-gray-900 dark:text-gray-100">{total.toLocaleString("en-IN")}</strong> settlements
              </span>
            )}
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className={`${filterInputCls.replace("w-full", "w-auto")} h-10`} aria-label="Rows per page">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-3 pl-5 pr-3">#</th>
                <th className="px-3 py-3">Settlement ID</th>
                <th className="px-3 py-3">Merchant</th>
                <th className="px-3 py-3 text-right">Requested Amount</th>
                <th className="px-3 py-3 text-right">Settled Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Requested On</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items === null ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8}><EmptyState icon={AlertCircle} title="Could not load settlements" description={error} /></td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8}><EmptyState icon={Clock} title="No settlements found" description="Try changing your filters or check back later" /></td>
                </tr>
              ) : (
                items.map((s, i) => {
                  const m = merchant(s.user_id);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 pl-5 pr-3 text-gray-500">{startRow + i + 1}</td>
                      <td className="max-w-[220px] truncate px-3 py-3 font-mono text-[12px] text-gray-600 dark:text-gray-400" title={s.txn_id}>{s.txn_id}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${avatarTone(merchantIdx(s.user_id))}`}>
                            {(m?.username ?? s.user_id).charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{s.user_id}</div>
                            <div className="truncate text-[12px] text-gray-500">{m?.company_name || m?.username || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(s.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {s.status === "success" ? money(s.amount) : <span className="font-normal text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3"><SettleStatus status={s.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">{fmtWhen(s.created_date)}</td>
                      <td className="py-2 pl-3 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          {s.status === "pending" && (
                            <>
                              <button
                                onClick={() => setConfirm({ s, action: "approve" })}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
                                aria-label={`Approve ${s.txn_id}`}
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setConfirm({ s, action: "reject" })}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
                                aria-label={`Reject ${s.txn_id}`}
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setView(s)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400"
                            aria-label={`View ${s.txn_id}`}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && <Pager page={page} perPage={perPage} total={total} noun="settlements" onPage={setPage} />}
      </div>

      {/* Details */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
            <DialogDescription className="break-all">{view?.txn_id}</DialogDescription>
          </DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {([
                ["Merchant", view.user_id],
                ["Company", merchant(view.user_id)?.company_name || "—"],
                ["Amount", money(view.amount)],
                ["Status", <SettleStatus key="s" status={view.status} />],
                ["Requested On", fmtWhen(view.created_date)],
                ["Record ID", String(view.id)],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {view?.status === "pending" && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="text-red-600" onClick={() => { const s = view; setView(null); setConfirm({ s, action: "reject" }); }}>
                <X /> Reject
              </Button>
              <Button variant="success" onClick={() => { const s = view; setView(null); setConfirm({ s, action: "approve" }); }}>
                <Check /> Approve
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve / reject confirm */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && !acting && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.action === "approve" ? "Approve settlement?" : "Reject settlement?"}</DialogTitle>
            <DialogDescription>
              {confirm?.action === "approve"
                ? `This sends ${money(confirm?.s.amount)} to ${confirm?.s.user_id}'s bank account through the payout provider.`
                : `The ${money(confirm?.s.amount)} request from ${confirm?.s.user_id} will be marked rejected.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
            <Button variant={confirm?.action === "approve" ? "success" : "destructive"} onClick={runAction} disabled={acting}>
              {acting && <Loader2 className="animate-spin" />}
              {confirm?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
