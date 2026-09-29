// Admin → System Logs: PhonePe webhook logs, webhook deliveries, payment instrument logs
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, CreditCard, Eye, FileText, Loader2, RefreshCw, Search, Send, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import Pager from "@/components/admin-part/Pager";
import { errorText } from "@/components/admin-part/listUtils";
import { DateRangeMenu, LogDetailDialog, LogStatus } from "@/components/admin-part/systemLogs/logBits";
import { fetchLogs, type DeliveryLog, type InstrumentLog, type LogKind, type LogPage, type PhonePeLog } from "@/api/systemLogs";

const PER_PAGE = 10;

const TABS: { id: LogKind; label: string; icon: typeof Webhook; title: string; subtitle: string; search: string; detail: string }[] = [
  { id: "phonepe", label: "PhonePe Webhook Logs", icon: Webhook, title: "PhonePe Webhook Logs", subtitle: "Incoming webhook requests from PhonePe payment gateway", search: "Search by ID, source IP, reason...", detail: "Webhook" },
  { id: "deliveries", label: "Webhook Deliveries", icon: Send, title: "Webhook Deliveries", subtitle: "Outgoing webhook delivery status to merchant endpoints", search: "Search by Merchant ID, URL, status...", detail: "Delivery" },
  { id: "instruments", label: "Payment Instrument Logs", icon: CreditCard, title: "Payment Instrument Logs", subtitle: "Payment instrument level requests/response logs (Cards, UPI, Net Banking, etc)", search: "Search by Merchant, TSP, Domain, IP...", detail: "Instrument Log" },
];

const when = (d: string | null) => {
  if (!d) return "—";
  const t = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
};

const TH = "whitespace-nowrap border-b border-gray-200 bg-slate-50 px-3.5 py-3.5 text-left text-[13px] font-semibold text-gray-900 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-100";
const TD = "whitespace-nowrap border-b border-gray-100 px-3.5 py-3 text-[14px] text-gray-700 dark:border-gray-800 dark:text-gray-300";
const selectCls =
  "h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-10 text-[14px] text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} aria-label={label}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    </div>
  );
}

function ViewBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-4 py-1.5 text-[14px] font-medium text-violet-700 transition hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/40">
      <Eye className="h-4 w-4" /> View
    </button>
  );
}

type AnyLog = PhonePeLog | DeliveryLog | InstrumentLog;

