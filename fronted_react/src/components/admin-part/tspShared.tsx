import type { ReactNode } from "react";
import { Wallet, Zap, Smartphone, Landmark, CreditCard, TrendingUp, type LucideIcon } from "lucide-react";
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
  label, value, icon: Icon, tile, hint, hintUp, trend, color, compact,
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
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4">
        <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${tile}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p
            className={`mt-1 truncate font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100 ${compact ? "py-0.5 text-[22px]" : "text-[28px]"}`}
            title={typeof value === "string" ? value : undefined}
          >
            {value}
          </p>
        </div>
      </div>
      <div className="mt-2 flex min-h-10 items-end justify-between gap-3">
        {hint ? (
          <p className={`flex min-w-0 items-center gap-1 truncate text-[13px] ${hintUp ? "font-medium text-green-600 dark:text-green-400" : "text-gray-500"}`}>
            {hintUp && <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />}
            {hint}
          </p>
        ) : <span />}
        {trend && color && <Sparkline values={trend} color={color} className="h-10 w-24 flex-shrink-0" />}
      </div>
    </div>
  );
}
