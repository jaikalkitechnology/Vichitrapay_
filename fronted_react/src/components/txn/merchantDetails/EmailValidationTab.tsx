import { useEffect, useState } from "react";
import { BarChart3, Bot, CheckCircle2, FileText, Info, Loader2, Mail, ShieldCheck, XCircle, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { fetchEmailValidation, setEmailValidation, testCustomerEmail, type EmailTestResult, type EmailValidationSetting } from "@/api/merchantAdmin";
import { MdBanner, Pill } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import { fmtDateTime, type MdCtx } from "@/components/txn/merchantDetails/mdTypes";

// Examples match the server rule exactly (valid format + a vowel before the @)
const RULES = [
  { icon: CheckCircle2, tile: "bg-green-50 text-green-600 dark:bg-green-950/40", title: "Must contain vowel", text: "At least one vowel (A, E, I, O, U) in the username part", ok: true, example: "john@gmail.com" },
  { icon: XCircle, tile: "bg-red-50 text-red-500 dark:bg-red-950/40", title: "Block invalid formats", text: "Reject addresses that are not a valid email", ok: false, example: "rahul.gmail.com" },
  { icon: Mail, tile: "bg-blue-50 text-blue-600 dark:bg-blue-950/40", title: "Accept standard formats", text: "Every email provider and domain is accepted", ok: true, example: "user@outlook.com" },
  { icon: Bot, tile: "bg-purple-50 text-purple-600 dark:bg-purple-950/40", title: "Prevent fake emails", text: "Helps reduce fake or automated payments", ok: false, example: "xyz@123.com" },
];

export default function EmailValidationTab({ ctx }: { ctx: MdCtx }) {
  const { toast } = useToast();
  const [setting, setSetting] = useState<EmailValidationSetting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<EmailTestResult | null>(null);

  useEffect(() => {
    fetchEmailValidation(ctx.user.id)
      .then(setSetting)
      .catch((e) => setError(errorText(e, "Failed to load email validation")));
  }, [ctx.user.id]);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      setSetting(await setEmailValidation(ctx.user.id, enabled));
      toast({ title: enabled ? "Email validation enabled" : "Email validation disabled" });
    } catch (e) {
      toast({ title: "Update failed", description: errorText(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const test = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setTesting(true);
    try {
      setResult(await testCustomerEmail(email));
    } catch (err) {
      toast({ title: "Test failed", description: errorText(err), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const on = !!setting?.enabled;

  return (
    <div className="space-y-4">
      <MdBanner icon={Mail} title="Email Validation Settings" subtitle="Control whether customer emails are validated for this merchant during payment initiation." />

      {error ? (
        <div className={cn(mdCard, "p-5 text-[13px] text-red-600")}>{error}</div>
      ) : !setting ? (
        <div className="flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className={cn(mdCard, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Mail className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Email Validation</h3>
                  <p className="text-[13px] text-gray-500">Enable or disable email validation for this merchant</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
                <Switch checked={on} onCheckedChange={toggle} disabled={saving} aria-label="Email validation" className="data-[state=checked]:bg-indigo-600" />
                <Pill tone={on ? "green" : "gray"}>{on ? "Enabled" : "Disabled"}</Pill>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
                When <b className="text-gray-900 dark:text-gray-100">email validation is enabled</b>, every PayIn request from this merchant is checked: the customer email must be a valid address and contain at least one vowel (A, E, I, O, U) in the username part. Requests that fail are rejected before a payment is created.
              </p>
              <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div className="text-[13px] text-gray-700 dark:text-gray-300">
                  <div className="mb-0.5 font-semibold text-gray-900 dark:text-gray-100">How it works</div>
                  The check runs on the PayIn, UPI Intent and payment-link APIs. System-generated addresses such as <span className="font-mono">xyz@123.com</span> are blocked; all standard email providers are accepted. The merchant gets a 422 error with the reason.
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 p-5 dark:border-gray-800">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Validation Rules</h3>
                  <p className="text-[13px] text-gray-500">Email validation criteria for customer emails</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {RULES.map((r) => (
                  <div key={r.title} className="flex flex-col rounded-xl border border-gray-200/80 p-3.5 dark:border-gray-800">
                    <div className="flex gap-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", r.tile)}><r.icon className="h-5 w-5" /></span>
                      <div>
                        <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{r.title}</div>
                        <div className="text-[12px] text-gray-500">{r.text}</div>
                      </div>
                    </div>
                    <div className={cn("mt-3 rounded-lg px-3 py-2 text-[12px]", r.ok ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400")}>
                      {r.ok ? "Valid" : "Invalid"}: <span className="font-mono">{r.example}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={cn(mdCard, "p-5")}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40"><BarChart3 className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Validation Status</h3>
                  <p className="text-[12px] text-gray-500">Current configuration status</p>
                </div>
              </div>
              <div className={cn("flex gap-3 rounded-xl border p-4", on ? "border-green-200 bg-green-50/70 dark:border-green-900/40 dark:bg-green-950/20" : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40")}>
                {on ? <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" /> : <XCircle className="h-6 w-6 shrink-0 text-gray-400" />}
                <div>
                  <div className={cn("text-[14px] font-semibold", on ? "text-green-700 dark:text-green-400" : "text-gray-700 dark:text-gray-300")}>Email Validation is {on ? "Enabled" : "Disabled"}</div>
                  <div className="text-[12px] text-gray-600 dark:text-gray-400">{on ? "Customer emails are validated during payment initiation." : "Customer emails are accepted without this check."}</div>
                </div>
              </div>
              {setting.updated_at && <p className="mt-3 text-[12px] text-gray-500">Last changed {fmtDateTime(setting.updated_at)}{setting.updated_by ? ` by ${setting.updated_by}` : ""}</p>}
            </div>

            <div className={cn(mdCard, "p-5")}>
              <div className="mb-4 flex items-center gap-3">
                <Zap className="h-6 w-6 text-blue-600" />
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Quick Actions</h3>
                  <p className="text-[12px] text-gray-500">Test an address against the rules</p>
                </div>
              </div>
              <form onSubmit={test} className="space-y-2">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">Test Email Address</label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email address to test" className={cn(filterInputCls, "pl-9")} />
                  </div>
                  <button type="submit" disabled={testing || !email.trim()} className={primaryBtn}>
                    {testing && <Loader2 className="h-4 w-4 animate-spin" />} Test Email
                  </button>
                </div>
              </form>
              <h4 className="mb-2 mt-5 flex items-center gap-2 text-[14px] font-semibold text-gray-900 dark:text-gray-100"><FileText className="h-4 w-4 text-blue-600" /> Test Results</h4>
              {!result ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center dark:border-gray-700">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800"><Mail className="h-5 w-5" /></span>
                  <div className="mt-2 text-[13px] font-semibold text-gray-900 dark:text-gray-100">No test performed yet</div>
                  <div className="text-[12px] text-gray-500">Enter an email address and click "Test Email" to check validation.</div>
                </div>
              ) : (
                <div className={cn("rounded-xl border p-4", result.valid ? "border-green-200 bg-green-50/70 dark:border-green-900/40 dark:bg-green-950/20" : "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20")}>
                  <div className="flex items-center gap-2">
                    {result.valid ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-500" />}
                    <span className="break-all font-mono text-[13px] font-medium text-gray-900 dark:text-gray-100">{result.email}</span>
                  </div>
                  <p className={cn("mt-1.5 text-[13px] font-medium", result.valid ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {result.valid ? "Valid — this email would be accepted." : result.reason}
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px] text-gray-600 dark:text-gray-400">
                    <li>{result.checks.format ? "✓" : "✗"} Valid email format</li>
                    <li>{result.checks.vowel ? "✓" : "✗"} Vowel in the username part</li>
                  </ul>
                  {!on && !result.valid && <p className="mt-2 text-[12px] text-gray-500">Validation is disabled, so this email is currently accepted.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
