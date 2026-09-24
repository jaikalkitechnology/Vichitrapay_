// Merchant "Profile & Settings": KYC submission, PG fees and security (change password)
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  Landmark,
  Loader2,
  Percent,
  ShieldCheck,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import {
  fetchMyFees,
  fetchMyKyc,
  setKycCompanyType,
  setKycField,
  uploadKycDocument,
  type KycData,
  type KycItem,
  type MerchantFees,
} from "@/api/kyc";
import { KycItemCard, KycStatusBadge, KycStatusLine } from "@/components/txn/kycBits";
import ChangePassword from "@/components/txn/changePassword";

type Tab = "kyc" | "fees" | "security";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "kyc", label: "Update KYC", icon: FileCheck2 },
  { id: "fees", label: "PG Fees & Rates", icon: Percent },
  { id: "security", label: "Security Settings", icon: ShieldCheck },
];

const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Overall state of a group of items. */
function groupState(items: KycItem[]): "approved" | "rejected" | "pending" | "incomplete" {
  if (items.length && items.every((i) => i.status === "approved")) return "approved";
  if (items.some((i) => i.status === "rejected")) return "rejected";
  if (items.length && items.every((i) => i.status === "approved" || i.status === "pending")) return "pending";
  return "incomplete";
}

/** Section-level badge status for a group of items. */
const groupBadge = (items: KycItem[]) => {
  const state = groupState(items);
  return state === "incomplete" ? "not_submitted" : state;
};

