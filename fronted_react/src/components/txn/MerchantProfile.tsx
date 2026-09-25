// Merchant "Profile & Settings": KYC submission, PG fees and security (change password)
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Landmark,
  Loader2,
  Lock,
  Percent,
  ShieldCheck,
  Store,
  User,
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
  type KycStatus,
  type MerchantFees,
} from "@/api/kyc";
import { KycDocRow, KycField, KycStatusBadge } from "@/components/txn/kycBits";
import ChangePassword from "@/components/txn/changePassword";

type Tab = "kyc" | "fees" | "security";
type GroupState = "approved" | "rejected" | "pending" | "incomplete";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "kyc", label: "Update KYC", icon: FileText },
  { id: "fees", label: "PG Fees & Rates", icon: Percent },
  { id: "security", label: "Security Settings", icon: Lock },
];

const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Overall state of a group of items. */
function groupState(items: KycItem[]): GroupState {
  if (items.length && items.every((i) => i.status === "approved")) return "approved";
  if (items.some((i) => i.status === "rejected")) return "rejected";
  if (items.length && items.every((i) => i.status === "approved" || i.status === "pending")) return "pending";
  return "incomplete";
}

const badgeOf = (state: GroupState): KycStatus => (state === "incomplete" ? "not_submitted" : state);

const SECTION_TINT: Record<GroupState, { box: string; icon: string }> = {
  approved: { box: "border-green-100 bg-green-50/70 dark:border-green-900/40 dark:bg-green-950/20", icon: "text-green-600 dark:text-green-400" },
  rejected: { box: "border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20", icon: "text-violet-600 dark:text-violet-400" },
  pending: { box: "border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20", icon: "text-amber-600 dark:text-amber-400" },
  incomplete: { box: "border-blue-100 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20", icon: "text-blue-600 dark:text-blue-400" },
};

function Section({ id, icon: Icon, title, state, children }: { id: string; icon: typeof User; title: string; state: GroupState; children: React.ReactNode }) {
  const tint = SECTION_TINT[state];
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-2xl border p-3 sm:p-4", tint.box)}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-gray-900", tint.icon)}>
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <KycStatusBadge status={badgeOf(state)} />
      </div>
      <div className="rounded-xl bg-white dark:bg-gray-900">{children}</div>
    </section>
  );
}

