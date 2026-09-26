import { useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, Globe, Info, KeyRound, Link2, Loader2, Save, Settings, Shield, ShieldCheck, Webhook } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { saveMerchantSettings } from "@/api/merchantAdmin";
import { MdBanner, MdSection, MdStat, Pill } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import type { MdCtx } from "@/components/txn/merchantDetails/mdTypes";

function Field({ icon: Icon, label, value, onChange, placeholder, hint }: { icon: typeof Globe; label: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-gray-700 dark:text-gray-300">
        <Icon className="h-4 w-4 text-gray-500" /> {label}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={filterInputCls} />
      {hint && <span className="mt-1 block text-[12px] text-gray-500">{hint}</span>}
    </label>
  );
}

const mask = (v: string | null) => (v ? `${v.slice(0, 4)}••••••••${v.slice(-4)}` : "—");

export default function CredentialsTab({ ctx }: { ctx: MdCtx }) {
  const { toast } = useToast();
  const s = ctx.settings;
  const [ip, setIp] = useState(s?.ip ?? "");
  const [webhook, setWebhook] = useState(s?.webhook ?? "");
  const [webhookPayout, setWebhookPayout] = useState(s?.webhook_payout ?? "");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  const creds = ctx.creds ?? [];
  const payinActive = creds.some((c) => c.direction === "payin");
  const payoutActive = creds.some((c) => c.direction === "payout");
  const hooks = [s?.webhook, s?.webhook_payout].filter(Boolean).length;
  const dirty = ip !== (s?.ip ?? "") || webhook !== (s?.webhook ?? "") || webhookPayout !== (s?.webhook_payout ?? "");

  const save = async () => {
    for (const [label, url] of [["PayIn webhook", webhook], ["Payout webhook", webhookPayout]] as const)
      if (url.trim() && !/^https?:\/\/\S+$/i.test(url.trim())) return toast({ title: `${label} must start with http:// or https://`, variant: "destructive" });
    setBusy(true);
    try {
      ctx.setSettings(await saveMerchantSettings(ctx.user.id, { ip: ip.trim() || null, webhook: webhook.trim() || null, webhook_payout: webhookPayout.trim() || null }));
      toast({ title: "Configuration saved" });
    } catch (e) {
      toast({ title: "Save failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast({ title: "Copied" }));

  return (
    <div className="space-y-4">
      <MdBanner icon={Link2} title="API Credentials" subtitle="Webhooks, IP whitelist and provider credentials for this merchant" right={<Pill tone={creds.length ? "green" : "amber"}>{creds.length ? "Configured" : "Not Configured"}</Pill>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MdStat icon={Link2} tone="blue" label="PayIn Status" value={payinActive ? "Active" : "Inactive"} sub={`${creds.filter((c) => c.direction === "payin").length} provider credential(s)`} />
        <MdStat icon={Link2} tone="green" label="PayOut Status" value={payoutActive ? "Active" : "Inactive"} sub={`${creds.filter((c) => c.direction === "payout").length} provider credential(s)`} />
        <MdStat icon={Webhook} tone="purple" label="Webhooks" value={`${hooks} of 2`} sub="URLs configured" />
        <MdStat icon={Shield} tone="amber" label="IP Whitelist" value={s?.ip ? "Enabled" : "Open"} sub={s?.ip ? "Requests limited to listed IPs" : "Any IP can call the API"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <MdSection
            icon={Settings}
            title="General Settings"
            subtitle="Callback URLs and allowed IPs"
            right={
              <button type="button" onClick={save} disabled={busy || !dirty} className={primaryBtn}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Configuration
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field icon={Globe} label="IP Address" value={ip} onChange={setIp} placeholder="Allowed IP addresses, comma separated" hint="Leave empty to allow requests from any IP." />
              </div>
              <Field icon={Webhook} label="PayIn Webhook URL" value={webhook} onChange={setWebhook} placeholder="https://merchant.com/webhooks/payin" />
              <Field icon={Webhook} label="Payout Webhook URL" value={webhookPayout} onChange={setWebhookPayout} placeholder="https://merchant.com/webhooks/payout" />
            </div>
          </MdSection>

          <MdSection
            icon={KeyRound}
            title="Provider Credentials"
            subtitle="Active gateway credentials the merchant uses to call the API"
            bodyCls="p-0"
            right={
              creds.length > 0 && (
                <button type="button" onClick={() => setReveal((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                  {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {reveal ? "Hide" : "Show"} keys
                </button>
              )
            }
          >
            {ctx.creds === null ? (
              <div className="flex items-center gap-2 p-5 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : creds.length === 0 ? (
              <p className="p-5 text-[13px] text-gray-500">No active credentials. Map a provider to this merchant in TSP Mappings to generate them.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {creds.map((c) => (
                  <div key={`${c.provider_id}-${c.direction}`} className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{c.provider_name}</span>
                      <Pill tone={c.direction === "payin" ? "blue" : "purple"} className="py-0.5">{c.direction === "payin" ? "PayIn" : "PayOut"}</Pill>
                      <Pill tone="green" className="py-0.5"><CheckCircle2 className="h-3 w-3" /> Active</Pill>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
                      {([["MID", c.mid, false], ["Client ID", c.client_id, false], ["Secret Key", c.secret_key, true], ["Salt Key 1", c.salt_key1, true], ["Salt Key 2", c.salt_key2, true], ["Salt Key 3", c.salt_key3, true]] as const).map(([k, v, secret]) => (
                        <div key={k} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                          <div className="min-w-0">
                            <div className="text-gray-500">{k}</div>
                            <div className="truncate font-mono text-gray-800 dark:text-gray-200">{secret && !reveal ? mask(v) : v || "—"}</div>
                          </div>
                          {v && (
                            <button type="button" onClick={() => copy(v)} aria-label={`Copy ${k}`} className="shrink-0 rounded p-1 text-gray-400 hover:text-indigo-600">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </MdSection>
        </div>

        <div className={cn(mdCard, "h-fit border-amber-200/80 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/10")}>
          <h3 className="mb-4 flex items-center gap-2.5 text-[16px] font-bold text-gray-900 dark:text-gray-100"><Shield className="h-5 w-5 text-orange-500" /> Security Tips</h3>
          <ul className="space-y-4">
            {[
              { icon: ShieldCheck, tone: "text-green-600", title: "Keep Credentials Secure", text: "Never share API keys or post them publicly." },
              { icon: Info, tone: "text-amber-500", title: "Whitelist Server IPs", text: "Limit API calls to the merchant's server IPs in production." },
              { icon: Webhook, tone: "text-blue-600", title: "Use HTTPS Webhooks", text: "Webhook URLs should use https:// so callbacks are encrypted." },
            ].map((t) => (
              <li key={t.title} className="flex gap-3">
                <t.icon className={cn("mt-0.5 h-5 w-5 shrink-0", t.tone)} />
                <div>
                  <div className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>
                  <div className="text-[12px] text-gray-600 dark:text-gray-400">{t.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