function SectionBanner({ items, name }: { items: KycItem[]; name: string }) {
  const state = groupState(items);
  const done = items.filter((i) => i.status === "approved").length;
  const cfg = {
    approved: { cls: "border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300", icon: CheckCircle2, title: `${name} approved`, sub: "Every item in this section has been verified and approved." },
    pending: { cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300", icon: Clock, title: `${name} under review`, sub: `${done} of ${items.length} approved — the rest are waiting for review.` },
    rejected: { cls: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300", icon: XCircle, title: "Some items were rejected", sub: "Check the reason on each rejected item, fix it and resubmit." },
    incomplete: { cls: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300", icon: AlertCircle, title: `${name} incomplete`, sub: `${items.filter((i) => i.status !== "not_submitted").length} of ${items.length} submitted.` },
  }[state];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3", cfg.cls)}>
      <cfg.icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-[13px] font-semibold">{cfg.title}</div>
        <div className="text-[12px] opacity-80">{cfg.sub}</div>
      </div>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  subtitle,
  tint,
  badge,
  children,
}: {
  id: string;
  icon: typeof User;
  title: string;
  subtitle: string;
  tint: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn(card, "scroll-mt-24 overflow-hidden")}>
      <div className={cn("flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800", tint)}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 text-indigo-600 shadow-sm dark:bg-gray-900/60 dark:text-indigo-400">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-[12px] text-gray-500">{subtitle}</p>
          </div>
        </div>
        {badge}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function KycTab({ data, setData }: { data: KycData; setData: (d: KycData) => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [typeBusy, setTypeBusy] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const company = data.sections.company[0];
  const { basic, documents } = data.sections;
  const bankDone = data.bank.verified > 0;
  const saved = (d: KycData, what: string) => {
    setData(d);
    toast({ title: `${what} submitted`, description: "It will be reviewed by our team." });
  };
  const onSaveText = async (key: string, value: string) => saved(await setKycField(key, value), "Details");
  const onUpload = async (key: string, file: File) => saved(await uploadKycDocument(key, file), "Document");

  const changeType = async (v: string) => {
    setTypeBusy(true);
    setTypeError(null);
    try {
      saved(await setKycCompanyType(v), "Company type");
    } catch (e) {
      setTypeError(errorText(e));
    } finally {
      setTypeBusy(false);
    }
  };

  const steps = [
    { id: "kyc-company", label: "Company Type", icon: Building2, state: groupState([company]) },
    { id: "kyc-basic", label: "Basic Info", icon: UserCheck, state: groupState(basic) },
    { id: "kyc-docs", label: "KYC Docs", icon: FileCheck2, state: documents.length ? groupState(documents) : "incomplete" },
    { id: "kyc-bank", label: "Bank Account", icon: Landmark, state: bankDone ? "approved" : data.bank.total ? "pending" : "incomplete" },
  ] as const;
  const firstOpen = steps.findIndex((s) => s.state !== "approved");
  const pct = data.progress.percent;
  const overall = data.kyc_verified
    ? { icon: CheckCircle2, title: "Verified", sub: "KYC approved" }
    : pct === 100
      ? { icon: Clock, title: "Final review", sub: "All items approved" }
      : [company, ...basic, ...documents].some((i) => i.status !== "not_submitted")
        ? { icon: Clock, title: "In progress", sub: "Under verification" }
        : { icon: XCircle, title: "Not verified", sub: "Start verification" };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-indigo-600/20 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[19px] font-bold">KYC Management Dashboard</h2>
                <p className="text-[13px] text-white/75">Complete your verification to unlock all features</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between text-[13px]">
              <span className="font-medium text-white/85">Verification progress</span>
              <span className="font-bold">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-white/75">
              {data.progress.approved} of {data.progress.total} verification items approved
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-center">
            <overall.icon className="h-7 w-7" />
            <div className="mt-1.5 text-[14px] font-semibold">{overall.title}</div>
            <div className="text-[11px] text-white/70">{overall.sub}</div>
          </div>
        </div>
      </div>

      <div className={cn(card, "p-5")}>
        <h3 className="mb-3 text-[14px] font-semibold text-gray-900 dark:text-gray-100">Verification Steps</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition hover:shadow-sm",
                i === firstOpen ? "border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-500/10 dark:border-indigo-700 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-800",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  s.state === "approved" ? "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400" : s.state === "rejected" ? "bg-red-50 text-red-600 dark:bg-red-950/40" : s.state === "pending" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40" : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                )}
              >
                {s.state === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{s.label}</span>
                <span className="block text-[11px] text-gray-500">
                  Step {i + 1} · {{ approved: "Approved", pending: "Under review", rejected: "Action needed", incomplete: "To do" }[s.state]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Section id="kyc-company" icon={Building2} title="Company Information" subtitle="Select your company type — it decides which documents are needed" tint="bg-indigo-50/60 dark:bg-indigo-950/20" badge={<KycStatusBadge status={company.status} />}>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Company Type</span>
          <div className="relative">
            <select
              value={data.company_type ?? ""}
              disabled={company.status === "approved" || typeBusy}
              onChange={(e) => e.target.value && changeType(e.target.value)}
              className={cn(filterInputCls, "disabled:cursor-default disabled:opacity-80")}
            >
              <option value="" disabled>
                Select company type
              </option>
              {data.company_types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {typeBusy && <Loader2 className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-600" />}
          </div>
        </label>
        {typeError && <p className="text-[12px] font-medium text-red-600">{typeError}</p>}
        {company.status !== "not_submitted" && <KycStatusLine item={company} />}
      </Section>

      <Section id="kyc-basic" icon={User} title="Basic Information" subtitle="Essential company details for verification" tint="bg-green-50/60 dark:bg-green-950/20" badge={<KycStatusBadge status={groupBadge(basic)} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {basic.map((item) => (
            <KycItemCard key={`${item.key}-${item.updated_at}`} item={item} onSaveText={onSaveText} onUpload={onUpload} />
          ))}
        </div>
        <SectionBanner items={basic} name="Basic information" />
      </Section>

      <Section id="kyc-docs" icon={FileCheck2} title="KYC Documents" subtitle="Upload the required documents for full verification" tint="bg-pink-50/60 dark:bg-pink-950/20" badge={documents.length ? <KycStatusBadge status={groupBadge(documents)} /> : undefined}>
        {documents.length === 0 ? (
          <p className="text-[13px] text-gray-500">Select your company type above to see the documents you need to upload.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {documents.map((item) => (
                <KycItemCard key={`${item.key}-${item.updated_at}`} item={item} onSaveText={onSaveText} onUpload={onUpload} />
              ))}
            </div>
            <SectionBanner items={documents} name="KYC documents" />
          </>
        )}
      </Section>

      <Section id="kyc-bank" icon={Landmark} title="Bank Account" subtitle="A verified payout bank account completes the last step" tint="bg-sky-50/60 dark:bg-sky-950/20" badge={<KycStatusBadge status={bankDone ? "approved" : data.bank.total ? "pending" : "not_submitted"} />}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-gray-600 dark:text-gray-300">
            {bankDone
              ? `${data.bank.verified} verified payout bank account${data.bank.verified === 1 ? "" : "s"} on file.`
              : data.bank.total
                ? `${data.bank.total} bank account${data.bank.total === 1 ? " is" : "s are"} waiting for admin verification.`
                : "You have not added a payout bank account yet."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/merchant/bankAccount")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Landmark className="h-4 w-4" /> {data.bank.total ? "Manage payout accounts" : "Add bank account"}
          </button>
        </div>
      </Section>

      <div className={cn(card, "p-5")}>
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
          <CheckCircle2 className="h-4 w-4 text-green-600" /> KYC Guidelines
        </h3>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] text-gray-600 dark:text-gray-300">
          <li>Documents must be clear, complete and valid (not expired).</li>
          <li>Upload documents as PDF, JPG or PNG, up to 5 MB each.</li>
          <li>Each item is reviewed separately. Approved items are locked; rejected items show the reason so you can fix and resubmit.</li>
          <li>Once every item is approved, our team completes the final verification of your account.</li>
        </ul>
      </div>
    </div>
  );
}

function FeesTab() {
  const [fees, setFees] = useState<MerchantFees | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchMyFees()
      .then(setFees)
      .catch((e) => setError(errorText(e, "Failed to load fees")));
  }, []);

  if (error) return <p className="text-[13px] text-red-600">{error}</p>;
  if (!fees)
    return (
      <div className="flex items-center gap-2 text-[13px] text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fees…
      </div>
    );
  if (!fees.configured)
    return <div className={cn(card, "p-5 text-[13px] text-gray-500")}>Your fees have not been set up yet. Contact support to have your PG rates configured.</div>;

  const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";
  const td = "px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "PayIn fee", value: `${fees.payin.percent}%`, sub: "of each successful PayIn", tone: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400" },
          { label: `Payout up to ${inr(fees.payout.flat_up_to)}`, value: inr(fees.payout.flat), sub: "flat per payout", tone: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" },
          { label: `Payout above ${inr(fees.payout.flat_up_to)}`, value: `${fees.payout.percent}%`, sub: "of the payout amount", tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" },
        ].map((f) => (
          <div key={f.label} className={cn(card, "flex items-center gap-4 p-5")}>
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", f.tone)}>
              <Percent className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[13px] text-gray-500">{f.label}</div>
              <div className="text-[22px] font-bold text-gray-900 dark:text-gray-100">{f.value}</div>
              <div className="text-[12px] text-gray-500">{f.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-gray-500">GST at {fees.gst_percent}% is charged on every fee.</p>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={cn(card, "overflow-hidden")}>
          <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">PayIn examples</h3>
            <p className="text-[12px] text-gray-500">Fee and GST are deducted; the rest is credited to your wallet</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                <tr>
                  <th className={th}>Amount</th>
                  <th className={th}>Fee</th>
                  <th className={th}>GST</th>
                  <th className={th}>You receive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {fees.payin.examples.map((e) => (
                  <tr key={e.amount}>
                    <td className={cn(td, "font-medium")}>{inr(e.amount)}</td>
                    <td className={td}>{inr(e.charges)}</td>
                    <td className={td}>{inr(e.gst)}</td>
                    <td className={cn(td, "font-semibold text-green-700 dark:text-green-400")}>{inr(e.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={cn(card, "overflow-hidden")}>
          <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Payout examples (API)</h3>
            <p className="text-[12px] text-gray-500">Amount plus fee and GST is debited from your payout wallet</p>
          </div>
          <div className="overflow-x-auto">
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
                {fees.payout.examples.map((e) => (
                  <tr key={e.amount}>
                    <td className={cn(td, "font-medium")}>{inr(e.amount)}</td>
                    <td className={td}>{inr(e.charges)}</td>
                    <td className={td}>{inr(e.gst)}</td>
                    <td className={cn(td, "font-semibold text-gray-900 dark:text-gray-100")}>{inr(e.total_debit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MerchantProfile({ initialTab = "kyc" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<KycData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchMyKyc()
      .then(setData)
      .catch((e) => setError(errorText(e, "Failed to load your KYC details")));
  }, []);
  useEffect(load, [load]);
  useEffect(() => setTab(initialTab), [initialTab]);

  const pct = data?.progress.percent ?? 0;
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-5 text-white shadow-lg shadow-indigo-600/20 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold">Profile & Settings</h1>
            <p className="text-[13px] text-white/75">Manage your account, KYC and company information</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-xl bg-white/15 px-3.5 py-2">
            <User className="h-4 w-4" />
            <div>
              <div className="text-[11px] text-white/70">Merchant ID</div>
              <div className="font-mono text-[13px] font-semibold">{data?.merchant_id ?? "…"}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" /> KYC Status
            </span>
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide", data?.kyc_verified ? "bg-green-400/25 text-green-50" : "bg-white/20")}>
              {data ? (data.kyc_verified ? "APPROVED" : "NOT APPROVED") : "…"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${data?.kyc_verified ? 100 : pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-white/75">
            {data?.kyc_verified ? "Your account is fully verified." : "Complete your KYC verification to unlock all features, including live PayIn."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-gray-200/70 bg-gray-100/70 p-1 dark:border-gray-800 dark:bg-gray-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium transition",
              tab === t.id ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200",
            )}
          >
            <t.icon className="hidden h-4 w-4 sm:block" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kyc" &&
        (error ? (
          <div className={cn(card, "flex items-center justify-between gap-3 p-5 text-[13px] text-red-600")}>
            {error}
            <button type="button" onClick={load} className="font-medium text-indigo-600 hover:underline">
              Retry
            </button>
          </div>
        ) : !data ? (
          <div className="flex items-center gap-2 text-[13px] text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading KYC details…
          </div>
        ) : (
          <KycTab data={data} setData={setData} />
        ))}
      {tab === "fees" && <FeesTab />}
      {tab === "security" && (
        <ChangePassword embedded />
      )}
    </div>
  );
}