function SectionBanner({ items, name }: { items: KycItem[]; name: string }) {
  const state = groupState(items);
  const done = items.filter((i) => i.status === "approved").length;
  const cfg = {
    approved: { cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300", icon: CheckCircle2, text: `${name} approved — every item has been verified successfully.` },
    pending: { cls: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300", icon: Clock, text: `${done} of ${items.length} approved — the rest are waiting for review.` },
    rejected: { cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300", icon: XCircle, text: "Some items were rejected — check the reason on each item, fix it and resubmit." },
    incomplete: { cls: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300", icon: AlertCircle, text: `${items.filter((i) => i.status !== "not_submitted").length} of ${items.length} submitted.` },
  }[state];
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] font-medium", cfg.cls)}>
      <cfg.icon className="h-4 w-4 shrink-0" />
      {cfg.text}
    </div>
  );
}

const STEP_DOT: Record<GroupState, string> = {
  approved: "bg-green-600 text-white shadow-green-600/30",
  rejected: "bg-red-500 text-white shadow-red-500/30",
  pending: "bg-amber-500 text-white shadow-amber-500/30",
  incomplete: "bg-white text-gray-500 ring-2 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700",
};
const STEP_TEXT: Record<GroupState, [string, string]> = {
  approved: ["Approved", "text-green-600 dark:text-green-400"],
  rejected: ["Action", "text-red-600 dark:text-red-400"],
  pending: ["Under review", "text-amber-600 dark:text-amber-400"],
  incomplete: ["To do", "text-gray-500"],
};

function KycTab({ data, setData }: { data: KycData; setData: (d: KycData) => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [typeBusy, setTypeBusy] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  const company = data.sections.company[0];
  const { basic, documents } = data.sections;
  const bankState: GroupState = data.bank.verified > 0 ? "approved" : data.bank.total ? "pending" : "incomplete";
  const saved = (d: KycData, what: string) => {
    setData(d);
    toast({ title: `${what} submitted`, description: "It will be reviewed by our team." });
  };
  const onSave = async (key: string, value: string) => saved(await setKycField(key, value), "Details");
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

  const steps: { id: string; label: string; state: GroupState }[] = [
    { id: "kyc-company", label: "Company Type", state: groupState([company]) },
    { id: "kyc-basic", label: "Basic Info", state: groupState(basic) },
    { id: "kyc-docs", label: "KYC Docs", state: documents.length ? groupState(documents) : "incomplete" },
    { id: "kyc-bank", label: "Bank Account", state: bankState },
  ];
  const pct = data.progress.percent;
  const anySubmitted = [company, ...basic, ...documents].some((i) => i.status !== "not_submitted");
  const overall = data.kyc_verified
    ? { icon: CheckCircle2, tone: "bg-green-50 text-green-600", title: "Verified", sub: "KYC approved", note: "Your account is fully verified." }
    : pct === 100
      ? { icon: Clock, tone: "bg-amber-50 text-amber-500", title: "Final review", sub: "All items approved", note: "Our team is completing the final verification." }
      : anySubmitted
        ? { icon: Clock, tone: "bg-amber-50 text-amber-500", title: "In progress", sub: "Under verification", note: "Complete remaining items to get approved." }
        : { icon: XCircle, tone: "bg-gray-100 text-gray-500", title: "Not verified", sub: "Start verification", note: "Choose your company type to begin." };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-indigo-950/20 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">KYC Management Dashboard</h2>
              <p className="text-[13px] text-gray-600 dark:text-gray-400">Complete your verification to unlock all features</p>
            </div>
          </div>
          <div className="mt-4 text-[13px] font-medium text-gray-700 dark:text-gray-300">Verification progress</div>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white dark:bg-gray-800">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{pct}%</span>
          </div>
          <p className="mt-2 text-[12px] text-gray-600 dark:text-gray-400">
            {data.progress.approved} of {data.progress.total} verification items approved
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-white bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:w-56">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg dark:bg-gray-800", overall.tone)}>
              <overall.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{overall.title}</div>
              <div className="text-[12px] text-gray-600 dark:text-gray-400">{overall.sub}</div>
            </div>
          </div>
          <p className="mt-2.5 text-[12px] text-gray-500">{overall.note}</p>
        </div>
      </div>

      <div className={cn(card, "p-5")}>
        <h3 className="mb-5 flex items-center gap-2.5 text-[16px] font-bold text-gray-900 dark:text-gray-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          Verification Steps
        </h3>
        <ol className="relative grid grid-cols-4">
          <div className="absolute left-[12.5%] right-[12.5%] top-[17px] h-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          {steps.map((s, i) => (
            <li key={s.id} className="relative flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={cn("relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold shadow-md", STEP_DOT[s.state])}
                aria-label={`Go to ${s.label}`}
              >
                {s.state === "approved" ? <Check className="h-5 w-5" strokeWidth={3} /> : s.state === "rejected" ? "!" : s.state === "pending" ? <Clock className="h-4 w-4" /> : i + 1}
              </button>
              <div className={cn("mt-2.5 rounded-lg px-2.5 py-1", s.state === "rejected" && "bg-red-50 dark:bg-red-950/30")}>
                <div className={cn("text-[13px] font-semibold", s.state === "rejected" ? "text-gray-900 dark:text-gray-100" : "text-gray-900 dark:text-gray-100")}>{s.label}</div>
                <div className="text-[12px] text-gray-500">
                  Step {i + 1} · <span className={STEP_TEXT[s.state][1]}>{STEP_TEXT[s.state][0]}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <Section id="kyc-company" icon={Building2} title="Company Information" state={groupState([company])}>
        <div className="space-y-2 p-4">
          <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">Company Type</label>
          <div className="relative md:max-w-md">
            <select
              value={data.company_type ?? ""}
              disabled={company.status === "approved" || typeBusy}
              onChange={(e) => e.target.value && changeType(e.target.value)}
              className={cn(filterInputCls, "disabled:cursor-default disabled:opacity-100")}
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
            {typeBusy && <Loader2 className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />}
          </div>
          {typeError && <p className="text-[12px] font-medium text-red-600">{typeError}</p>}
          <KycStatusBadge status={company.status} />
          {company.status === "rejected" && company.remark && <p className="text-[12px] font-medium text-red-600 dark:text-red-400">Reason: {company.remark}</p>}
        </div>
      </Section>

      <Section id="kyc-basic" icon={User} title="Basic Information" state={groupState(basic)}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 md:grid-cols-2">
          {basic.map((item) => (
            <KycField key={`${item.key}-${item.updated_at}`} item={item} onSave={onSave} wide={item.key === "business_address"} />
          ))}
          <div className="md:col-span-2">
            <SectionBanner items={basic} name="Basic information" />
          </div>
        </div>
      </Section>

      <Section id="kyc-docs" icon={FileText} title="KYC Documents" state={documents.length ? groupState(documents) : "incomplete"}>
        {documents.length === 0 ? (
          <p className="p-4 text-[13px] text-gray-500">Select your company type above to see the documents you need to upload.</p>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {documents.map((item) => (
                <KycDocRow key={`${item.key}-${item.updated_at}`} item={item} onSave={onSave} onUpload={onUpload} />
              ))}
            </div>
            <div className="p-4 pt-1">
              <SectionBanner items={documents} name="KYC documents" />
            </div>
          </>
        )}
      </Section>

      <Section id="kyc-bank" icon={Landmark} title="Bank Account" state={bankState}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-gray-600 dark:text-gray-300">
            {bankState === "approved"
              ? `${data.bank.verified} verified payout bank account${data.bank.verified === 1 ? "" : "s"} on file.`
              : data.bank.total
                ? `${data.bank.total} bank account${data.bank.total === 1 ? " is" : "s are"} waiting for admin verification.`
                : "Add a payout bank account — a verified account completes the last step."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/merchant/bankAccount")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-950/40"
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
          <li>Upload documents as PDF, JPG or PNG, up to 10 MB each.</li>
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

function KycStatusCard({ data }: { data: KycData | null }) {
  const pct = data ? (data.kyc_verified ? 100 : data.progress.percent) : 0;
  const verified = !!data?.kyc_verified;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/40 to-purple-50/60 p-5 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-indigo-950/20 dark:to-purple-950/20 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">KYC Status</h2>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-800">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{data ? `${pct}%` : "…"}</span>
          </div>
          <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-400">
            {verified ? "Your KYC is approved — all features of Vichitrapay are unlocked." : "Complete your KYC verification to unlock all features of Vichitrapay."}
          </p>
          {data && (
            <p className="text-[12px] text-gray-500">
              {data.progress.approved} of {data.progress.total} verification items approved
            </p>
          )}
        </div>
      </div>
      {data && (
        <div className={cn("shrink-0 rounded-xl p-4 md:w-64", verified ? "bg-green-50/80 dark:bg-green-950/20" : "bg-red-50/70 dark:bg-red-950/20")}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold tracking-wide",
              verified ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
            )}
          >
            {verified ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {verified ? "APPROVED" : "NOT APPROVED"}
          </span>
          <p className="mt-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-400">
            {verified ? "Your account has full access, including live PayIn." : "Please complete the remaining verification items to get full access."}
          </p>
        </div>
      )}
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

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-5 dark:border-gray-800 dark:from-indigo-950/40 dark:via-gray-900 dark:to-purple-950/30 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rotate-45 bg-gradient-to-b from-purple-200/40 to-transparent dark:from-purple-500/10" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-[30px]">Profile & Settings</h1>
            <p className="text-[14px] text-gray-600 dark:text-gray-400">Manage your account, KYC and company information</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-gray-900 sm:self-auto">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[12px] text-gray-500">Merchant ID</div>
              <div className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{data?.merchant_id ?? "…"}</div>
            </div>
          </div>
        </div>
      </div>

      {tab === "kyc" && !error && <KycStatusCard data={data} />}

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-[13px] font-semibold transition sm:text-[14px]",
              tab === t.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
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
            <button type="button" onClick={load} className="font-medium text-blue-600 hover:underline">
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
      {tab === "security" && <ChangePassword embedded />}
    </div>
  );
}
