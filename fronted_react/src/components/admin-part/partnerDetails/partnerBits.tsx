// Pieces shared by the partner panel pages
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const GRAD = {
  violet: "from-violet-500 via-indigo-500 to-blue-500 shadow-indigo-500/25",
  green: "from-emerald-500 to-green-600 shadow-emerald-500/25",
  orange: "from-amber-400 via-orange-500 to-orange-600 shadow-orange-500/25",
  blue: "from-blue-500 to-blue-600 shadow-blue-500/25",
  red: "from-rose-500 to-red-600 shadow-rose-500/25",
} as const;

/** Solid gradient stat card with decorative bars, as in the partner panel designs. */
export function GradientStat({ tone, icon: Icon, label, value, sub }: { tone: keyof typeof GRAD; icon: LucideIcon; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg", GRAD[tone])}>
      <div className="relative z-10 flex items-start gap-4 pr-8">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 2xl:h-14 2xl:w-14"><Icon className="h-6 w-6 2xl:h-7 2xl:w-7" /></span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-white/90">{label}</div>
          <div className="mt-0.5 break-words text-[24px] font-bold leading-tight 2xl:text-[28px]">{value}</div>
          {sub && <div className="text-[13px] text-white/80">{sub}</div>}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 flex items-end gap-1 opacity-25" aria-hidden="true">
        {[12, 20, 30, 42].map((h) => <span key={h} className="w-2.5 rounded-sm bg-white" style={{ height: h }} />)}
      </div>
    </div>
  );
}
