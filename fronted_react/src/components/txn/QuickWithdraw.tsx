// Quick Withdraw card — request a transfer from the payout balance to a verified bank account
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Landmark, Loader2, Plus, Wallet } from "lucide-react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { listPayoutBankAccounts, type PayoutBankAccountOut } from "@/api/apiHelper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";

/** Server-side minimum (MIN_WITHDRAW_AMOUNT in routers/merchant.py). */
const MIN_WITHDRAW = 100;

export default function QuickWithdraw({
  balance,
  onWithdrawn,
  icon = "wallet",
}: {
  /** payout wallet balance, or null while loading */
  balance: number | null;
  onWithdrawn: () => void;
  icon?: "wallet" | "bank";
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<(PayoutBankAccountOut & { account_mask?: string })[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listPayoutBankAccounts({ limit: 100, offset: 0 });
      const verified = (res.items ?? []).filter((a) => a.is_validate);
      setAccounts(res.items ?? []);
      setSelected((cur) => (cur && verified.some((a) => a.id === cur) ? cur : verified[0]?.id ?? null));
    } catch (e) {
      setError(errorText(e, "Failed to load bank accounts"));
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bal = balance ?? 0;
  const verified = (accounts ?? []).filter((a) => a.is_validate);
  const pendingCount = (accounts ?? []).length - verified.length;
  const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!n || n <= 0) return setError("Enter a valid amount");
    if (n < MIN_WITHDRAW) return setError(`Minimum withdrawal is ${inr(MIN_WITHDRAW)}`);
    if (n > bal) return setError(`You can withdraw up to ${inr(bal)}`);
    if (!selected) return setError("Select a verified bank account");
    setBusy(true);
    try {
      const resp = await api.post(`${BASE_URL}/merchant/withdraw`, { amount: n, bank_account_id: String(selected) });
      if (resp.data?.success) {
        setAmount("");
        toast({ title: "Withdrawal requested", description: `${inr(n)} will be sent after admin approval` });
        onWithdrawn();
      } else {
        setError(resp.data?.message || "Unknown error");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const Icon = icon === "bank" ? Landmark : Wallet;

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Quick Withdraw</h2>
            <p className="text-[13px] text-gray-500">Transfer your available balance to your bank account</p>
          </div>
        </div>
        <span className="self-start rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-[13px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400 sm:self-auto">
          Available: {balance == null ? "…" : inr(bal)}
        </span>
      </div>
      <form onSubmit={submit} className="p-5">
        {accounts !== null && verified.length === 0 ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-gray-500">
              {pendingCount > 0
                ? `Your bank account${pendingCount === 1 ? " is" : "s are"} waiting for admin verification. You can withdraw once one is verified.`
                : "Add a payout bank account to withdraw funds."}
            </p>
            <Button type="button" variant={pendingCount ? "outline" : "default"} onClick={() => navigate("/merchant/bankAccount")}>
              {pendingCount ? <Landmark /> : <Plus />} {pendingCount ? "View accounts" : "Add Bank Account"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.25fr_auto] md:items-start">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Amount (₹)</span>
              <input
                type="number"
                step="0.01"
                min={MIN_WITHDRAW}
                max={bal || undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={filterInputCls}
              />
              <span className="mt-1.5 block text-[12px] text-gray-500">
                Minimum {inr(MIN_WITHDRAW)}, maximum {inr(bal)}
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-gray-700 dark:text-gray-300">
                Bank Account
                <button type="button" onClick={() => setAmount(String(Math.floor(bal * 100) / 100))} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Use max
                </button>
              </span>
              <select value={selected ?? ""} onChange={(e) => setSelected(Number(e.target.value))} className={filterInputCls} disabled={!accounts}>
                {verified.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name || "Bank"} •••• {String(a.account_mask ?? a.account_number ?? "").slice(-4)} ({a.account_holder_name})
                  </option>
                ))}
              </select>
              {pendingCount > 0 && (
                <span className="mt-1.5 block text-[12px] text-gray-500">
                  {pendingCount} account{pendingCount === 1 ? "" : "s"} awaiting verification not shown
                </span>
              )}
            </label>
            <Button type="submit" disabled={busy || !amount || !selected} className="h-11 rounded-xl px-6 shadow-lg shadow-indigo-600/25 md:mt-[26px]">
              {busy && <Loader2 className="animate-spin" />}
              Withdraw <ArrowRight />
            </Button>
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
      </form>
    </div>
  );
}
