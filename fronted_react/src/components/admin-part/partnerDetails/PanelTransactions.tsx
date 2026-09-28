// Partner panel → Merchant Transactions
import { useCallback, useEffect, useState } from "react";
import { Clock, Eye, Loader2, RefreshCw, TrendingUp, Wallet, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls, fmtDateTimeParts } from "@/components/admin-part/listUtils";
import Pager from "@/components/admin-part/Pager";
import { StatusBadge } from "@/components/admin-part/ui";
import { fetchMyMerchants, fetchMyMerchantTxns, type PartnerTxn, type PartnerTxnPage } from "@/api/partnerPanel";
import type { PartnerMerchant } from "@/api/partners";
import { GradientStat } from "@/components/admin-part/partnerDetails/partnerBits";
import { pCard, pOutline, pPrimary } from "@/components/admin-part/partnerDetails/partnerTabs";

const PER_PAGE = 20;
const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const txns = (n: number) => `${n} transaction${n === 1 ? "" : "s"}`;

export default function PanelTransactions() {
  const [merchants, setMerchants] = useState<PartnerMerchant[]>([]);
  const [merchant, setMerchant] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PartnerTxnPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PartnerTxn | null>(null);

  useEffect(() => {
    fetchMyMerchants().then(setMerchants).catch(() => setMerchants([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyMerchantTxns({ merchant_id: merchant, from_date: from, to_date: to, page, per_page: PER_PAGE })
      .then(setData)
      .catch((e) => setError(errorText(e, "Failed to load transactions")))
      .finally(() => setLoading(false));
  }, [merchant, from, to, page]);
  useEffect(load, [load]);

  const s = data?.summary;
  const dateCls = cn(filterInputCls, "h-12 text-[14px] dark:[color-scheme:dark]");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight text-gray-900 dark:text-gray-100">Merchant Transactions</h1>
        <p className="text-[15px] text-gray-600 dark:text-gray-400">View transaction summaries for your merchants</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStat tone="blue" icon={Wallet} label="Success Amount" value={s ? inr(s.success.amount) : "…"} sub={s ? txns(s.success.count) : undefined} />
        <GradientStat tone="orange" icon={Clock} label="Pending Amount" value={s ? inr(s.pending.amount) : "…"} sub={s ? txns(s.pending.count) : undefined} />
        <GradientStat tone="red" icon={XCircle} label="Failed Amount" value={s ? inr(s.failed.amount) : "…"} sub={s ? txns(s.failed.count) : undefined} />
        <GradientStat tone="green" icon={TrendingUp} label="Total Charges" value={s ? inr(s.charges) : "…"} sub="Processing fees + GST" />
      </div>

      <div className={cn(pCard, "grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end")}>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-gray-700 dark:text-gray-300">Merchant</span>
          <select value={merchant} onChange={(e) => { setMerchant(e.target.value); setPage(1); }} className={cn(filterInputCls, "h-12 text-[14px]")}>
            <option value="">All Merchants</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.company_name || m.username} ({m.id})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-gray-700 dark:text-gray-300">Start Date</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={dateCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-gray-700 dark:text-gray-300">End Date</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={dateCls} />
        </label>
        <button type="button" disabled={!merchant && !from && !to} onClick={() => { setMerchant(""); setFrom(""); setTo(""); setPage(1); }} className={cn(pOutline, "h-12")}>Clear</button>
        <button type="button" onClick={load} className={cn(pPrimary, "h-12")}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</button>
      </div>

      <div className={cn(pCard, "overflow-hidden")}>
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Transaction Summaries</h2>
          <span className="rounded-full bg-violet-600 px-3 py-1 text-[12px] font-semibold text-white">{data?.total ?? 0} records</span>
        </div>
        {error ? (
          <p className="border-t border-gray-100 p-6 text-[14px] text-red-600 dark:border-gray-800">{error}</p>
        ) : (
          <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
            <table className="w-full min-w-[980px]">
              <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                <tr className="text-left text-[13px] font-semibold text-gray-700 dark:text-gray-300 [&>th]:px-5 [&>th]:py-3.5">
                  <th>#</th><th>Merchant</th><th>Transaction ID</th><th>Type</th><th>Amount</th><th>Charges</th><th>Status</th><th>Date &amp; Time</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800 [&>tr>td]:px-5 [&>tr>td]:py-3.5">
                {!data ? (
                  <tr><td colSpan={9} className="py-10 text-center text-gray-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</td></tr>
                ) : data.items.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center py-10 text-center">
                        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40"><Wallet className="h-9 w-9" /></span>
                        <div className="mt-3 text-[18px] font-bold text-gray-900 dark:text-gray-100">No transactions found</div>
                        <div className="text-[14px] text-gray-500">Transaction summaries will appear here once your merchants start processing payments.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.items.map((t, i) => {
                    const dt = fmtDateTimeParts(t.created_at);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="text-gray-500">{(page - 1) * PER_PAGE + i + 1}</td>
                        <td><div className="font-medium text-gray-900 dark:text-gray-100">{t.merchant_name || t.merchant_id}</div><div className="font-mono text-[11px] text-gray-500">{t.merchant_id}</div></td>
                        <td><div className="font-mono text-[12px] text-gray-900 dark:text-gray-100">{t.txn_id || "—"}</div><div className="font-mono text-[11px] text-gray-500">{t.order_id}</div></td>
                        <td><StatusBadge status={t.type} /></td>
                        <td className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{inr(t.amount)}</td>
                        <td className="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{inr(t.charges)}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td className="whitespace-nowrap"><div className="text-gray-900 dark:text-gray-100">{dt.day}</div><div className="text-[12px] text-gray-500">{dt.time}</div></td>
                        <td className="text-right"><button type="button" onClick={() => setViewing(t)} className={cn(pOutline, "px-3 py-1.5 text-[13px]")}><Eye className="h-4 w-4" /> View</button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PER_PAGE && <Pager page={page} perPage={PER_PAGE} total={data.total} noun="transactions" onPage={setPage} />}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>Transaction details</DialogTitle>
                <DialogDescription className="font-mono">{viewing.txn_id || viewing.order_id}</DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
                {([
                  ["Merchant", `${viewing.merchant_name || ""} (${viewing.merchant_id})`],
                  ["Order ID", viewing.order_id || "—"],
                  ["Type", viewing.type],
                  ["Amount", inr(viewing.amount)],
                  ["Charges + GST", inr(viewing.charges)],
                  ["Status", viewing.status || "—"],
                  ["Method", viewing.instrument_mode || "—"],
                  ["UTR", viewing.utr || "—"],
                  ["Date", viewing.created_at ? new Date(viewing.created_at).toLocaleString("en-IN") : "—"],
                ] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-3 py-2.5"><dt className="text-gray-500">{k}</dt><dd className="break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd></div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
