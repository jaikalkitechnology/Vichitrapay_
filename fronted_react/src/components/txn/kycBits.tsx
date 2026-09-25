// Shared KYC pieces for the merchant profile page and the admin review dialog
import { useRef, useState } from "react";
import { CheckCircle2, Clock, CloudUpload, Download, Eye, FileText, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import { KYC_MAX_MB, openKycDocument, type KycItem, type KycStatus } from "@/api/kyc";

const STATUS: Record<KycStatus, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-400" },
  pending: { label: "Under review", cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400" },
  rejected: { label: "Rejected", cls: "border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400" },
  not_submitted: { label: "Not Submitted", cls: "border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export function KycStatusIcon({ status, className }: { status: KycStatus; className?: string }) {
  if (status === "approved") return <CheckCircle2 className={cn("h-4 w-4 text-green-600 dark:text-green-400", className)} />;
  if (status === "pending") return <Clock className={cn("h-4 w-4 text-amber-500", className)} />;
  return <XCircle className={cn("h-4 w-4", status === "rejected" ? "text-red-500" : "text-gray-400", className)} />;
}

/** Pill with a status icon — "✓ Approved", "✕ Rejected", "Not Submitted"… */
export function KycStatusBadge({ status, className }: { status: KycStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[12px] font-medium", STATUS[status].cls, className)}>
      <KycStatusIcon status={status} className="h-3.5 w-3.5 text-current" />
      {STATUS[status].label}
    </span>
  );
}

/** Rejection reason / review note under an item; nothing for approved or untouched items. */
function KycNote({ item }: { item: KycItem }) {
  if (item.status === "rejected")
    return (
      <p className="text-[12px] font-medium text-red-600 dark:text-red-400">
        {item.remark ? `Reason: ${item.remark}` : "Rejected"} — please upload/submit again.
      </p>
    );
  if (item.status === "pending") return <p className="text-[12px] text-amber-700 dark:text-amber-400">Submitted — waiting for review.</p>;
  return null;
}

const outlineBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[13px] font-medium text-blue-600 transition hover:bg-blue-50 dark:border-blue-900/60 dark:bg-gray-900 dark:text-blue-400 dark:hover:bg-blue-950/40";

export function KycDocLinks({ item, userId, buttons = false }: { item: KycItem; userId?: string; buttons?: boolean }) {
  const { toast } = useToast();
  if (!item.has_file) return null;
  const open = (download: boolean) =>
    openKycDocument(item.key, { userId, download, fileName: item.file_name }).catch((e) =>
      toast({ title: "Could not open document", description: errorText(e), variant: "destructive" }),
    );
  if (buttons)
    return (
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => open(false)} className={outlineBtn}>
          <Eye className="h-4 w-4" /> View
        </button>
        <button type="button" onClick={() => open(true)} className={outlineBtn}>
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <button type="button" onClick={() => open(false)} className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400">
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

const fmtUploaded = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : null;

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  return { busy, error, setError, run };
}

/** Label + input + status pill, for the Basic Information grid. */
export function KycField({ item, onSave, wide = false }: { item: KycItem; onSave: (key: string, value: string) => Promise<void>; wide?: boolean }) {
  const [value, setValue] = useState(item.value ?? "");
  const { busy, error, run } = useSubmit();
  const locked = item.status === "approved";
  const dirty = value.trim() !== (item.value ?? "") || item.status === "not_submitted";
  const multiline = wide;

  const input = multiline ? (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      readOnly={locked}
      rows={2}
      placeholder={`Enter ${item.label.toLowerCase()}`}
      className={cn(filterInputCls, "h-auto min-h-[64px] resize-none py-2.5 leading-relaxed", locked && "cursor-default")}
    />
  ) : (
    <input value={value} onChange={(e) => setValue(e.target.value)} readOnly={locked} placeholder={`Enter ${item.label.toLowerCase()}`} className={cn(filterInputCls, locked && "cursor-default")} />
  );

  return (
    <form
      className={cn("space-y-2", wide && "md:col-span-2")}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) run(() => onSave(item.key, value));
      }}
    >
      <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">{item.label}</label>
      <div className="relative flex gap-2">
        <div className="relative min-w-0 flex-1">
          {input}
          {wide && <KycStatusBadge status={item.status} className="absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex" />}
        </div>
        {!locked && (
          <button
            type="submit"
            disabled={busy || !value.trim() || !dirty}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {item.status === "not_submitted" ? "Submit" : "Update"}
          </button>
        )}
      </div>
      <div className={cn(wide && "sm:hidden")}>
        <KycStatusBadge status={item.status} />
      </div>
      {error ? <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p> : <KycNote item={item} />}
    </form>
  );
}

