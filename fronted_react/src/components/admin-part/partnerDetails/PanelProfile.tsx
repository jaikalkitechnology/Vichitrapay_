// Partner panel → Profile & Settings: 4-step KYC wizard + security settings
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CheckCircle2, Copy, CreditCard, Eye, FileText, Headphones, Info, Landmark, Loader2, Shield, ShieldCheck, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { fetchMyKyc, setKycCompanyType, setKycField, uploadKycDocument, type KycData } from "@/api/kyc";
import { addMyBankAccount, fetchMyBankAccounts, fetchPartnerMe, type PartnerBankAccount, type PartnerMe } from "@/api/partnerPanel";
import { KycDocRow, KycField, KycStatusBadge } from "@/components/txn/kycBits";
import ChangePassword from "@/components/txn/changePassword";
import { pCard, pOutline, pPrimary } from "@/components/admin-part/partnerDetails/partnerTabs";

const STEPS = [
  { label: "Company Type", icon: Building2 },
  { label: "Basic Info", icon: User },
  { label: "KYC Documents", icon: FileText },
  { label: "Bank Account", icon: Landmark },
];
const BANK_DOC = "bank_proof_doc";

function BankStep({ kyc, onSaved, onUpload }: { kyc: KycData; onSaved: (k: KycData) => void; onUpload: (key: string, f: File) => Promise<void> }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<PartnerBankAccount[] | null>(null);
  const [f, setF] = useState({ account_holder_name: "", account_number: "", confirm: "", ifsc_code: "", bank_name: "", account_type: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proof = kyc.sections.documents.find((d) => d.key === BANK_DOC);

  const load = useCallback(() => {
    fetchMyBankAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);
  useEffect(load, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.account_holder_name.trim() || !f.account_number.trim() || !f.ifsc_code.trim() || !f.bank_name.trim() || !f.account_type) return setError("Fill in every required field");
    if (!/^\d{6,30}$/.test(f.account_number)) return setError("Account number must be 6–30 digits");
    if (f.account_number !== f.confirm) return setError("Account numbers do not match");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(f.ifsc_code.trim())) return setError("IFSC must look like HDFC0001234");
    setBusy(true);
    try {
      await addMyBankAccount({ account_holder_name: f.account_holder_name.trim(), account_number: f.account_number, ifsc_code: f.ifsc_code.trim().toUpperCase(), bank_name: f.bank_name.trim(), account_type: f.account_type });
      toast({ title: "Bank account added", description: "It will be verified by our team." });
      setF({ account_holder_name: "", account_number: "", confirm: "", ifsc_code: "", bank_name: "", account_type: "" });
      load();
      onSaved(await fetchMyKyc());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof typeof f, label: string, placeholder: string, Icon: typeof User) => (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-gray-800 dark:text-gray-200">{label} <span className="text-red-500">*</span></span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} className={cn(filterInputCls, "h-12 pl-10 text-[14px]")} />
      </div>
    </label>
  );

  return (
    <div className="space-y-5">
      {accounts && accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 px-4 py-3 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-violet-600" />
                <div>
                  <div className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{a.bank_name || "Bank"} {a.account_mask}</div>
                  <div className="text-[12px] text-gray-500">{a.account_holder_name} · {a.ifsc_code}{a.account_type ? ` · ${a.account_type}` : ""}</div>
                </div>
              </div>
              <KycStatusBadge status={a.is_validate ? "approved" : "pending"} />
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {input("account_holder_name", "Account Holder Name", "Full name as per bank records", User)}
          {input("account_number", "Account Number", "Enter account number", CreditCard)}
          {input("ifsc_code", "IFSC Code", "e.g. HDFC0001234", Landmark)}
          {input("bank_name", "Bank Name", "Enter bank name", Landmark)}
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-gray-800 dark:text-gray-200">Account Type <span className="text-red-500">*</span></span>
            <select value={f.account_type} onChange={(e) => setF({ ...f, account_type: e.target.value })} className={cn(filterInputCls, "h-12 text-[14px]")}>
              <option value="">Select account type</option>
              <option value="Savings">Savings</option>
              <option value="Current">Current</option>
            </select>
          </label>
          {input("confirm", "Confirm Account Number", "Re-enter account number", CreditCard)}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className={pPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Add Bank Account</button>
      </form>
      {proof && (
        <div className="rounded-xl border border-violet-200/70 bg-violet-50/30 dark:border-violet-900/40 dark:bg-violet-950/10">
          <KycDocRow key={`${proof.key}-${proof.updated_at}`} item={proof} onSave={async () => undefined} onUpload={onUpload} />
        </div>
      )}
    </div>
  );
}

export default function PanelProfile() {
  const { toast } = useToast();
  const [me, setMe] = useState<PartnerMe | null>(null);
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"kyc" | "security">("kyc");
  const [step, setStep] = useState(0);
  const [typeBusy, setTypeBusy] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    fetchPartnerMe().then(setMe).catch((e) => setError(errorText(e, "Failed to load your profile")));
    fetchMyKyc().then(setKyc).catch((e) => setError(errorText(e, "Failed to load KYC")));
  }, []);

  const saved = (d: KycData, what: string) => {
    setKyc(d);
    toast({ title: `${what} submitted`, description: "It will be reviewed by our team." });
  };
  const onSave = async (key: string, value: string) => saved(await setKycField(key, value), "Details");
  const onUpload = async (key: string, file: File) => saved(await uploadKycDocument(key, file), "Document");
  const changeType = async (v: string) => {
    setTypeBusy(true);
    try {
      saved(await setKycCompanyType(v), "Company type");
    } catch (e) {
      toast({ title: "Could not save", description: errorText(e), variant: "destructive" });
    } finally {
      setTypeBusy(false);
    }
  };

  const pct = kyc?.progress.percent ?? 0;
  const company = kyc?.sections.company[0];
  const typeLabel = kyc?.company_types.find((t) => t.value === kyc.company_type)?.label;
  const docs = (kyc?.sections.documents ?? []).filter((d) => d.key !== BANK_DOC);
  const basicFilled = (kyc?.sections.basic ?? []).filter((i) => i.status !== "not_submitted").length;
  const docsDone = docs.filter((d) => d.status !== "not_submitted").length;
  const stepDone = kyc
    ? [company?.status !== "not_submitted", kyc.sections.basic.every((i) => i.status !== "not_submitted"), docs.length > 0 && docs.every((d) => d.status !== "not_submitted"), kyc.bank.total > 0]
    : [false, false, false, false];

  const copyId = () => me && navigator.clipboard.writeText(me.id).then(() => toast({ title: "Partner ID copied" }));
  const nav = (
    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-800">
      <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className={cn(pOutline, "h-12 px-6")}><ArrowLeft className="h-4 w-4" /> Back</button>
      {step < 3 ? (
        <button type="button" disabled={step === 0 && !kyc?.company_type} onClick={() => setStep(step + 1)} className={cn(pPrimary, "h-12 px-6")}>{step === 0 ? "Next Step" : "Save & Next"} <ArrowRight className="h-4 w-4" /></button>
      ) : (
        <span className="text-[13px] text-gray-500">{pct === 100 ? "Everything is approved." : "Submitted items are reviewed by our team."}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 text-white shadow-xl shadow-violet-600/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-6 right-10 hidden h-28 w-24 rotate-6 rounded-2xl bg-white/20 lg:block" aria-hidden="true">
          <ShieldCheck className="absolute -bottom-3 -right-3 h-12 w-12 text-white drop-shadow" />
        </div>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:pr-40">
          <div>
            <h1 className="text-[30px] font-bold">Profile & Settings</h1>
            <p className="text-[15px] text-white/85">Manage your account, KYC, and company information</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl bg-white/15 px-4 py-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20"><User className="h-5 w-5" /></span>
            <div>
              <div className="text-[12px] text-white/75">Partner ID</div>
              <div className="font-mono text-[15px] font-bold">{me?.id ?? "…"}</div>
            </div>
            <button type="button" onClick={copyId} aria-label="Copy partner ID" className="rounded-lg p-1.5 hover:bg-white/15"><Copy className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="relative mt-5 rounded-2xl bg-white/15 px-5 py-4 lg:mr-40">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6" />
            <span className="text-[16px] font-semibold">KYC Status</span>
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", me?.kyc_verified ? "bg-green-400/30 text-white" : "bg-amber-100 text-amber-800")}>{me?.kyc_verified ? "APPROVED" : "NOT APPROVED"}</span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${me?.kyc_verified ? 100 : pct}%` }} /></div>
            <span className="text-[16px] font-bold">{me?.kyc_verified ? 100 : pct}%</span>
          </div>
          <p className="mt-1.5 text-[13px] text-white/80">{me?.kyc_verified ? "Your partner account is fully verified." : "Complete your KYC verification to unlock all features"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-gray-100/80 p-1 dark:bg-gray-900">
          {([["kyc", "Update KYC", FileText], ["security", "Security Settings", Shield]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex items-center gap-2 rounded-lg px-6 py-2.5 text-[14px] font-medium", tab === id ? "bg-white text-violet-700 shadow-sm dark:bg-gray-800 dark:text-violet-300" : "text-gray-600 dark:text-gray-400")}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowProfile(true)} disabled={!me} className={pOutline}><Eye className="h-4 w-4" /> View Profile</button>
      </div>

      {error && <div className={cn(pCard, "p-5 text-[14px] text-red-600")}>{error}</div>}

      {tab === "security" ? (
        <ChangePassword embedded endpoint="/partner/change-password" />
      ) : !kyc ? (
        !error && <div className="flex items-center gap-2 text-[14px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading KYC…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className={cn(pCard, "overflow-hidden")}>
              <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-blue-50/80 to-violet-50/60 px-5 py-4 dark:from-blue-950/20 dark:to-violet-950/20">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"><FileText className="h-7 w-7" /></span>
                  <div>
                    <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">KYC Verification</h2>
                    <p className="text-[13px] text-gray-600 dark:text-gray-400">Complete all steps to unlock full access to your partner account</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[26px] font-bold text-indigo-700 dark:text-indigo-300">{pct}%</div>
                  <div className="text-[13px] text-gray-500">Approved</div>
                </div>
              </div>
              <ol className="relative grid grid-cols-4 px-4 py-5">
                <div className="absolute left-[12.5%] right-[12.5%] top-[38px] h-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                {STEPS.map((s, i) => (
                  <li key={s.label} className="relative flex flex-col items-center">
                    <button type="button" onClick={() => (i === 0 || kyc.company_type) && setStep(i)} className={cn("flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold", i === step ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40" : stepDone[i] ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300")}>
                      {stepDone[i] && i !== step ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                    </button>
                    <span className={cn("mt-2 text-center text-[13px] font-medium", i === step ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-400")}>{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className={cn(pCard, "overflow-hidden")}>
              {step === 0 && (
                <>
                  <div className="flex items-center gap-3 px-5 pt-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40"><Building2 className="h-5 w-5" /></span>
                    <div>
                      <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Company Information</h3>
                      <p className="text-[13px] text-gray-500">Select your company type to proceed with KYC verification</p>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <label className="block">
                      <span className="mb-1.5 block text-[14px] font-medium text-gray-700 dark:text-gray-300">Company Type <span className="text-red-500">*</span></span>
                      <div className="relative">
                        <select value={kyc.company_type ?? ""} disabled={company?.status === "approved" || typeBusy} onChange={(e) => e.target.value && changeType(e.target.value)} className={cn(filterInputCls, "h-12 text-[14px]")}>
                          <option value="" disabled>Select company type</option>
                          {kyc.company_types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        {typeBusy && <Loader2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-600" />}
                      </div>
                    </label>
                    {typeLabel && (
                      <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div className="text-[13px]">
                          <div className="font-semibold text-blue-800 dark:text-blue-300">Selected: {typeLabel}</div>
                          <div className="text-gray-600 dark:text-gray-400">{company?.status === "approved" ? "Approved — it can no longer be changed." : "You can change this later if required, until it is approved."}</div>
                        </div>
                      </div>
                    )}
                    {company && company.status !== "not_submitted" && <KycStatusBadge status={company.status} />}
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40"><User className="h-5 w-5" /></span>
                      <div>
                        <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Basic Information</h3>
                        <p className="text-[13px] text-gray-500">Essential company details for verification</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[13px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{basicFilled} of {kyc.sections.basic.length} fields submitted</span>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 md:grid-cols-2">
                    {kyc.sections.basic.map((item) => <KycField key={`${item.key}-${item.updated_at}`} item={item} onSave={onSave} wide={item.key === "business_address"} />)}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40"><FileText className="h-5 w-5" /></span>
                      <div>
                        <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">KYC Documents</h3>
                        <p className="text-[13px] text-gray-500">Upload required documents for full verification</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-[13px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{docsDone} of {docs.length} submitted</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 2xl:grid-cols-2">
                    {docs.map((item) => (
                      <div key={`${item.key}-${item.updated_at}`} className="rounded-xl border border-gray-200/80 dark:border-gray-800">
                        <KycDocRow item={item} onSave={onSave} onUpload={onUpload} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40"><Landmark className="h-5 w-5" /></span>
                    <div>
                      <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Bank Account</h3>
                      <p className="text-[13px] text-gray-500">Secure your payment settlements</p>
                    </div>
                  </div>
                  <div className="p-5"><BankStep kyc={kyc} onSaved={setKyc} onUpload={onUpload} /></div>
                </>
              )}
              {nav}
            </div>
          </div>

          <div className="space-y-5">
            <div className={cn(pCard, "p-5")}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><FileText className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">KYC Requirements</h3>
                  <p className="text-[12px] text-gray-500">{typeLabel ? `Documents required for ${typeLabel}` : "Select a company type to see the list"}</p>
                </div>
              </div>
              <ul className="space-y-2 rounded-xl bg-gray-50/70 p-3 dark:bg-gray-800/30">
                {kyc.sections.documents.filter((d) => d.kind === "file").map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 dark:bg-gray-900">
                    <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-medium text-gray-800 dark:text-gray-200"><FileText className="h-4 w-4 shrink-0 text-violet-600" /> <span className="truncate">{d.label}</span></span>
                    {d.status === "approved" ? <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" /> : <KycStatusBadge status={d.status} className="px-2 py-0.5 text-[11px]" />}
                  </li>
                ))}
                {!kyc.company_type && <li className="px-2 py-3 text-[13px] text-gray-500">No company type selected yet.</li>}
              </ul>
            </div>
            <div className={cn(pCard, "flex gap-3 p-5")}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40"><Headphones className="h-5 w-5" /></span>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Need Help?</h3>
                <p className="text-[13px] text-gray-600 dark:text-gray-400">Contact your Vichitrapay account manager for help with KYC verification.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-md">
          {me && (
            <>
              <DialogHeader>
                <DialogTitle>{me.full_name || me.username}</DialogTitle>
                <DialogDescription className="font-mono">{me.id}</DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
                {([["Username", me.username], ["Email", me.email], ["Phone", me.phone_number || "—"], ["Company", me.company_name || "—"], ["KYC", me.kyc_verified ? "Approved" : "Not approved"], ["Joined", me.created_at ? new Date(me.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "—"]] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-2.5"><dt className="text-gray-500">{k}</dt><dd className="break-words font-medium text-gray-900 dark:text-gray-100">{v}</dd></div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
