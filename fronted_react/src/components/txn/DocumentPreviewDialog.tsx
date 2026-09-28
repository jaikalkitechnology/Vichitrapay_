// In-page preview for uploaded documents / receipts (images and PDFs) instead of opening a new tab
import { useEffect, useState } from "react";
import { AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorText } from "@/components/admin-part/listUtils";
import { saveBlob } from "@/api/kyc";

/** A public file URL, or a loader for files behind auth (fetched as a blob). */
export type PreviewSource = { url: string } | { load: () => Promise<Blob> };

type Kind = "image" | "pdf" | "other";

const kindOf = (mime: string, name: string): Kind => {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  const ext = name.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
};

const baseName = (url: string) => decodeURIComponent(url.split("?")[0].split("/").pop() || "document");

export function DocumentPreviewDialog({
  source,
  title,
  fileName,
  onClose,
}: {
  source: PreviewSource | null;
  title: string;
  fileName?: string | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ src: string; kind: Kind; blob?: Blob } | { error: string } | null>(null);

  // depend on the url / loader themselves so a parent re-render with a fresh { url } object doesn't reload
  const url = source && "url" in source ? source.url : null;
  const load = source && "load" in source ? source.load : null;

  useEffect(() => {
    setState(null);
    if (url) {
      setState({ src: url, kind: kindOf("", fileName || url) });
      return;
    }
    if (!load) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    load()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, kind: kindOf(blob.type, fileName || ""), blob });
      })
      .catch((e) => !cancelled && setState({ error: errorText(e) }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, load, fileName]);

  const name = fileName || (url ? baseName(url) : "document");

  const download = async () => {
    if (!state || "error" in state) return;
    if (state.blob) return saveBlob(state.blob, name);
    try {
      // same-origin/CORS-enabled files save directly; otherwise fall back to the browser's own handling
      const res = await fetch(state.src);
      if (!res.ok) throw new Error();
      saveBlob(await res.blob(), name);
    } catch {
      const a = document.createElement("a");
      a.href = state.src;
      a.download = name;
      a.click();
    }
  };

  return (
    <Dialog open={!!source} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-32px)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-100 px-5 py-4 pr-12 text-left dark:border-gray-800">
          <DialogTitle className="truncate text-[16px]">{title}</DialogTitle>
          <DialogDescription className="truncate text-[12.5px]">{name}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-gray-950">
          {state === null ? (
            <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
          ) : "error" in state ? (
            <div className="flex flex-col items-center gap-2 text-center text-[13px] text-red-600 dark:text-red-400">
              <AlertCircle className="h-7 w-7" />
              Could not load the document
              <span className="text-gray-500">{state.error}</span>
            </div>
          ) : state.kind === "image" ? (
            <img
              src={state.src}
              alt={title}
              className="max-h-[70vh] max-w-full rounded-lg bg-white object-contain shadow-sm"
              onError={() => setState({ error: "The image could not be displayed" })}
            />
          ) : state.kind === "pdf" ? (
            <iframe src={state.src} title={title} className="h-[70vh] w-full rounded-lg border-0 bg-white" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-[13px] text-gray-500">
              <FileText className="h-8 w-8 text-gray-400" />
              Preview is not available for this file type. Download it to view.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Close
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!state || "error" in state}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
