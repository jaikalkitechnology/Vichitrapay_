// Shared KYC pieces for the merchant profile page and the admin review dialog
import { useRef, useState } from "react";
import { CheckCircle2, Clock, Download, Eye, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { openKycDocument, type KycItem, type KycStatus } from "@/api/kyc";

const STATUS: Record<KycStatus, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-400" },
  pending: { label: "Under review", cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400" },
  rejected: { label: "Rejected", cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400" },
  not_submitted: { label: "Not submitted", cls: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export function KycStatusBadge({ status, className }: { status: KycStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS[status].cls, className)}>
      {STATUS[status].label}
    </span>
  );
}

export function KycStatusIcon({ status, className }: { status: KycStatus; className?: string }) {
  if (status === "approved") return <CheckCircle2 className={cn("h-4 w-4 text-green-600 dark:text-green-400", className)} />;
  if (status === "pending") return <Clock className={cn("h-4 w-4 text-amber-500", className)} />;
  return <XCircle className={cn("h-4 w-4", status === "rejected" ? "text-red-500" : "text-gray-400", className)} />;
}

/** The one-line status under an item: approved / under review / rejected with reason / not submitted. */
export function KycStatusLine({ item }: { item: KycItem }) {
  const tone = {
    approved: "text-green-700 dark:text-green-400",
    pending: "text-amber-700 dark:text-amber-400",
    rejected: "text-red-600 dark:text-red-400",
    not_submitted: "text-gray-500",
  }[item.status];
  const text = {
    approved: "Approved",
    pending: "Submitted — waiting for review",
    rejected: `Rejected${item.remark ? `: ${item.remark}` : ""} — please resubmit`,
    not_submitted: "Not submitted",
  }[item.status];
  return (
    <p className={cn("flex items-start gap-1.5 text-[12px] font-medium", tone)}>
      <KycStatusIcon status={item.status} className="mt-px h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

export function KycDocLinks({ item, userId }: { item: KycItem; userId?: string }) {
  const { toast } = useToast();
  if (!item.has_file) return null;
  const open = (download: boolean) =>
    openKycDocument(item.key, { userId, download, fileName: item.file_name }).catch((e) =>
      toast({ title: "Could not open document", description: errorText(e), variant: "destructive" }),
    );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <button type="button" onClick={() => open(false)} className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        <Eye className="h-3.5 w-3.5" /> View uploaded document
      </button>
      <span className="text-gray-300 dark:text-gray-600">•</span>
      <button type="button" onClick={() => open(true)} className="inline-flex items-center gap-1 font-medium text-gray-600 hover:underline dark:text-gray-300">
        <Download className="h-3.5 w-3.5" /> Download
      </button>
      {item.file_name && <span className="truncate text-gray-400">({item.file_name})</span>}
    </div>
  );
}

function DropZone({ disabled, busy, onFile }: { disabled?: boolean; busy: boolean; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && !busy && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled && !busy) onFile(f);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
        over ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50",
        (disabled || busy) && "cursor-not-allowed opacity-60",
      )}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> : <Upload className="h-5 w-5 text-gray-400" />}
      <p className="mt-2 text-[12px] text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Click to upload</span> or drag and drop
      </p>
      <p className="mt-0.5 text-[11px] text-gray-400">PDF, JPG or PNG (max 5 MB)</p>
      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

/** Merchant-side card for one KYC text field or document. */
export function KycItemCard({
  item,
  onSaveText,
  onUpload,
}: {
  item: KycItem;
  onSaveText: (key: string, value: string) => Promise<void>;
  onUpload: (key: string, file: File) => Promise<void>;
}) {
  const [value, setValue] = useState(item.value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = item.status === "approved";
  const dirty = value.trim() !== (item.value ?? "") || item.status === "not_submitted";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (f: File) => {
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return setError("Upload a PDF, JPG or PNG file");
    if (f.size > 5 * 1024 * 1024) return setError("File is larger than 5 MB");
    run(() => onUpload(item.key, f));
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-white p-4 dark:bg-gray-900",
        item.status === "rejected" ? "border-red-200 dark:border-red-900/60" : "border-gray-200/80 dark:border-gray-800",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold leading-snug text-gray-900 dark:text-gray-100">{item.label}</h4>
            {item.hint && <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{item.hint}</p>}
          </div>
        </div>
        <KycStatusBadge status={item.status} className="shrink-0" />
      </div>

      {item.kind === "text" ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) run(() => onSaveText(item.key, value));
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            readOnly={locked}
            placeholder={`Enter ${item.label.toLowerCase()}`}
            className={cn(filterInputCls, "min-w-0 flex-1", locked && "cursor-default bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300")}
          />
          {!locked && (
            <button
              type="submit"
              disabled={busy || !value.trim() || !dirty}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {item.status === "not_submitted" ? "Submit" : "Update"}
            </button>
          )}
        </form>
      ) : (
        <>
          <KycDocLinks item={item} />
          {!locked && <DropZone busy={busy} onFile={onFile} />}
        </>
      )}

      {error && <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-auto border-t border-gray-100 pt-2.5 dark:border-gray-800">
        <KycStatusLine item={item} />
      </div>
    </div>
  );
}
