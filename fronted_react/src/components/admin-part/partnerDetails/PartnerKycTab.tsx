// Partner details → KYC & Approval
import { useState } from "react";
import { Building2, CheckCircle2, Clock, FileText, Info, Landmark, ListChecks, Loader2, MapPin, ReceiptText, Shield, ShieldCheck, User, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText } from "@/components/admin-part/listUtils";
import type { KycData, KycItem } from "@/api/kyc";
import { setPartnerKyc, type Partner } from "@/api/partners";
import { ReviewRow } from "@/components/txn/KycReviewDialog";
import { Pill } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, type Tone } from "@/components/txn/merchantDetails/mdStyles";
import { companyTypeLabel, groupState, type GroupState } from "@/components/txn/merchantDetails/mdTypes";

const PILL: Record<GroupState, { tone: Tone; label: string }> = {
  approved: { tone: "green", label: "Completed" },
  pending: { tone: "amber", label: "Under review" },
  rejected: { tone: "red", label: "Rejected" },
  incomplete: { tone: "gray", label: "Pending" },
};

const itemValue = (kyc: KycData | null, key: string) => [...(kyc?.sections.basic ?? []), ...(kyc?.sections.documents ?? [])].find((i) => i.key === key)?.value || null;

export default function PartnerKycTab({ partner, kyc, setKyc, onPartner }: { partner: Partner; kyc: KycData | null; setKyc: (d: KycData) => void; onPartner: (p: Partner) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<"basic" | "documents">("basic");

  const toggle = async (v: boolean) => {
    setSaving(true);
    try {
      onPartner({ ...partner, ...(await setPartnerKyc(partner.id, v)) });
      if (kyc) setKyc({ ...kyc, kyc_verified: v });
      toast({ title: v ? "Partner marked KYC verified" : "KYC verification removed" });
    } catch (e) {
      toast({ title: "Update failed", description: errorText(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!kyc)
    return (
      <div className="flex items-center gap-2 text-[13px] text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading KYC…
      </div>
    );

  const company = groupState(kyc.sections.company);
  const basic = groupState(kyc.sections.basic);
  const docs = kyc.sections.documents.length ? groupState(kyc.sections.documents) : "incomplete";
  const bank: GroupState = kyc.bank.verified ? "approved" : kyc.bank.total ? "pending" : "incomplete";
  const allItems: KycItem[] = [...kyc.sections.company, ...kyc.sections.basic, ...kyc.sections.documents];
  const submitted = allItems.some((i) => i.status !== "not_submitted");
  const final: GroupState = partner.kyc_verified && kyc.progress.percent === 100 ? "approved" : "incomplete";
  const list = sub === "basic" ? kyc.sections.basic : kyc.sections.documents;

  const cards = [
    { title: "KYC Approval", sub: partner.kyc_verified ? "Partner is KYC verified" : "Partner is not KYC verified yet", icon: ShieldCheck, box: "border-purple-100 bg-purple-50/60 dark:border-purple-900/40 dark:bg-purple-950/20", tile: "bg-purple-100 text-purple-600 dark:bg-purple-900/40", toggle: true, state: (partner.kyc_verified ? "approved" : "incomplete") as GroupState, label: partner.kyc_verified ? "Approved" : "Not approved" },
    { title: "Final Approval", sub: final === "approved" ? "All approvals completed" : "Needs KYC approval and every item approved", icon: Shield, box: "border-green-100 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20", tile: "bg-green-100 text-green-600 dark:bg-green-900/40", state: final },
    { title: "Basic Details Approval", sub: `${kyc.sections.basic.filter((i) => i.status === "approved").length} of ${kyc.sections.basic.length} basic details approved`, icon: User, box: "border-green-100 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20", tile: "bg-green-100 text-green-600 dark:bg-green-900/40", state: basic },
    { title: "KYC Documents Approval", sub: kyc.sections.documents.length ? `${kyc.sections.documents.filter((i) => i.status === "approved").length} of ${kyc.sections.documents.length} documents approved` : "Company type not selected", icon: FileText, box: "border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20", tile: "bg-blue-100 text-blue-600 dark:bg-blue-900/40", state: docs },
  ];

  const reqs: { label: string; icon: typeof User; state: GroupState }[] = [
    { label: "Company Type", icon: Building2, state: company },
    { label: "Basic Details", icon: User, state: basic },
    { label: "Full KYC", icon: Shield, state: docs },
    { label: "Bank Account", icon: Landmark, state: bank },
    { label: "Final Approval", icon: CheckCircle2, state: final },
  ];

  const companyRows: [string, typeof User, string | null][] = [
    ["Company Type", Building2, companyTypeLabel(kyc)],
    ["Company Name", Building2, partner.company_name || null],
    ["Business PAN", FileText, itemValue(kyc, "business_pan_id")],
    ["GST Number", ReceiptText, itemValue(kyc, "gstin_id")],
    ["Registered Address", MapPin, itemValue(kyc, "business_address")],
  ];

  return (
    <div className="space-y-4">
      <div className={cn(mdCard, "p-5")}>
        <h3 className="flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-gray-100"><Shield className="h-5 w-5 text-blue-600" /> KYC & Approval Status</h3>
        <p className="mb-4 ml-7 text-[13px] text-gray-500">Manage partner verification and approval status</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cards.map((c) => (
            <div key={c.title} className={cn("flex items-center gap-3 rounded-xl border p-4", c.box)}>
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", c.tile)}><c.icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{c.title}</div>
                <div className="truncate text-[12px] text-gray-500">{c.sub}</div>
              </div>
              <Pill tone={PILL[c.state].tone} className="shrink-0">{c.label ?? PILL[c.state].label}</Pill>
              {c.toggle && (
                <span className="flex items-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
                  <Switch checked={partner.kyc_verified} onCheckedChange={toggle} disabled={saving} aria-label="Partner KYC approval" className="data-[state=checked]:bg-violet-600" />
                </span>
              )}
            </div>
          ))}
        </div>

        <h4 className="mb-3 mt-5 flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100"><ListChecks className="h-5 w-5" /> KYC Requirements</h4>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {reqs.map((r) => (
            <div key={r.label} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30">
              <span className="flex items-center gap-3 text-[13px] font-medium text-gray-800 dark:text-gray-200"><r.icon className="h-4 w-4 text-gray-500" /> {r.label}</span>
              {r.state === "approved" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : r.state === "rejected" ? <XCircle className="h-5 w-5 text-red-500" /> : r.state === "pending" ? <Clock className="h-5 w-5 text-amber-500" /> : <span className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
            </div>
          ))}
        </div>
      </div>

      <div className={cn(mdCard, "space-y-4 p-5")}>
        <div>
          <h3 className="flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-gray-100"><FileText className="h-5 w-5 text-blue-600" /> KYC Documents</h3>
          <p className="ml-7 text-[13px] text-gray-500">Review uploaded KYC documents and basic details</p>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4 dark:border-violet-900/30 dark:bg-violet-950/15 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white"><FileText className="h-6 w-6" /></span>
            <div>
              <div className="text-[16px] font-bold text-gray-900 dark:text-gray-100">KYC Management Dashboard</div>
              <div className="text-[13px] text-gray-600 dark:text-gray-400">Review and approve KYC documents for partner verification</div>
              <div className="mt-1.5 flex gap-2">
                {final === "approved" && <Pill tone="purple" className="bg-violet-600 py-0.5 text-white dark:bg-violet-600 dark:text-white">Fully Approved</Pill>}
                <Pill tone={partner.kyc_verified ? "green" : "amber"} className="py-0.5">{partner.kyc_verified ? <><CheckCircle2 className="h-3.5 w-3.5" /> KYC Verified</> : <><Clock className="h-3.5 w-3.5" /> KYC Pending</>}</Pill>
              </div>
            </div>
          </div>
          <div className="md:w-72">
            <div className="flex justify-between text-[13px]"><span className="text-gray-600 dark:text-gray-400">Verification Progress</span><b className="text-gray-900 dark:text-gray-100">{kyc.progress.percent}%</b></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-gray-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-600" style={{ width: `${kyc.progress.percent}%` }} /></div>
            <div className="mt-1.5 text-right text-[12px] text-gray-500">{kyc.progress.approved} of {kyc.progress.total} items approved</div>
          </div>
        </div>

        {!submitted && (
          <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-[13px] text-gray-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-gray-300">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <span>No KYC details submitted yet. Partners do not have a login panel to upload documents, so verify their documents separately and use the KYC Approval switch above.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800">
            <h4 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100"><Building2 className="h-5 w-5" /> Company Information</h4>
            <dl className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
              {companyRows.map(([k, Icon, v]) => (
                <div key={k} className="grid grid-cols-[170px_1fr] gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-gray-500"><Icon className="h-4 w-4" /> {k}</dt>
                  <dd className={cn("break-words", v ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-400")}>{v ?? "Not submitted"}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800">
            <h4 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100"><Landmark className="h-5 w-5" /> Bank Account Details</h4>
            <dl className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
              <div className="grid grid-cols-[170px_1fr] gap-3 py-2.5"><dt className="text-gray-500">Bank accounts</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{kyc.bank.total}</dd></div>
              <div className="grid grid-cols-[170px_1fr] gap-3 py-2.5"><dt className="text-gray-500">Verified</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{kyc.bank.verified}</dd></div>
              <div className="grid grid-cols-[170px_1fr] gap-3 py-2.5"><dt className="text-gray-500">Status</dt><dd><Pill tone={PILL[bank].tone} className="py-0.5">{bank === "approved" ? "Verified" : bank === "pending" ? "Awaiting approval" : "No bank account"}</Pill></dd></div>
            </dl>
          </div>
        </div>

        <div>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {(["basic", "documents"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSub(k)} className={cn("rounded-lg py-2 text-[13px] font-semibold", sub === k ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400")}>
                {k === "basic" ? "Basic Information" : `KYC Documents (${kyc.sections.documents.length})`}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-[13px] text-gray-500 dark:border-gray-700">The document list appears once a company type is selected.</p>
          ) : (
            <div className="space-y-2">
              {list.map((item) => (
                <ReviewRow key={item.key} item={item} userId={partner.id} onChange={setKyc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
