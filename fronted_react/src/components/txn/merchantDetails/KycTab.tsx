import { useState } from "react";
import { Building2, CheckCircle2, Clock, Download, FileText, Loader2, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText } from "@/components/admin-part/listUtils";
import { setMerchantKycVerified, type KycItem } from "@/api/kyc";
import { ReviewRow } from "@/components/txn/KycReviewDialog";
import { MdBanner, Pill } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, outlineBtn, primaryBtn } from "@/components/txn/merchantDetails/mdStyles";
import { companyTypeLabel, groupState, type GroupState, type MdCtx } from "@/components/txn/merchantDetails/mdTypes";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default function KycTab({ ctx }: { ctx: MdCtx }) {
  const { toast } = useToast();
  const [sub, setSub] = useState<"basic" | "documents">("basic");
  const [saving, setSaving] = useState(false);
  const { kyc, user } = ctx;

  if (!kyc)
    return (
      <div className="flex items-center gap-2 text-[13px] text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading KYC…
      </div>
    );

  const all: KycItem[] = [...kyc.sections.company, ...kyc.sections.basic, ...kyc.sections.documents];
  const underReview = all.filter((i) => i.status === "pending").length;
  const uploaded = kyc.sections.documents.filter((d) => d.kind === "file" && d.has_file).length;
  const fileTotal = kyc.sections.documents.filter((d) => d.kind === "file").length;
  const lastUpdated = all.map((i) => i.updated_at).filter(Boolean).sort().pop();
  const list = sub === "basic" ? kyc.sections.basic : kyc.sections.documents;

  const toggleFinal = async () => {
    setSaving(true);
    try {
      await setMerchantKycVerified(user.id, !kyc.kyc_verified);
      ctx.setKyc({ ...kyc, kyc_verified: !kyc.kyc_verified });
      ctx.reload();
      toast({ title: kyc.kyc_verified ? "Final approval removed" : "Final approval granted", description: kyc.kyc_verified ? "Live PayIn is blocked again for this merchant." : "The merchant can now use live PayIn." });
    } catch (e) {
      toast({ title: "Update failed", description: errorText(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [["Section", "Item", "Value / File", "Status", "Reason", "Updated"]];
    (["company", "basic", "documents"] as const).forEach((s) =>
      kyc.sections[s].forEach((i) =>
        rows.push([s, i.label, i.kind === "file" ? i.file_name ?? "" : i.kind === "select" ? companyTypeLabel(kyc) ?? "" : i.value ?? "", i.status, i.remark ?? "", i.updated_at ?? ""]),
      ),
    );
    rows.push(["bank", "Payout bank accounts", `${kyc.bank.verified} verified of ${kyc.bank.total}`, kyc.bank.verified ? "approved" : "not_submitted", "", ""]);
    rows.push(["account", "Final KYC approval", "", kyc.kyc_verified ? "approved" : "pending", "", ""]);
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kyc-${user.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const checklist: { label: string; state: GroupState }[] = [
    { label: "Company type selected", state: groupState(kyc.sections.company) },
    { label: "Basic details verified", state: groupState(kyc.sections.basic) },
    { label: "KYC documents verified", state: kyc.sections.documents.length ? groupState(kyc.sections.documents) : "incomplete" },
    { label: "Bank details verified", state: kyc.bank.verified ? "approved" : kyc.bank.total ? "pending" : "incomplete" },
  ];

  return (
    <div className="space-y-4">
      <MdBanner icon={FileText} title="KYC Setting" subtitle="Review the merchant's KYC details and documents" />

      <div className={cn(mdCard, "flex flex-col gap-5 border-purple-100 bg-purple-50/30 p-5 dark:border-purple-900/30 dark:bg-purple-950/10 md:flex-row md:items-center")}>
        <div className="flex flex-1 gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">KYC Management Dashboard</h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-400">Review and approve KYC documents for merchant verification</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {underReview > 0 && <Pill tone="purple" className="bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white">{underReview} under review</Pill>}
              <Pill tone={kyc.kyc_verified ? "green" : "amber"}>
                {kyc.kyc_verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />} {kyc.kyc_verified ? "KYC Verified" : "KYC Pending"}
              </Pill>
            </div>
          </div>
        </div>
        <div className="md:w-80">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-600 dark:text-gray-400">Verification Progress</span>
            <span className="text-[16px] font-bold text-indigo-700 dark:text-indigo-300">{kyc.progress.percent}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-purple-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${kyc.progress.percent}%` }} />
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
            <FileText className="h-3.5 w-3.5" /> {uploaded} of {fileTotal || "—"} documents uploaded · {kyc.progress.approved}/{kyc.progress.total} items approved
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className={cn(mdCard, "p-5")}>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Building2 className="h-5 w-5" /></span>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Company Information</h3>
                <p className="text-[12px] text-gray-500">The company type decides which documents the merchant uploads</p>
              </div>
            </div>
            <ReviewRow item={kyc.sections.company[0]} userId={user.id} companyLabel={companyTypeLabel(kyc) ?? undefined} onChange={ctx.setKyc} />
          </div>

          <div className={cn(mdCard, "p-4")}>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              {(["basic", "documents"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setSub(k)} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-semibold", sub === k ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400")}>
                  <FileText className="h-4 w-4" /> {k === "basic" ? "Basic Information" : `KYC Documents (${kyc.sections.documents.length})`}
                </button>
              ))}
            </div>
            {list.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/40 p-4 dark:border-purple-900/30 dark:bg-purple-950/20">
                <FileText className="h-6 w-6 text-purple-600" />
                <div>
                  <div className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">No documents yet</div>
                  <div className="text-[12px] text-gray-500">The document list appears once the merchant selects a company type.</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((item) => (
                  <ReviewRow key={item.key} item={item} userId={user.id} onChange={ctx.setKyc} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn(mdCard, "h-fit p-5")}>
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Quick Actions</h3>
          <p className="mb-4 text-[12px] text-gray-500">Manage KYC verification</p>
          <button type="button" onClick={toggleFinal} disabled={saving} className={cn(kyc.kyc_verified ? outlineBtn : primaryBtn, "w-full", kyc.kyc_verified && "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400")}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : kyc.kyc_verified ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {kyc.kyc_verified ? "Remove Final Approval" : "Grant Final Approval"}
          </button>
          {!kyc.kyc_verified && kyc.progress.percent < 100 && <p className="mt-1.5 text-[11px] text-amber-600">{kyc.progress.total - kyc.progress.approved} items are not approved yet.</p>}
          <button type="button" onClick={exportCsv} className={cn(outlineBtn, "mt-3 w-full")}>
            <Download className="h-4 w-4" /> Export KYC Report
          </button>
          <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
            <h4 className="mb-2.5 text-[14px] font-semibold text-gray-900 dark:text-gray-100">Verification Checklist</h4>
            <ul className="space-y-2">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2.5 text-[13px] text-gray-600 dark:text-gray-300">
                  <span className={cn("h-2.5 w-2.5 rounded-full", { approved: "bg-green-500", pending: "bg-amber-400", rejected: "bg-red-500", incomplete: "bg-gray-300 dark:bg-gray-600" }[c.state])} />
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
          {lastUpdated && <p className="mt-5 text-[12px] text-gray-500">Last updated: {new Date(lastUpdated).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
      </div>
    </div>
  );
}
