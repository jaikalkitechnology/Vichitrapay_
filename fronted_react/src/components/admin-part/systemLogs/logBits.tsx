// Shared pieces for the System Logs page: status pill, date-range menu, JSON viewer dialog
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CalendarDays, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRangeInput } from "@/components/admin-part/filterBits";
import { errorText, lastNDays, rangeText, ymd } from "@/components/admin-part/listUtils";
import { fetchLogDetail, type LogKind } from "@/api/systemLogs";

const GOOD = ["authorized", "delivered", "success", "successful", "completed"];
const BAD = ["failed", "unauthorized", "error", "timeout", "rejected"];

export function LogStatus({ status }: { status: string | null }) {
  const s = (status || "—").toLowerCase();
  const cls = GOOD.includes(s)
    ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
    : BAD.includes(s)
      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  const dot = GOOD.includes(s) ? "bg-green-500" : BAD.includes(s) ? "bg-red-500" : "bg-gray-400";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-medium", cls)}>
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {status || "—"}
    </span>
  );
}

/** "Date Range" button with presets and a custom from–to range. */
export function DateRangeMenu({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  useEffect(() => setDraft({ from, to }), [from, to, open]);
  const today = ymd(new Date());
  const presets: [string, () => { from: string; to: string }][] = [
    ["Today", () => ({ from: today, to: today })],
    ["Last 7 days", () => lastNDays(7)],
    ["Last 30 days", () => lastNDays(30)],
    ["All time", () => ({ from: "", to: "" })],
  ];
  const pick = (r: { from: string; to: string }) => {
    onChange(r.from, r.to);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
          <CalendarDays className="h-5 w-5 shrink-0 text-gray-600 dark:text-gray-400" />
          <span className="min-w-0 flex-1 truncate text-left">{from || to ? rangeText(from, to) : "Date Range"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          {presets.map(([label, get]) => (
            <button key={label} type="button" onClick={() => pick(get())} className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-medium text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-violet-950/40">
              {label}
            </button>
          ))}
        </div>
        <DateRangeInput from={draft.from} to={draft.to} onChange={(f, t) => setDraft({ from: f, to: t })} />
        <button type="button" onClick={() => pick(draft)} className="h-9 w-full rounded-lg bg-violet-600 text-[13px] font-semibold text-white hover:bg-violet-700">
          Apply range
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Pretty JSON with line numbers and key/string/number colours. */
function JsonLines({ value }: { value: unknown }) {
  const text = JSON.stringify(value ?? null, null, 2);
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b|\b(true|false|null)\b/gi;
  const paint = (line: string) => {
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of line.matchAll(token)) {
      const i = m.index ?? 0;
      if (i > last) out.push(line.slice(last, i));
      if (m[1] && m[2]) out.push(<span key={i} className="text-rose-600 dark:text-rose-400">{m[1]}</span>, m[2]);
      else if (m[1]) out.push(<span key={i} className="text-blue-700 dark:text-sky-400">{m[1]}</span>);
      else if (m[3]) out.push(<span key={i} className="text-indigo-600 dark:text-indigo-300">{m[3]}</span>);
      else out.push(<span key={i} className="text-amber-700 dark:text-amber-400">{m[4]}</span>);
      last = i + m[0].length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-[12.5px] leading-[1.6] text-gray-800 dark:text-gray-200">
      {text.split("\n").map((line, n) => (
        <Fragment key={n}>
          <span className="select-none text-right text-gray-400 dark:text-gray-600">{n + 1}</span>
          <span className="whitespace-pre-wrap break-all">{paint(line)}</span>
        </Fragment>
      ))}
    </div>
  );
}

/** Loads one log's full payload and shows it as JSON. */
export function LogDetailDialog({ kind, id, title, onClose }: { kind: LogKind; id: number | null; title: string; onClose: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    setError(null);
    if (id == null) return;
    let live = true;
    fetchLogDetail(kind, id)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [kind, id]);
  // `id` is shown in the title; drop it from the body like the design
  const body = data ? Object.fromEntries(Object.entries(data).filter(([k]) => k !== "id")) : null;
  return (
    <Dialog open={id != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-32px)] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-[17px]">{title}</DialogTitle>
          <DialogDescription className="sr-only">Full log payload</DialogDescription>
        </DialogHeader>
        <div className="mx-5 min-h-[160px] flex-1 overflow-auto rounded-xl bg-slate-50 p-4 dark:bg-gray-950">
          {error ? (
            <p className="flex items-center gap-2 text-[13px] text-red-600"><AlertCircle className="h-4 w-4" /> {error}</p>
          ) : body ? (
            <JsonLines value={body} />
          ) : (
            <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-violet-600" />
          )}
        </div>
        <div className="flex justify-end px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg bg-violet-600 px-6 text-[14px] font-semibold text-white hover:bg-violet-700">
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
