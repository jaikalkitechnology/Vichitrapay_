import { useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Eye, EyeOff, Loader2, Lock, RefreshCw, Shield, ShieldCheck, User, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { generatePassword, setMerchantPassword } from "@/api/merchantAdmin";
import { MdBanner } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, outlineBtn, primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import type { MdCtx } from "@/components/txn/merchantDetails/mdTypes";

function PwdInput({ label, value, onChange, show, setShow, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; show: boolean; setShow: (b: boolean) => void; placeholder: string; hint: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium text-gray-800 dark:text-gray-200">
        {label} <span className="text-red-500">*</span>
      </span>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" className={cn(filterInputCls, "h-12 pl-10 pr-11")} />
        <button type="button" onClick={() => setShow(!show)} tabIndex={-1} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <span className="mt-1.5 block text-[12px] text-gray-500">{hint}</span>
    </label>
  );
}

/** Set / generate a login password for any account (merchant or partner). */
export function SetPasswordPanel({ userId, username, kind }: { userId: string; username: string; kind: "merchant" | "partner" }) {
  const Kind = kind === "merchant" ? "Merchant" : "Partner";
  const { toast } = useToast();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const clear = () => {
    setPwd("");
    setConfirm("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (pwd.length < 8) return setError("Use at least 8 characters");
    if (pwd !== confirm) return setError("The two passwords do not match");
    setBusy(true);
    setError(null);
    try {
      await setMerchantPassword(userId, pwd);
      setDone(true);
      toast({ title: "Password updated", description: `Share the new password with ${username} securely.` });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    const p = generatePassword();
    setPwd(p);
    setConfirm(p);
    setShow1(true);
    setShow2(true);
    setDone(false);
    setError(null);
  };

  const guidelines = [
    { icon: Lock, title: "Use Strong Password", text: "At least 8 characters with letters, numbers, and special characters", cls: "border-blue-100 bg-blue-50/60 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/20" },
    { icon: CheckCircle2, title: "Keep it Unique", text: "Avoid reusing passwords from other services", cls: "border-green-100 bg-green-50/60 text-green-600 dark:border-green-900/40 dark:bg-green-950/20" },
    { icon: AlertCircle, title: "Share Securely", text: `Send the password to the ${kind} over a private channel only`, cls: "border-amber-100 bg-amber-50/60 text-amber-500 dark:border-amber-900/40 dark:bg-amber-950/20" },
    { icon: ShieldCheck, title: "Ask to Change It", text: kind === "merchant" ? "The merchant can change it any time from Profile & Settings → Security" : "Change it periodically for better security", cls: "border-purple-100 bg-purple-50/60 text-purple-600 dark:border-purple-900/40 dark:bg-purple-950/20" },
  ];

  return (
    <div className="space-y-4">
      <MdBanner icon={Lock} title={`Set ${Kind} Password`} subtitle={`Set or reset the password for this ${kind} account`} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={cn(mdCard, "overflow-hidden")}>
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Lock className="h-5 w-5" /></span>
            <div>
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Set New Password</h3>
              <p className="text-[13px] text-gray-500">Create a secure password for {kind} login</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-5 p-5">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-medium text-gray-800 dark:text-gray-200">{Kind} ID</span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input readOnly value={userId} className={cn(filterInputCls, "h-12 cursor-default bg-gray-50 pl-10 font-medium dark:bg-gray-800/60")} />
              </div>
            </label>
            <PwdInput label="New Password" value={pwd} onChange={(v) => { setPwd(v); setDone(false); }} show={show1} setShow={setShow1} placeholder="Enter a strong password" hint="Use at least 8 characters with letters, numbers, and special characters" />
            <PwdInput label="Confirm Password" value={confirm} onChange={(v) => { setConfirm(v); setDone(false); }} show={show2} setShow={setShow2} placeholder="Re-enter the password" hint="Re-enter the password to confirm it matches" />
            {confirm && pwd !== confirm && <p className="-mt-3 text-[12px] text-red-600">Passwords do not match</p>}
            {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"><AlertCircle className="h-4 w-4" /> {error}</div>}
            {done && (
              <div className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-[13px] text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Password set. The {kind} can log in with it now.</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(pwd).then(() => toast({ title: "Password copied" }))} className="inline-flex items-center gap-1.5 font-medium hover:underline"><Copy className="h-3.5 w-3.5" /> Copy password</button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={clear} className={cn(outlineBtn, "h-12")}>Clear Form</button>
              <button type="submit" disabled={busy || !pwd || !confirm} className={cn(primaryBtn, "h-12 bg-gradient-to-r from-indigo-600 to-purple-600")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Set {Kind} Password
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className={cn(mdCard, "p-5")}>
            <h3 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-gray-100"><Shield className="h-5 w-5 text-blue-600" /> Security Guidelines</h3>
            <div className="space-y-2.5">
              {guidelines.map((g) => (
                <div key={g.title} className={cn("flex gap-3 rounded-xl border p-3", g.cls)}>
                  <g.icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{g.title}</div>
                    <div className="text-[12px] text-gray-600 dark:text-gray-400">{g.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={cn(mdCard, "p-5")}>
            <h3 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-gray-100"><Zap className="h-5 w-5 text-blue-600" /> Quick Actions</h3>
            <button type="button" onClick={generate} className={cn(outlineBtn, "w-full justify-start")}>
              <RefreshCw className="h-4 w-4" /> Generate Temporary Password
            </button>
            <p className="mt-2 text-[12px] text-gray-500">Fills both fields with a random 12-character password. Review it, then click Set {Kind} Password.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PasswordTab({ ctx }: { ctx: MdCtx }) {
  return <SetPasswordPanel userId={ctx.user.id} username={ctx.user.username} kind="merchant" />;
}