const DOC_TILE: Record<KycStatus, string> = {
  approved: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
  rejected: "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400",
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  not_submitted: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

/** One row of the KYC Documents list: a document upload or an ID number. */
export function KycDocRow({
  item,
  onSave,
  onUpload,
}: {
  item: KycItem;
  onSave: (key: string, value: string) => Promise<void>;
  onUpload: (key: string, file: File) => Promise<void>;
}) {
  const [value, setValue] = useState(item.value ?? "");
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { busy, error, setError, run } = useSubmit();
  const locked = item.status === "approved";
  const isFile = item.kind === "file";
  const subtitle = item.hint ?? (isFile ? `Upload your ${item.label}` : `Enter your ${item.label.replace(/ ID$/, "")} number`);

  const onFile = (f: File) => {
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return setError("Upload a PDF, JPG or PNG file");
    if (f.size > KYC_MAX_MB * 1024 * 1024) return setError(`File is larger than ${KYC_MAX_MB} MB`);
    run(() => onUpload(item.key, f));
  };

  return (
    <div className="flex gap-3.5 px-4 py-4 sm:px-5">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", DOC_TILE[item.status])}>
        <FileText className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{item.label}</h4>
            <p className="text-[12px] leading-snug text-gray-500">{subtitle}</p>
          </div>
          <KycStatusBadge status={item.status} className="shrink-0" />
        </div>

        {isFile ? (
          <>
            {item.has_file && (
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200/80 bg-gray-50/60 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-800/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{item.file_name}</div>
                    {item.updated_at && <div className="text-[12px] text-gray-500">Uploaded on {fmtUploaded(item.updated_at)}</div>}
                  </div>
                </div>
                <KycDocLinks item={item} buttons />
              </div>
            )}
            {!locked && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && !busy) onFile(f);
                }}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border border-dashed px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between",
                  over ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30" : "border-gray-300 dark:border-gray-700",
                )}
              >
                <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="flex items-center gap-3 text-left">
                  {busy ? <Loader2 className="h-7 w-7 shrink-0 animate-spin text-blue-600" /> : <CloudUpload className="h-7 w-7 shrink-0 text-blue-600 dark:text-blue-400" />}
                  <span>
                    <span className="block text-[13px] text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{item.has_file ? "Replace file" : "Click to upload"}</span> or drag and drop
                    </span>
                    <span className="block text-[12px] text-gray-400">PDF, JPG, PNG (Max {KYC_MAX_MB}MB)</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {item.has_file ? "Upload New" : "Upload Document"}
                </button>
                <input
                  ref={fileInput}
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
            )}
          </>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) run(() => onSave(item.key, value));
            }}
          >
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              readOnly={locked}
              placeholder={`Enter ${item.label.toLowerCase()}`}
              className={cn(filterInputCls, "min-w-0 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case", locked && "cursor-default")}
            />
            {!locked && (
              <button
                type="submit"
                disabled={busy || !value.trim() || (value.trim().toUpperCase() === (item.value ?? "") && item.status !== "not_submitted")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {item.status === "not_submitted" ? "Submit" : "Update"}
              </button>
            )}
          </form>
        )}
        {error ? <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p> : <KycNote item={item} />}
      </div>
    </div>
  );
}