function LogTab({ kind }: { kind: LogKind }) {
  const tab = TABS.find((t) => t.id === kind)!;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [tsp, setTsp] = useState("");
  const [domain, setDomain] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogPage<AnyLog> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const f = { search: query, status, tsp, domain, from_date: range.from, to_date: range.to, page, per_page: PER_PAGE };
      // the three overloads share one call shape
      setData((await fetchLogs(kind as "phonepe", f)) as LogPage<AnyLog>);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [kind, query, status, tsp, domain, range, page]);

  useEffect(() => {
    load();
  }, [load]);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  let head: string[] = [];
  let row: (r: AnyLog) => ReactNode = () => null;
  if (kind === "phonepe") {
    head = ["ID", "Source IP", "Status", "Reason", "Created At", "Data", "Action"];
    row = (x) => {
      const r = x as PhonePeLog;
      return (
        <>
          <td className={TD}>{r.id}</td>
          <td className={TD}>{r.source_ip || "—"}</td>
          <td className={TD}><LogStatus status={r.status} /></td>
          <td className={cn(TD, "max-w-[320px] truncate")} title={r.reason || undefined}>{r.reason || "—"}</td>
          <td className={TD}>{when(r.created_at)}</td>
          <td className={cn(TD, "text-center")}>
            {r.has_data ? (
              <button type="button" onClick={() => setViewId(r.id)} className="text-gray-600 hover:text-violet-600 dark:text-gray-400" aria-label="Open payload">
                <FileText className="mx-auto h-5 w-5" />
              </button>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </td>
          <td className={cn(TD, "text-center")}><ViewBtn onClick={() => setViewId(r.id)} /></td>
        </>
      );
    };
  } else if (kind === "deliveries") {
    head = ["ID", "Merchant", "URL", "HTTP", "Status", "Attempts", "Error", "Created At", "Action"];
    row = (x) => {
      const r = x as DeliveryLog;
      return (
        <>
          <td className={TD}>{r.id}</td>
          <td className={TD}>{r.merchant_id || "—"}</td>
          <td className={cn(TD, "max-w-[300px] truncate")} title={r.url || undefined}>{r.url || "—"}</td>
          <td className={TD}>{r.http_status ?? "—"}</td>
          <td className={TD}><LogStatus status={r.status} /></td>
          <td className={TD}>{r.attempt ?? "—"}</td>
          <td className={cn(TD, "max-w-[200px] truncate", r.error ? "" : "text-red-500")} title={r.error || undefined}>{r.error || "-"}</td>
          <td className={TD}>{when(r.created_at)}</td>
          <td className={cn(TD, "text-center")}><ViewBtn onClick={() => setViewId(r.id)} /></td>
        </>
      );
    };
  } else {
    head = ["ID", "Merchant", "TSP", "IP Address", "Domain", "Identity Key", "Status", "Created At", "Action"];
    row = (x) => {
      const r = x as InstrumentLog;
      return (
        <>
          <td className={TD}>{r.id}</td>
          <td className={TD}>{r.merchant_id || "—"}</td>
          <td className={TD}>
            {r.tsp ? <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[13px] font-medium capitalize text-gray-800 dark:bg-gray-800 dark:text-gray-200">{r.tsp}</span> : "—"}
          </td>
          <td className={TD}>{r.ip || "—"}</td>
          <td className={cn(TD, "max-w-[190px] truncate")} title={r.domain || undefined}>{r.domain ? r.domain.replace(/^https?:\/\//, "") : "—"}</td>
          <td className={cn(TD, "max-w-[170px] truncate font-mono text-[12px] uppercase")} title={r.identity_key || undefined}>{r.identity_key || "—"}</td>
          <td className={TD}><LogStatus status={r.status} /></td>
          <td className={TD}>{when(r.created_at)}</td>
          <td className={cn(TD, "text-center")}><ViewBtn onClick={() => setViewId(r.id)} /></td>
        </>
      );
    };
  }

  const Icon = tab.icon;
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="mb-5 flex items-center gap-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-violet-600 dark:text-violet-400", kind === "instruments" && "bg-violet-50 dark:bg-violet-950/40")}>
          <Icon className="h-8 w-8" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">{tab.title}</h2>
          <p className="text-[14px] text-gray-600 dark:text-gray-400">{tab.subtitle}</p>
        </div>
      </div>

      <div className={cn("mb-5 grid gap-3", kind === "instruments" ? "lg:grid-cols-[1fr_200px_140px_160px_auto]" : "lg:grid-cols-[1fr_200px_210px_auto]")}>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab.search}
            className="h-12 w-full rounded-xl border border-gray-200 bg-slate-50/60 pl-12 pr-4 text-[14px] text-gray-900 placeholder:text-gray-500 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <DateRangeMenu from={range.from} to={range.to} onChange={(from, to) => { setRange({ from, to }); setPage(1); }} />
        {kind === "instruments" && (
          <>
            <Select value={tsp} onChange={resetPage(setTsp)} label="TSP">
              <option value="">All TSP</option>
              {data?.tsps?.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={domain} onChange={resetPage(setDomain)} label="Domain">
              <option value="">All Domain</option>
              {data?.domains?.map((d) => <option key={d} value={d}>{d.replace(/^https?:\/\//, "")}</option>)}
            </Select>
          </>
        )}
        {kind !== "instruments" && (
          <Select value={status} onChange={resetPage(setStatus)} label="Status">
            <option value="">All Status</option>
            {data?.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}
        <button
          type="button"
          onClick={load}
          title="Refresh"
          aria-label="Refresh"
          className="flex h-12 w-12 items-center justify-center justify-self-start rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} className={cn(TH, (h === "Action" || h === "Data") && "text-center")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={head.length} className="py-12 text-center text-[14px] text-red-600">{error}</td></tr>
            ) : data === null ? (
              <tr><td colSpan={head.length} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-600" /></td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={head.length} className="py-12 text-center text-[14px] text-gray-500">No logs found{query || status || tsp || domain || range.from || range.to ? " — try changing the filters" : ""}</td></tr>
            ) : (
              data.items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">{row(r)}</tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="-mx-5 -mb-5 mt-2 sm:-mx-6 sm:-mb-6">
          <Pager page={page} perPage={PER_PAGE} total={data.total} noun="logs" onPage={setPage} />
        </div>
      )}

      <LogDetailDialog kind={kind} id={viewId} title={`${tab.detail} #${viewId ?? ""}`} onClose={() => setViewId(null)} />
    </div>
  );
}

export default function SystemLogs() {
  const [tab, setTab] = useState<LogKind>("phonepe");
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:px-8">
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-gray-100 sm:text-[32px]">System Logs</h1>
        <p className="mt-1 text-[15px] text-gray-600 dark:text-gray-400 sm:text-[17px]">View webhook logs, delivery status, and payment instrument logs</p>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-3" role="tablist">
        {TABS.map((t, i) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-3 border-t-2 px-4 py-4 text-[15px] font-medium transition sm:text-[16px]",
                i > 0 && "sm:border-l sm:border-l-gray-200 dark:sm:border-l-gray-800",
                active
                  ? "border-t-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                  : "border-t-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60",
              )}
            >
              <Icon className="h-5 w-5" /> {t.label}
            </button>
          );
        })}
      </div>

      <LogTab key={tab} kind={tab} />
    </div>
  );
}
