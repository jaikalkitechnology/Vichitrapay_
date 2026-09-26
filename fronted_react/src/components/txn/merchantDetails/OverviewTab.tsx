import { useState } from "react";
import { Building2, CheckCircle2, Copy, CreditCard, FileText, Landmark, ListChecks, Loader2, Pencil, ShieldCheck, User, UserCheck, Wallet, XCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { updateMerchant } from "@/api/apiHelper";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { MdSection, Pill } from "@/components/txn/merchantDetails/mdBits";
import { mdCard, outlineBtn, primaryBtn, type Tone } from "@/components/txn/merchantDetails/mdStyles";
import { businessAddress, companyTypeLabel, fmtDateTime, groupState, inr, type GroupState, type MdCtx } from "@/components/txn/merchantDetails/mdTypes";

const STATE_PILL: Record<GroupState, { tone: Tone; label: string }> = {
  approved: { tone: "green", label: "Approved" },
  pending: { tone: "amber", label: "Under review" },
  rejected: { tone: "red", label: "Rejected" },
  incomplete: { tone: "gray", label: "Incomplete" },
};

function EditDialog({ ctx, open, onClose }: { ctx: MdCtx; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const u = ctx.user;
  const [form, setForm] = useState({ full_name: u.full_name ?? "", email: u.email, phone_number: u.phone_number ?? "", username: u.username, company_name: u.company_name ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateMerchant(u.id, form);
      toast({ title: "Merchant updated" });
      ctx.reload();
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const field = (k: keyof typeof form, label: string, type = "text") => (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={filterInputCls} />
    </label>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit merchant</DialogTitle>
          <DialogDescription>Update {u.username}'s account details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          {field("full_name", "Name")}
          {field("email", "Email", "email")}
          <div className="grid grid-cols-2 gap-3">
            {field("phone_number", "Phone")}
            {field("username", "Username")}
          </div>
          {field("company_name", "Company")}
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={outlineBtn}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function OverviewTab({ ctx }: { ctx: MdCtx }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const { user: u, kyc } = ctx;

  const company = kyc ? groupState(kyc.sections.company) : "incomplete";
  const basic = kyc ? groupState(kyc.sections.basic) : "incomplete";
  const docs = kyc && kyc.sections.documents.length ? groupState(kyc.sections.documents) : "incomplete";
  const bank: GroupState = kyc ? (kyc.bank.verified > 0 ? "approved" : kyc.bank.total ? "pending" : "incomplete") : "incomplete";
  const overall: GroupState = u.kyc_verified ? "approved" : kyc && (kyc.progress.approved > 0 || [company, basic, docs].includes("pending")) ? "pending" : "incomplete";

  const rows: [string, React.ReactNode][] = [
    ["Name", u.full_name || "—"],
    ["Email", u.email],
    ["Phone", u.phone_number || "—"],
    ["Username", u.username],
    ["Company", u.company_name || "—"],
    ["Address", businessAddress(kyc) || <span className="text-gray-400">Not submitted in KYC</span>],
    ["KYC Status", <Pill key="k" tone={u.kyc_verified ? "green" : "amber"}>{u.kyc_verified ? "Verified" : "Pending"}</Pill>],
    ["Business Type", companyTypeLabel(kyc) || <span className="text-gray-400">Not selected</span>],
    ["Registered On", fmtDateTime(u.created_at)],
  ];

  const approvals: { title: string; sub: string; icon: typeof User; state: GroupState; card: string; tile: string }[] = [
    { title: "KYC Documents", sub: kyc ? `${kyc.sections.documents.filter((d) => d.status === "approved").length} of ${kyc.sections.documents.length} approved` : "—", icon: FileText, state: docs, card: "border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20", tile: "bg-blue-100 text-blue-600 dark:bg-blue-900/40" },
    { title: "Final Approval", sub: u.kyc_verified ? "Account KYC verified" : "Requires final approval", icon: CheckCircle2, state: u.kyc_verified ? "approved" : "incomplete", card: "border-green-100 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20", tile: "bg-green-100 text-green-600 dark:bg-green-900/40" },
    { title: "Basic Details", sub: "Mobile, email and business address", icon: User, state: basic, card: "border-purple-100 bg-purple-50/60 dark:border-purple-900/40 dark:bg-purple-950/20", tile: "bg-purple-100 text-purple-600 dark:bg-purple-900/40" },
    { title: "Company Type", sub: companyTypeLabel(kyc) ?? "Not selected yet", icon: Building2, state: company, card: "border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20", tile: "bg-amber-100 text-amber-600 dark:bg-amber-900/40" },
  ];

  const checklist: { label: string; icon: typeof User; state: GroupState }[] = [
    { label: "Company Type", icon: Building2, state: company },
    { label: "Basic Details", icon: UserCheck, state: basic },
    { label: "KYC Documents", icon: FileText, state: docs },
    { label: "Bank Account", icon: Landmark, state: bank },
    { label: "Final Approval", icon: ShieldCheck, state: u.kyc_verified ? "approved" : "incomplete" },
  ];

  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast({ title: "Copied", description: v }));
  const mids = (ctx.creds ?? []).filter((c) => c.mid);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <MdSection icon={User} title="Merchant Information" right={<button type="button" onClick={() => setEditing(true)} className={cn(outlineBtn, "px-3 py-1.5")}><Pencil className="h-4 w-4" /> Edit</button>} bodyCls="px-5 py-2">
          <dl className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 text-[13px]">
                <dt className="text-gray-500">{k}</dt>
                <dd className="min-w-0 break-words font-medium text-gray-900 dark:text-gray-100">{v}</dd>
              </div>
            ))}
          </dl>
        </MdSection>

        <MdSection icon={ShieldCheck} title="KYC & Approval Status" subtitle="Merchant verification and approval status" right={<span className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-[12px] text-gray-500 dark:border-gray-700 sm:inline-flex">Overall <Pill tone={STATE_PILL[overall].tone} className="py-0.5">{u.kyc_verified ? "Verified" : overall === "pending" ? "Pending" : "Not started"}</Pill></span>}>
          {!kyc ? (
            <div className="flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading KYC…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {approvals.map((a) => (
                  <button key={a.title} type="button" onClick={() => ctx.goTab("kyc")} className={cn("flex items-center gap-3 rounded-xl border p-3.5 text-left transition hover:shadow-md", a.card)}>
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", a.tile)}>
                      <a.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">{a.title}</span>
                        <Pill tone={STATE_PILL[a.state].tone} className="shrink-0 px-2 py-0.5 text-[11px]">{a.state === "incomplete" ? "Pending" : STATE_PILL[a.state].label}</Pill>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-gray-500">{a.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
                <h4 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-gray-900 dark:text-gray-100"><ListChecks className="h-4 w-4" /> KYC Requirements</h4>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {checklist.map((c) => (
                    <div key={c.label} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-700 dark:bg-gray-900">
                      <span className="flex items-center gap-2.5 text-[13px] font-medium text-gray-800 dark:text-gray-200"><c.icon className="h-4 w-4 text-gray-500" /> {c.label}</span>
                      {c.state === "approved" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : c.state === "rejected" ? <XCircle className="h-5 w-5 text-red-500" /> : c.state === "pending" ? <Clock className="h-5 w-5 text-amber-500" /> : <span className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </MdSection>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[
          { label: "PayIn Wallet", value: u.wallet?.balance, icon: Wallet, tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40" },
          { label: "Payout Wallet", value: u.payout_wallet?.balance, icon: Landmark, tone: "bg-green-50 text-green-600 dark:bg-green-950/40" },
        ].map((w) => (
          <div key={w.label} className={cn(mdCard, "flex items-center gap-4 p-4")}>
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", w.tone)}><w.icon className="h-5 w-5" /></span>
            <div className="flex-1">
              <div className="text-[13px] text-gray-500">{w.label} balance</div>
              <div className="text-[20px] font-bold text-gray-900 dark:text-gray-100">{inr(w.value)}</div>
            </div>
            <button type="button" onClick={() => ctx.goTab("balance")} className={cn(outlineBtn, "px-3 py-1.5")}>Manage</button>
          </div>
        ))}
      </div>

      <MdSection icon={CreditCard} title="Payin Configuration" subtitle="Provider MIDs assigned to this merchant" right={<button type="button" onClick={() => ctx.goTab("credentials")} className={cn(outlineBtn, "px-3 py-1.5")}><Pencil className="h-4 w-4" /> Edit</button>}>
        {ctx.creds === null ? (
          <div className="flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : mids.length === 0 ? (
          <p className="text-[13px] text-gray-500">No active provider credentials yet. Map a provider to this merchant in TSP Mappings.</p>
        ) : (
          <div className="space-y-3">
            {mids.map((c) => (
              <div key={`${c.provider_id}-${c.direction}`} className="rounded-xl border border-purple-200/70 bg-purple-50/40 px-4 py-3 dark:border-purple-900/40 dark:bg-purple-950/20">
                <div className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{c.provider_name} · {c.direction === "payin" ? "PayIn" : "PayOut"} Merchant ID (MID)</div>
                <div className="text-[12px] text-gray-500">Unique identifier for payment processing</div>
                <div className="mt-1.5 flex items-center gap-2 font-mono text-[13px] font-medium text-gray-800 dark:text-gray-200">
                  {c.mid}
                  <button type="button" onClick={() => copy(c.mid!)} aria-label="Copy MID" className="rounded p-1 text-gray-500 hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-800"><Copy className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </MdSection>

      {editing && <EditDialog ctx={ctx} open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}
