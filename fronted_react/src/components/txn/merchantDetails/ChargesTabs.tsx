// "Charges Setting" (PayIn fee) and "PayOut Charges" (flat / percentage payout fee) tabs
import { useState } from "react";
import { Building2, CheckCircle2, Clock, FileText, IndianRupee, Loader2, Percent, Settings, Users, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { payinFee, payoutFee, saveMerchantSettings } from "@/api/merchantAdmin";
import { MdBanner, MdSection, MdStat, Pill } from "@/components/txn/merchantDetails/mdBits";
import { primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import { companyTypeLabel, inr, type MdCtx } from "@/components/txn/merchantDetails/mdTypes";

const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";
const td = "px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300";

function PctInput({ label, value, onChange, prefix = "%", hint }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex overflow-hidden rounded-xl border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-gray-700">
        <span className="flex w-11 items-center justify-center border-r border-gray-200 bg-gray-50 text-[13px] text-gray-500 dark:border-gray-700 dark:bg-gray-800">{prefix}</span>
        <input type="number" step="0.01" min={0} value={value} onChange={(e) => onChange(e.target.value)} className={cn(filterInputCls, "rounded-none border-0 focus:ring-0")} />
      </div>
      {hint && <span className="mt-1 block text-[12px] text-gray-500">{hint}</span>}
    </label>
  );
}

function useSave(ctx: MdCtx) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (data: Parameters<typeof saveMerchantSettings>[1], what: string) => {
    setBusy(true);
    try {
      ctx.setSettings(await saveMerchantSettings(ctx.user.id, data));
      toast({ title: `${what} saved` });
    } catch (e) {
      toast({ title: "Save failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) || Number(v) < 0 ? null : Number(v));

export function ChargesTab({ ctx }: { ctx: MdCtx }) {
  const s = ctx.settings;
  const [payin, setPayin] = useState(String(s?.payInCharges ?? ""));
  const { busy, save } = useSave(ctx);
  const pct = num(payin);
  const dirty = pct !== null && pct !== (s?.payInCharges ?? null);

  return (
    <div className="space-y-4">
      <MdBanner icon={Settings} title="Payment Charges Configuration" subtitle="Set the PayIn commission charged to this merchant" right={<Pill tone={s ? "green" : "amber"}>{s ? "Configured" : "Not configured"}</Pill>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MdStat icon={Percent} tone="blue" label="PayIn Fee" value={`${s?.payInCharges ?? 0}%`} sub="of each successful PayIn" />
        <MdStat icon={Wallet} tone="green" label="Payout up to ₹1,000" value={inr(s?.payOutChargesFlat)} sub="flat per payout" />
        <MdStat icon={Percent} tone="purple" label="Payout above ₹1,000" value={`${s?.payOutCharges ?? 0}%`} sub="of the payout amount" />
        <MdStat icon={Building2} tone="amber" label="Business Type" value={companyTypeLabel(ctx.kyc) ?? "—"} valueCls="text-[17px]" sub="from the merchant's KYC" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MdSection icon={Settings} title="PayIn Charges" subtitle="Platform commission on successful PayIns" right={<Pill tone={s ? "blue" : "gray"}>{s ? "Configured" : "Not set"}</Pill>}>
          <div className="space-y-4">
            <PctInput label="PayIn commission" value={payin} onChange={setPayin} hint="18% GST is added on top of the commission. The rest is credited to the merchant wallet." />
            <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-[12px] text-gray-500 dark:bg-gray-800/50">
              One rate applies to every payment method (UPI, cards, net banking) — the gateway does not support per-method rates yet.
            </p>
            <button type="button" disabled={busy || !dirty} onClick={() => save({ payInCharges: pct! }, "PayIn charges")} className={primaryBtn}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save PayIn Charges
            </button>
          </div>
        </MdSection>

        <MdSection icon={Users} tone="green" title="Merchant Preview" subtitle="What the merchant receives at this rate" bodyCls="p-0">
          <table className="w-full">
            <thead className="bg-gray-50/80 dark:bg-gray-800/40">
              <tr>
                <th className={th}>Amount</th>
                <th className={th}>Fee</th>
                <th className={th}>GST</th>
                <th className={th}>Merchant gets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[1000, 10000, 50000].map((a) => {
                const f = payinFee(a, pct ?? 0);
                return (
                  <tr key={a}>
                    <td className={cn(td, "font-medium")}>{inr(a)}</td>
                    <td className={td}>{inr(f.charges)}</td>
                    <td className={td}>{inr(f.gst)}</td>
                    <td className={cn(td, "font-semibold text-green-700 dark:text-green-400")}>{inr(f.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </MdSection>
      </div>
    </div>
  );
}

export function PayoutChargesTab({ ctx }: { ctx: MdCtx }) {
  const s = ctx.settings;
  const p = ctx.summary?.payout;
  const [flat, setFlat] = useState(String(s?.payOutChargesFlat ?? ""));
  const [percent, setPercent] = useState(String(s?.payOutCharges ?? ""));
  const { busy, save } = useSave(ctx);
  const f = num(flat);
  const pc = num(percent);
  const dirty = f !== null && pc !== null && (f !== (s?.payOutChargesFlat ?? null) || pc !== (s?.payOutCharges ?? null));

  return (
    <div className="space-y-4">
      <MdBanner icon={Wallet} title="Set Payout Charges" subtitle="Manage this merchant's payout fees" note="Payouts up to ₹1,000 pay a flat fee; above ₹1,000 a percentage of the amount. 18% GST is added to the fee." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MdStat icon={FileText} tone="blue" label="Total Payouts" value={p?.txns ?? "…"} />
        <MdStat icon={IndianRupee} tone="green" label="Total Amount" value={p ? inr(p.volume) : "…"} sub="successful payouts" />
        <MdStat icon={CheckCircle2} tone="purple" label="Successful" value={p?.success ?? "…"} />
        <MdStat icon={Clock} tone="amber" label="Pending" value={p?.pending ?? "…"} sub={p ? `${p.failed} failed` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MdSection icon={Settings} title="Payout Charges Configuration" subtitle="Applies to every payout provider" right={<Pill tone="blue">Merchant: {ctx.user.id}</Pill>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PctInput label="Flat fee — up to ₹1,000" prefix="₹" value={flat} onChange={setFlat} />
              <PctInput label="Percentage — above ₹1,000" value={percent} onChange={setPercent} />
            </div>
            <button type="button" disabled={busy || !dirty} onClick={() => save({ payOutChargesFlat: f!, payOutCharges: pc! }, "Payout charges")} className={primaryBtn}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save Payout Charges
            </button>
          </div>
        </MdSection>

        <MdSection icon={IndianRupee} tone="green" title="Payout Preview" subtitle="Debited from the merchant's payout wallet" bodyCls="p-0">
          <table className="w-full">
            <thead className="bg-gray-50/80 dark:bg-gray-800/40">
              <tr>
                <th className={th}>Amount</th>
                <th className={th}>Fee</th>
                <th className={th}>GST</th>
                <th className={th}>Total debit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[500, 1000, 10000, 50000].map((a) => {
                const r = payoutFee(a, f ?? 0, pc ?? 0);
                return (
                  <tr key={a}>
                    <td className={cn(td, "font-medium")}>{inr(a)}</td>
                    <td className={td}>{inr(r.charges)}</td>
                    <td className={td}>{inr(r.gst)}</td>
                    <td className={cn(td, "font-semibold text-gray-900 dark:text-gray-100")}>{inr(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </MdSection>
      </div>
    </div>
  );
}
