import type { ReactNode } from "react";
import { Wallet, Zap, Smartphone, Landmark, CreditCard, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/txn/DashboardCharts";
import { providerTone } from "@/components/admin-part/tspUtils";

const PROVIDER_ICONS: LucideIcon[] = [Zap, Wallet, Smartphone, Landmark, CreditCard];

/** Tinted tile with a stable per-provider icon/color. */
export function ProviderIcon({ index, size = "md" }: { index: number; size?: "md" | "lg" }) {
  const Icon = PROVIDER_ICONS[index % PROVIDER_ICONS.length];
  const box = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  return (
    <span className={`flex flex-shrink-0 items-center justify-center ${box} ${providerTone(index).tile}`}>
      <Icon className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
    </span>
  );
}

export function ProviderCode({ index, code }: { index: number; code: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${providerTone(index).code}`}>
      {code}
    </span>
  );
}

/** Stat card used on both TSP pages (icon tile, label, value, hint, optional trend line). */
export function TspStat({
  label, value, icon: Icon, tile, hint, hintUp, hintTone, trend, color, compact, chart,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tile: string;
  hint?: ReactNode;
  hintUp?: boolean;
  trend?: number[];
  color?: string;
  /** smaller value text, for names rather than numbers */
  compact?: boolean;
  /** hint colour; `hintUp` is shorthand for "up" */
  hintTone?: "up" | "down" | "warn" | "muted";
  /** custom visual in place of the trend line */
  chart?: ReactNode;
}) {
  const tone = hintTone ?? (hintUp ? "up" : "muted");
  const toneCls = {
    up: "font-medium text-green-600 dark:text-green-400",
    down: "font-medium text-red-600 dark:text-red-400",
    warn: "font-medium text-amber-600 dark:text-amber-400",
    muted: "text-gray-500",
  }[tone];
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3.5">
        <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${tile}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400" title={label}>{label}</p>
          <p
            className={`mt-1 truncate font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100 ${compact ? "py-0.5 text-[22px]" : "text-[26px]"}`}
            title={typeof value === "string" ? value : undefined}
          >
            {value}
          </p>
        </div>
      </div>
      <div className="mt-2 flex min-h-10 items-end justify-between gap-3">
        {hint ? (
          <p className={`flex min-w-0 items-start gap-1 text-[12.5px] leading-snug ${toneCls}`}>
            {tone === "up" && <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
            {tone === "down" && <TrendingDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
            {hint}
          </p>
        ) : <span />}
        {chart}
        {!chart && trend && color && <Sparkline values={trend} color={color} className="h-10 w-20 flex-shrink-0" />}
      </div>
    </div>
  );
}
