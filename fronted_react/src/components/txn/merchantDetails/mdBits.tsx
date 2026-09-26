// Layout pieces shared by the admin merchant-details tabs
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { mdCard, TILE, type Tone } from "@/components/txn/merchantDetails/mdStyles";

const EDGE: Record<Tone, string> = {
  blue: "border-blue-100 dark:border-blue-900/40",
  green: "border-green-200/80 dark:border-green-900/40",
  purple: "border-purple-200/80 dark:border-purple-900/40",
  amber: "border-amber-200/80 dark:border-amber-900/40",
  red: "border-red-200/80 dark:border-red-900/40",
  gray: "border-gray-200/80 dark:border-gray-800",
};

/** Pink/lavender section banner at the top of each tab. */
export function MdBanner({ icon: Icon, title, subtitle, note, right }: { icon: LucideIcon; title: string; subtitle: string; note?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/60 px-5 py-4 dark:border-purple-900/30 dark:from-purple-950/20 dark:via-gray-900 dark:to-indigo-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100/80 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-[13px] text-gray-600 dark:text-gray-400">{subtitle}</p>
          {note && <p className="mt-0.5 text-[12px] text-gray-500">{note}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function MdStat({ icon: Icon, tone, label, value, sub, valueCls }: { icon: LucideIcon; tone: Tone; label: string; value: ReactNode; sub?: ReactNode; valueCls?: string }) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-900", EDGE[tone])}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", TILE[tone])}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-gray-600 dark:text-gray-400">{label}</div>
        <div className={cn("truncate text-[22px] font-bold text-gray-900 dark:text-gray-100", valueCls)}>{value}</div>
        {sub && <div className="text-[12px] text-gray-500">{sub}</div>}
      </div>
    </div>
  );
}

export function MdSection({
  icon: Icon,
  tone = "blue",
  title,
  subtitle,
  right,
  children,
  className,
  bodyCls = "p-5",
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyCls?: string;
}) {
  return (
    <section className={cn(mdCard, "overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/40 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/20">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TILE[tone])}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            {subtitle && <p className="text-[12px] text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className={bodyCls}>{children}</div>
    </section>
  );
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-medium", TILE[tone], className)}>{children}</span>;
}
