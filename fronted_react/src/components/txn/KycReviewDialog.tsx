// Admin: review a merchant's KYC items one by one, then set the account-level KYC flag
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { fetchMerchantKyc, reviewKycItem, setMerchantKycVerified, type KycData, type KycItem } from "@/api/kyc";
import { KycDocLinks, KycStatusBadge } from "@/components/txn/kycBits";

function ReviewRow({ item, userId, companyLabel, onChange }: { item: KycItem; userId: string; companyLabel?: string; onChange: (d: KycData) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [remark, setRemark] = useState("");

  const review = async (status: "approved" | "rejected") => {
    setBusy(status);
    try {
      onChange(await reviewKycItem(userId, item.key, status, status === "rejected" ? remark : undefined));
      setRejecting(false);
      setRemark("");
    } catch (e) {
      toast({ title: "Review failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const submitted = item.status !== "not_submitted";
  const shownValue = item.kind === "select" ? companyLabel ?? item.value : item.value;
  return (
    <div className="rounded-xl border border-gray-200/80 p-3.5 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{item.label}</div>
          {item.kind === "file" ? (
            item.has_file ? (
              <div className="mt-1">
                <KycDocLinks item={item} userId={userId} />
              </div>
            ) : (
              <div className="mt-0.5 text-[12px] text-gray-400">No document uploaded</div>
            )
          ) : (
            <div className={cn("mt-0.5 break-all text-[13px]", !submitted ? "text-gray-400" : item.kind === "text" ? "font-mono text-gray-700 dark:text-gray-300" : "font-medium text-gray-700 dark:text-gray-300")}>
              {submitted ? shownValue : "Not submitted"}
            </div>
          )}
          {item.status === "rejected" && item.remark && <div className="mt-1 text-[12px] text-red-600 dark:text-red-400">Reason: {item.remark}</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <KycStatusBadge status={item.status} />
          {submitted && (
            <div className="flex gap-1.5">
              {item.status !== "approved" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => review("approved")}
                  className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {busy === "approved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                </button>
              )}
              {item.status !== "rejected" && !rejecting && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => setRejecting(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:hover:bg-red-950/40"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {rejecting && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (remark.trim()) review("rejected");
          }}
        >
          <input autoFocus value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Reason shown to the merchant" className={cn(filterInputCls, "h-9 min-w-0 flex-1")} />
          <button type="submit" disabled={!remark.trim() || !!busy} className="rounded-md bg-red-600 px-3 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {busy === "rejected" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reject"}
          </button>
          <button type="button" onClick={() => setRejecting(false)} className="rounded-md px-2 text-[12px] text-gray-500 hover:text-gray-800">
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

export default function KycReviewDialog({
  userId,
  username,
  onClose,
  onVerifiedChange,
}: {
  userId: string | null;
  username?: string;
  onClose: () => void;
  onVerifiedChange: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<KycData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setData(null);
    setError(null);
    fetchMerchantKyc(userId)
      .then(setData)
      .catch((e) => setError(errorText(e, "Failed to load KYC")));
  }, [userId]);

  const toggleVerified = async () => {
    if (!userId || !data) return;
    setSaving(true);
    try {
      await setMerchantKycVerified(userId, !data.kyc_verified);
      setData({ ...data, kyc_verified: !data.kyc_verified });
      onVerifiedChange();
      toast({ title: data.kyc_verified ? "KYC verification removed" : "Merchant marked KYC verified" });
    } catch (e) {
      toast({ title: "Update failed", description: errorText(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const companyLabel = data?.company_types.find((t) => t.value === data.company_type)?.label;
  const groups = data
    ? [
        { title: "Company", items: data.sections.company },
        { title: "Basic information", items: data.sections.basic },
        { title: "Documents", items: data.sections.documents },
      ]
    : [];
  const pendingCount = groups.flatMap((g) => g.items).filter((i) => i.status === "pending").length;

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review KYC{username ? ` — ${username}` : ""}</DialogTitle>
          <DialogDescription>Approve or reject each item. Rejected items go back to the merchant with your reason.</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-[13px] text-red-600">{error}</p>
        ) : !data ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Progress", `${data.progress.percent}%`],
                ["Awaiting review", String(pendingCount)],
                ["Verified bank accounts", `${data.bank.verified} of ${data.bank.total}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60">
                  <div className="text-[11px] text-gray-500">{k}</div>
                  <div className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{v}</div>
                </div>
              ))}
            </div>

            {groups.map((g) => (
              <div key={g.title}>
                <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-500">{g.title}</h4>
                {g.items.length === 0 ? (
                  <p className="text-[13px] text-gray-400">The merchant has not selected a company type yet.</p>
                ) : (
                  <div className="space-y-2">
                    {g.items.map((item) => (
                      <ReviewRow key={item.key} item={item} userId={data.merchant_id} companyLabel={companyLabel} onChange={setData} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <div className="text-[13px]">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">Account KYC: {data.kyc_verified ? "Verified" : "Not verified"}</div>
                  <div className="text-[12px] text-gray-500">
                    {data.progress.percent === 100 ? "Every item is approved." : `${data.progress.approved} of ${data.progress.total} items approved.`} This flag enables live PayIn.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleVerified}
                disabled={saving}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-60",
                  data.kyc_verified ? "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60" : "bg-indigo-600 text-white hover:bg-indigo-700",
                )}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {data.kyc_verified ? "Remove verification" : "Mark KYC verified"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
