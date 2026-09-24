// Shared admin building blocks — "Corporate Pro" spec (admin_panel_design.md)
import { ReactNode } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Page title row: 20px/600 title, 13px subtitle, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Flat bordered stat card, icon top-right. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  hintTone?: "muted" | "up" | "down";
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
          <div className="mt-1 truncate text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight text-gray-900 tabular-nums dark:text-gray-100">
            {value}
          </div>
        </div>
        {Icon && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {hint && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs",
            hintTone === "up" && "text-green-600",
            hintTone === "down" && "text-red-600",
            hintTone === "muted" && "text-gray-500 dark:text-gray-400"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Wrapper for tables and other content panels: flat, border only. */
export function Panel({
  title,
  meta,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900", className)}>
      {(title || actions || meta) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex items-baseline gap-2">
            {title && <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
            {meta && <span className="text-[11px] text-gray-500">{meta}</span>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  success: "green", completed: "green", approved: "green", active: "green", credited: "green", verified: "green", credit: "green",
  pending: "amber", requested: "amber", processing: "amber", initiated: "amber", in_progress: "amber",
  failed: "red", rejected: "red", banned: "red", error: "red", cancelled: "red", debit: "red",
  payin: "blue", info: "blue",
  payout: "purple",
  inactive: "gray",
};

const TONE_CLS: Record<string, string> = {
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900",
  gray: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

/** Rectangular bordered badge; tone picked from the status text, label from children if given. */
export function StatusBadge({ status, className, children }: { status?: string | null; className?: string; children?: ReactNode }) {
  const s = String(status ?? "-");
  const tone = STATUS_TONE[s.toLowerCase().replace(/\s+/g, "_")] ?? "gray";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        TONE_CLS[tone],
        className
      )}
    >
      {children ?? s.replace(/_/g, " ")}
    </span>
  );
}

export type ActionItem = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/** `···` icon button that opens a small action menu. */
export function ActionMenu({ items, label = "Actions" }: { items: ActionItem[]; label?: string }) {
  if (!items.length) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-800"
          aria-label={label}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map((it) => (
          <DropdownMenuItem
            key={it.label}
            disabled={it.disabled}
            onClick={it.onClick}
            className={cn(it.destructive && "text-red-600 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-950/40")}
          >
            {it.icon && <it.icon />}
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Loading / empty rows for tables. */
export function EmptyState({ icon: Icon, title, description }: { icon?: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {Icon && <Icon className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />}
      <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description && <p className="mt-0.5 text-[12px] text-gray-400">{description}</p>}
    </div>
  );
}

export const inputCls =
  "h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
