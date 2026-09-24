// Merchant Settlements — withdrawals from the payout balance to own bank accounts
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Clock, Eye, FileText, Loader2, PlusCircle, Printer, RefreshCw, Send, Wallet, XCircle } from "lucide-react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { getSelfProfile } from "@/api/apiHelper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import Pager from "@/components/admin-part/Pager";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import QuickWithdraw from "@/components/txn/QuickWithdraw";

type Settlement = {
  id: number;
  txn_id: string;
  amount: number;
  status: string;
  requested_at?: string | null;
  settled_at?: string | null;
  utr?: string | null;
  bank_account?: { id: number; bank_name?: string | null; last4: string; holder?: string | null; ifsc?: string | null } | null;
};
type Stats = { total: number; completed: number; pending: number; rejected: number };

const STATUS = {
  success: { label: "Completed", icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400" },
  pending: { label: "Pending", icon: Clock, cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400" },
  failed: { label: "Rejected", icon: XCircle, cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400" },
} as const;

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS];
  if (!s) return <span className="rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] capitalize text-gray-600 dark:border-gray-700">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${s.cls}`}>
      <s.icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

const inr = (v: number) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).replace("Sept", "Sep") : "—";
const bankLabel = (s: Settlement) => (s.bank_account ? `${s.bank_account.bank_name || "Bank"} •••• ${s.bank_account.last4}` : "—");

/** Opens a printable withdrawal receipt (the browser's print dialog can save it as PDF). */
function printReceipt(s: Settlement, merchantName: string) {
  const w = window.open("", "_blank", "width=720,height=860");
  if (!w) return;
  const esc = (v: unknown) => String(v ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rows: [string, string][] = [
    ["Settlement ID", s.txn_id],
    ["Merchant", merchantName],
    ["Amount", inr(s.amount)],
    ["Status", STATUS[s.status as keyof typeof STATUS]?.label ?? s.status],
    ["Bank account", s.bank_account ? `${s.bank_account.bank_name ?? ""} •••• ${s.bank_account.last4} (${s.bank_account.holder ?? ""})` : "—"],
    ["IFSC", s.bank_account?.ifsc ?? "—"],
    ["UTR", s.utr ?? "—"],
    ["Requested on", when(s.requested_at)],
    ["Settled on", when(s.settled_at)],
  ];
  w.document.write(`<!doctype html><html><head><title>Receipt ${esc(s.txn_id)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#0f172a;margin:40px}h1{font-size:20px;margin:0}p{color:#64748b;margin:4px 0 24px}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:10px 0;border-bottom:1px solid #e2e8f0}td:first-child{color:#64748b;width:40%}
.amt{font-size:28px;font-weight:700;margin:16px 0}.foot{margin-top:32px;font-size:12px;color:#94a3b8}</style></head><body>
<h1>Vichitrapay — Withdrawal Receipt</h1><p>Generated ${esc(new Date().toLocaleString())}</p>
<div class="amt">${esc(inr(s.amount))}</div><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<div class="foot">This receipt is generated from your Vichitrapay settlement record.</div>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export default function MerchantSettlements() {
  const [balance, setBalance] = useState<number | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [items, setItems] = useState<Settlement[] | null>(null);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<Settlement | null>(null);

  const loadBalance = useCallback(() => {
    getSelfProfile()
      .then((m) => {
        setBalance(Number(m?.payout_wallet?.balance ?? 0));
        setMerchantName(m?.company_name || m?.full_name || m?.username || "");
      })
      .catch(() => setBalance(null));
  }, []);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const r = await api.get(`${BASE_URL}/merchant/settlements`, { params: { page, per_page: perPage, ...(status ? { status } : {}) } });
      setItems(r.data.items ?? []);
      setTotal(r.data.total ?? 0);
      setStats(r.data.stats ?? null);
    } catch (e) {
      setError(errorText(e, "Failed to load settlements"));
      setItems([]);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const refreshAll = () => {
    load();
    loadBalance();
  };

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Settlements</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Withdrawals from your payout balance to your bank accounts</p>
        </div>
        <Button variant="outline" onClick={refreshAll} className="h-11 rounded-xl px-4">
          <RefreshCw /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat label="Available Balance" value={balance == null ? "…" : inr(balance)} icon={Wallet} tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" hint="Ready for withdrawal" />
        <TspStat label="Total Withdrawals" value={stats ? stats.total : "…"} icon={Send} tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" hint="All time requests" />
        <TspStat label="Completed" value={stats ? stats.completed : "…"} icon={CheckCircle2} tile="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" hint={stats?.rejected ? `${stats.rejected} rejected` : "Successfully settled"} hintTone="up" />
        <TspStat label="Pending" value={stats ? stats.pending : "…"} icon={Clock} tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" hint="Under processing" hintTone={stats?.pending ? "warn" : "muted"} />
      </div>

      <QuickWithdraw balance={balance} onWithdrawn={refreshAll} icon="bank" />

      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <PlusCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Settlement History</h2>
              <p className="text-[13px] text-gray-500">Track all your withdrawal requests</p>
            </div>
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${filterInputCls.replace("w-full", "w-auto")} sm:w-44`} aria-label="Status filter">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="success">Completed</option>
            <option value="failed">Rejected</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-3 pl-5 pr-3">#</th>
                <th className="px-3 py-3">Settlement ID</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3">Bank Account</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Requested On</th>
                <th className="px-3 py-3">Settled On</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items === null ? (
                <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : error ? (
                <tr><td colSpan={8}><EmptyState icon={XCircle} title="Could not load settlements" description={error} /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={FileText} title={status ? "No settlements with this status" : "No withdrawals yet"} description="Your withdrawal requests will appear here" /></td></tr>
              ) : (
                items.map((s, i) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 pl-5 pr-3 text-gray-500">{(page - 1) * perPage + i + 1}</td>
                    <td className="max-w-[200px] truncate whitespace-nowrap px-3 py-3 font-mono text-[12.5px] text-gray-700 dark:text-gray-300" title={s.txn_id}>{s.txn_id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{inr(s.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300">{bankLabel(s)}</td>
                    <td className="px-3 py-3"><StatusPill status={s.status} /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">{when(s.requested_at)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">{s.status === "success" ? when(s.settled_at) : "—"}</td>
                    <td className="py-2 pl-3 pr-5">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setView(s)} className={`${btn} border-gray-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400`}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button
                          onClick={() => printReceipt(s, merchantName)}
                          disabled={s.status !== "success"}
                          title={s.status === "success" ? "Print or save as PDF" : "Available once the settlement is completed"}
                          className={`${btn} border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300`}
                        >
                          <FileText className="h-3.5 w-3.5" /> Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && <Pager page={page} perPage={perPage} total={total} noun="settlements" onPage={setPage} />}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
            <DialogDescription className="break-all">{view?.txn_id}</DialogDescription>
          </DialogHeader>
          {view && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                {([
                  ["Amount", inr(view.amount)],
                  ["Status", <StatusPill key="s" status={view.status} />],
                  ["Bank Account", bankLabel(view)],
                  ["Account Holder", view.bank_account?.holder || "—"],
                  ["IFSC", view.bank_account?.ifsc || "—"],
                  ["UTR", view.utr || "—"],
                  ["Requested On", when(view.requested_at)],
                  ["Settled On", view.status === "success" ? when(view.settled_at) : "—"],
                ] as [string, ReactNode][]).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                  </div>
                ))}
              </dl>
              {view.status === "success" && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => printReceipt(view, merchantName)}>
                    <Printer /> Print receipt
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
