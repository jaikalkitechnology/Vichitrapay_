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
