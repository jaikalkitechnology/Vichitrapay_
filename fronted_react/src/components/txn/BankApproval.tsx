// Admin Bank Account Approval — verify merchant payout bank accounts
import { useCallback, useEffect, useState, type ReactNode } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { fetchUsersWithWallets } from "@/api/apiHelper";
import type { UserWithWallets } from "@/api/apiHelper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, CheckCircle2, Download, Eye, EyeOff, Filter, Hourglass, Landmark, Loader2, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { EmptyState } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import { avatarTone } from "@/components/admin-part/tspUtils";
import Pager from "@/components/admin-part/Pager";
import { FilterField } from "@/components/admin-part/filterBits";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";

type BankAccount = {
  id: number;
  user_id: string;
  merchant_username?: string | null;
  merchant_company?: string | null;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string | null;
  bank_branch?: string | null;
  account_type?: string | null;
  bank_address?: string | null;
  is_validate: boolean;
};

type Stats = { pending: number; approved: number; total: number; merchants: number; banks: string[] };
type Filters = { status: string; user_id: string; bank_name: string; search: string };
const INITIAL: Filters = { status: "pending", user_id: "", bank_name: "", search: "" };

const BANK_TONES = [
  "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
];
/** Stable colour per bank name, so the same bank looks the same in every row. */
const bankTone = (name?: string | null) => {
  const s = (name ?? "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BANK_TONES[h % BANK_TONES.length];
};
const bankInitials = (name?: string | null) =>
  (name ?? "?")
    .replace(/\b(bank|of|the|ltd|limited)\b/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "B";

/** 5010 **** 7890 */
const maskAccount = (n: string) => (n.length <= 8 ? n : `${n.slice(0, 4)} **** ${n.slice(-4)}`);

function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-gray-400">—</span>;
  const current = /current/i.test(type);
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-0.5 text-[12px] font-semibold capitalize ${
        current
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
          : "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
      }`}
    >
      {type}
    </span>
  );
}

export default function BankApproval() {
  const { toast } = useToast();
  const [merchants, setMerchants] = useState<UserWithWallets[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [draft, setDraft] = useState<Filters>(INITIAL);
  const [applied, setApplied] = useState<Filters>(INITIAL);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [items, setItems] = useState<BankAccount[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [view, setView] = useState<BankAccount | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [confirm, setConfirm] = useState<{ a: BankAccount; action: "approve" | "reject" } | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = useCallback(() => {
    const p: Record<string, string> = { status: applied.status || "all" };
    if (applied.user_id) p.user_id = applied.user_id;
    if (applied.bank_name) p.bank_name = applied.bank_name;
    if (applied.search.trim()) p.search = applied.search.trim();
    return p;
  }, [applied]);

  const loadStats = useCallback(() => {
    api
      .get(`${BASE_URL}/admin/bank-accounts/stats`)
      .then((r) => setStats(r.data))
      .catch((e) => console.error("bank stats", e));
  }, []);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const r = await api.get(`${BASE_URL}/admin/bank-accounts`, { params: { ...params(), page, per_page: perPage } });
      setItems(r.data.items || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(errorText(e, "Failed to load bank accounts"));
      setItems([]);
      setTotal(0);
    }
  }, [params, page, perPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadStats();
    fetchUsersWithWallets({ page: 1, per_page: 500 })
      .then((r) => setMerchants(r.items))
      .catch(() => setMerchants([]));
  }, [loadStats]);

  const runAction = async () => {
    if (!confirm) return;
    const { a, action } = confirm;
    setBusy((s) => ({ ...s, [a.id]: true }));
    try {
      await api.post(`${BASE_URL}/admin/bank-accounts/${a.id}/${action}`);
      toast({
        title: action === "approve" ? "Bank account approved" : "Bank account rejected",
        description: `${a.account_holder_name} · ${a.bank_name ?? ""} ${maskAccount(a.account_number)}`,
      });
      setConfirm(null);
      setView(null);
      load();
      loadStats();
    } catch (e) {
      toast({ title: "Action failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy((s) => ({ ...s, [a.id]: false }));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get(`${BASE_URL}/admin/bank-accounts/export`, { params: params(), responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bank_accounts_${applied.status || "all"}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Export failed", description: errorText(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const merchantIdx = (id: string) => Math.max(0, merchants.findIndex((m) => m.id === id));
  const startRow = (page - 1) * perPage;
  const title = applied.status === "approved" ? "Approved Bank Accounts" : applied.status === "pending" ? "Pending Bank Accounts" : "All Bank Accounts";
  const TH = "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";
  const TD = "whitespace-nowrap px-3 py-3 text-[13px] text-gray-700 dark:text-gray-300";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Bank Account Approval</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Review and approve merchant bank accounts for payouts</p>
        </div>
        <Button variant="outline" onClick={() => { load(); loadStats(); }} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
          <RefreshCw /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Pending Approvals"
          value={stats ? stats.pending.toLocaleString("en-IN") : "…"}
          icon={Hourglass}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          hint="Awaiting verification"
          hintTone={stats?.pending ? "warn" : "muted"}
        />
        <TspStat
          label="Approved Accounts"
          value={stats ? stats.approved.toLocaleString("en-IN") : "…"}
          icon={CheckCircle2}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint={stats?.total ? `${Math.round((stats.approved / stats.total) * 100)}% of all accounts` : "Usable for payouts"}
          hintTone={stats?.approved ? "up" : "muted"}
        />
        <TspStat
          label="Merchants Covered"
          value={stats ? stats.merchants.toLocaleString("en-IN") : "…"}
          icon={Users}
          tile="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          hint="Have at least one bank account"
        />
        <TspStat
          label="Total Bank Accounts"
          value={stats ? stats.total.toLocaleString("en-IN") : "…"}
          icon={Landmark}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={stats ? `${stats.banks.length} bank${stats.banks.length === 1 ? "" : "s"}` : undefined}
        />
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(draft);
        }}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_1.6fr_auto] xl:items-end"
      >
        <FilterField label="Merchant">
          <select value={draft.user_id} onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))} className={filterInputCls}>
            <option value="">All Merchants</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.username}{m.company_name ? ` — ${m.company_name}` : ""}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Bank Name">
          <select value={draft.bank_name} onChange={(e) => setDraft((d) => ({ ...d, bank_name: e.target.value }))} className={filterInputCls}>
            <option value="">All Banks</option>
            {(stats?.banks ?? []).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className={filterInputCls}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="all">All Status</option>
          </select>
        </FilterField>
        <FilterField label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              placeholder="Search by merchant, holder, account no, IFSC..."
              className={`${filterInputCls} pl-10`}
            />
          </div>
        </FilterField>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          <Button type="button" variant="outline" onClick={() => { setDraft(INITIAL); setApplied(INITIAL); setPage(1); }} className="h-11 flex-1 rounded-xl px-5 text-indigo-600 dark:text-indigo-400 xl:flex-none">
            Reset
          </Button>
          <Button type="submit" className="h-11 flex-1 rounded-xl px-5 xl:flex-none">
            <Filter /> Apply Filters
          </Button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {applied.status === "approved" ? "Verified accounts merchants can withdraw to" : "Merchants waiting for bank account verification"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className={`${filterInputCls.replace("w-full", "w-auto")} h-10`}
              aria-label="Rows per page"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || !total} className="h-10 rounded-xl">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr>
                <th className={`${TH} pl-5`}>#</th>
                <th className={TH}>Merchant</th>
                <th className={TH}>Account Holder</th>
                <th className={TH}>Bank Details</th>
                <th className={TH}>Account Number</th>
                <th className={TH}>IFSC Code</th>
                <th className={TH}>Type</th>
                <th className={`${TH} sticky right-0 bg-slate-50 pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-gray-800`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items === null ? (
                <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : error ? (
                <tr><td colSpan={8}><EmptyState icon={Landmark} title="Could not load bank accounts" description={error} /></td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={ShieldCheck}
                      title={applied.status === "pending" && !applied.user_id && !applied.bank_name && !applied.search ? "No pending bank accounts" : "No bank accounts found"}
                      description={applied.status === "pending" ? "All accounts have been reviewed" : "Try changing the filters"}
                    />
                  </td>
                </tr>
              ) : (
                items.map((a, i) => (
                  <tr key={a.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className={`${TD} pl-5 text-gray-500`}>{startRow + i + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${avatarTone(merchantIdx(a.user_id))}`}>
                          {(a.merchant_company || a.merchant_username || a.user_id).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{a.user_id}</div>
                          <div className="max-w-[160px] truncate text-[12px] text-gray-500">{a.merchant_company || a.merchant_username || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>{a.account_holder_name}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${bankTone(a.bank_name)}`}>{bankInitials(a.bank_name)}</span>
                        <div>
                          <div>{a.bank_name || "—"}</div>
                          {a.bank_branch && <div className="text-[12px] text-gray-500">{a.bank_branch}</div>}
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} font-mono text-[12.5px]`} title="Open details to see the full number">{maskAccount(a.account_number)}</td>
                    <td className={`${TD} font-mono text-[12.5px]`}>{a.ifsc_code}</td>
                    <td className={TD}><TypeBadge type={a.account_type} /></td>
                    <td className={`${TD} sticky right-0 bg-white pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800`}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setView(a); setShowFull(false); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400"
                          aria-label={`View account ${a.id}`}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {a.is_validate ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
                            <Check className="h-3.5 w-3.5" /> Approved
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => setConfirm({ a, action: "approve" })}
                              disabled={busy[a.id]}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-[12.5px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {busy[a.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                            </button>
                            <button
                              onClick={() => setConfirm({ a, action: "reject" })}
                              disabled={busy[a.id]}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[12.5px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && <Pager page={page} perPage={perPage} total={total} noun="accounts" onPage={setPage} />}
      </div>

      {/* Details */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bank Account Details</DialogTitle>
            <DialogDescription>{view?.user_id}{view?.merchant_company ? ` · ${view.merchant_company}` : ""}</DialogDescription>
          </DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {([
                ["Account Holder", view.account_holder_name],
                [
                  "Account Number",
                  <button key="n" type="button" onClick={() => setShowFull((v) => !v)} className="inline-flex items-center gap-1.5 font-mono hover:text-indigo-600">
                    {showFull ? view.account_number : maskAccount(view.account_number)}
                    {showFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>,
                ],
                ["IFSC Code", view.ifsc_code],
                ["Bank", view.bank_name || "—"],
                ["Branch", view.bank_branch || "—"],
                ["Type", <TypeBadge key="t" type={view.account_type} />],
                ["Status", view.is_validate ? "Approved" : "Pending verification"],
                ["Address", view.bank_address || "—"],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {view && !view.is_validate && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="text-red-600" onClick={() => setConfirm({ a: view, action: "reject" })}><X /> Reject</Button>
              <Button variant="success" onClick={() => setConfirm({ a: view, action: "approve" })}><Check /> Approve</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.action === "approve" ? "Approve bank account?" : "Reject bank account?"}</DialogTitle>
            <DialogDescription>
              {confirm?.action === "approve"
                ? `${confirm?.a.user_id} will be able to withdraw to ${confirm?.a.account_holder_name}, ${confirm?.a.bank_name ?? ""} ${confirm ? maskAccount(confirm.a.account_number) : ""} (${confirm?.a.ifsc_code}).`
                : "Rejecting deletes this bank account. The merchant has to add it again to request approval. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.action === "approve" ? "success" : "destructive"} onClick={runAction} disabled={confirm ? busy[confirm.a.id] : false}>
              {confirm && busy[confirm.a.id] && <Loader2 className="animate-spin" />}
              {confirm?.action === "approve" ? "Approve" : "Reject & delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
