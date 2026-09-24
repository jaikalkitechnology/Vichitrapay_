import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

/** Labelled filter slot for the filter bars on list pages. */
export function FilterField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

/** Two date inputs styled as one "from – to" control. */
export function DateRangeInput({
  from,
  to,
  onChange,
  ariaLabel = "Date range",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  ariaLabel?: string;
}) {
  const dateCls =
    "min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 focus:outline-none dark:text-gray-100 [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[color-scheme:dark]";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex h-11 w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900"
    >
      <CalendarDays className="h-4 w-4 flex-shrink-0 text-gray-500" />
      <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={dateCls} aria-label="From date" />
      <span className="text-gray-400">–</span>
      <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={dateCls} aria-label="To date" />
    </div>
  );
}

/** 7D / 14D / 30D segmented switch; `value` is null when a custom range is set. */
export function RangeToggle({ value, onChange, options = [7, 14, 30] }: { value: number | null; onChange: (days: number) => void; options?: number[] }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800/60" role="group" aria-label="Quick range">
      {options.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={`h-8 rounded-md px-3 text-[12px] font-semibold transition ${
            value === d ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          }`}
        >
          {d}D
        </button>
      ))}
    </div>
  );
}
