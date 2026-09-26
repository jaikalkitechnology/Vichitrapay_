import { useState } from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Landmark, Loader2, MinusCircle, PlusCircle, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { adjustBalance, transferBalance } from "@/api/merchantAdmin";
import { MdBanner, MdSection, MdStat } from "@/components/txn/merchantDetails/mdBits";
import { outlineBtn, primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import { inr, type MdCtx } from "@/components/txn/merchantDetails/mdTypes";

/** Two-step action: first click shows what will happen, second click runs it. */
function ConfirmBar({ text, busy, onConfirm, onCancel }: { text: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <span>{text}</span>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={cn(outlineBtn, "px-3 py-1.5")}>Cancel</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={cn(primaryBtn, "px-3 py-1.5")}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
        </button>
      </div>
    </div>
  );
}

export default function BalanceTab({ ctx }: { ctx: MdCtx }) {
  const { toast } = useToast();
  const u = ctx.user;
  const wallet = Number(u.wallet?.balance ?? 0);
  const payout = Number(u.payout_wallet?.balance ?? 0);

  const [direction, setDirection] = useState<"to_payout" | "to_wallet">("to_payout");
  const [tAmount, setTAmount] = useState("");
  const [tConfirm, setTConfirm] = useState(false);
  const [action, setAction] = useState<"increase" | "decrease">("increase");
  const [aAmount, setAAmount] = useState("");
  const [aConfirm, setAConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const source = direction === "to_payout" ? wallet : payout;
  const tNum = tAmount.trim() ? Number(tAmount) : null;
  const tValid = tNum === null ? source > 0 : tNum > 0 && tNum <= source;
  const aNum = Number(aAmount);
  const aValid = aNum > 0 && (action === "increase" || aNum <= payout);

  const run = async (fn: () => Promise<{ message: string }>, reset: () => void) => {
    setBusy(true);
    try {
      const r = await fn();
      toast({ title: "Balance updated", description: r.message });
      reset();
      ctx.reload();
    } catch (e) {
      toast({ title: "Failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const seg = (on: boolean) => cn("flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-semibold transition", on ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400");

  return (
    <div className="space-y-4">
      <MdBanner icon={Wallet} title="Add Balance PayOut" subtitle="Fund the merchant's payout wallet or move money between wallets" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MdStat icon={Wallet} tone="blue" label="PayIn Wallet" value={inr(wallet)} sub="Collected from PayIns" />
        <MdStat icon={Landmark} tone="green" label="Payout Wallet" value={inr(payout)} sub="Available for payouts" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MdSection icon={ArrowRightLeft} tone="purple" title="Transfer Between Wallets" subtitle="Move the merchant's own funds">
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <button type="button" onClick={() => { setDirection("to_payout"); setTConfirm(false); }} className={seg(direction === "to_payout")}><ArrowUpRight className="h-4 w-4" /> PayIn → Payout</button>
              <button type="button" onClick={() => { setDirection("to_wallet"); setTConfirm(false); }} className={seg(direction === "to_wallet")}><ArrowDownLeft className="h-4 w-4" /> Payout → PayIn</button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Amount (₹)</span>
              <input type="number" min={0} step="0.01" value={tAmount} onChange={(e) => { setTAmount(e.target.value); setTConfirm(false); }} placeholder={`Leave empty to move the full ${inr(source)}`} className={filterInputCls} />
              {tNum !== null && tNum > source && <span className="mt-1 block text-[12px] text-red-600">Only {inr(source)} available</span>}
            </label>
            {tConfirm ? (
              <ConfirmBar
                text={`Move ${inr(tNum ?? source)} from the ${direction === "to_payout" ? "PayIn wallet to the payout wallet" : "payout wallet to the PayIn wallet"}?`}
                busy={busy}
                onCancel={() => setTConfirm(false)}
                onConfirm={() => run(() => transferBalance(u.id, direction, tNum ?? undefined), () => { setTAmount(""); setTConfirm(false); })}
              />
            ) : (
              <button type="button" disabled={!tValid} onClick={() => setTConfirm(true)} className={primaryBtn}><ArrowRightLeft className="h-4 w-4" /> Transfer</button>
            )}
          </div>
        </MdSection>

        <MdSection icon={PlusCircle} tone="green" title="Adjust Payout Wallet" subtitle="Add funds (e.g. a verified top-up) or correct the balance">
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <button type="button" onClick={() => { setAction("increase"); setAConfirm(false); }} className={seg(action === "increase")}><PlusCircle className="h-4 w-4" /> Add balance</button>
              <button type="button" onClick={() => { setAction("decrease"); setAConfirm(false); }} className={seg(action === "decrease")}><MinusCircle className="h-4 w-4" /> Deduct</button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Amount (₹)</span>
              <input type="number" min={0} step="0.01" value={aAmount} onChange={(e) => { setAAmount(e.target.value); setAConfirm(false); }} placeholder="0.00" className={filterInputCls} />
              {action === "decrease" && aNum > payout && <span className="mt-1 block text-[12px] text-red-600">Only {inr(payout)} in the payout wallet</span>}
            </label>
            {aConfirm ? (
              <ConfirmBar
                text={`${action === "increase" ? "Add" : "Deduct"} ${inr(aNum)} ${action === "increase" ? "to" : "from"} the payout wallet? New balance: ${inr(action === "increase" ? payout + aNum : payout - aNum)}.`}
                busy={busy}
                onCancel={() => setAConfirm(false)}
                onConfirm={() => run(() => adjustBalance(u.id, "payout", action, aNum), () => { setAAmount(""); setAConfirm(false); })}
              />
            ) : (
              <button type="button" disabled={!aValid} onClick={() => setAConfirm(true)} className={primaryBtn}>
                {action === "increase" ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />} {action === "increase" ? "Add Balance" : "Deduct Balance"}
              </button>
            )}
          </div>
        </MdSection>
      </div>
    </div>
  );
}
