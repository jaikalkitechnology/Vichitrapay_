import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

// Pending-action cards with a faint watermark icon
const ACTION_TONES = {
  amber: { card: "bg-amber-50 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-900/60", icon: "bg-amber-500 text-white shadow-amber-500/30", mark: "text-amber-500", cta: "text-amber-700 dark:text-amber-400" },
  indigo: { card: "bg-indigo-50 border-indigo-200/70 dark:bg-indigo-950/30 dark:border-indigo-900/60", icon: "bg-indigo-600 text-white shadow-indigo-600/30", mark: "text-indigo-500", cta: "text-indigo-700 dark:text-indigo-400" },
  red: { card: "bg-rose-50 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-900/60", icon: "bg-rose-500 text-white shadow-rose-500/30", mark: "text-rose-500", cta: "text-rose-700 dark:text-rose-400" },
  green: { card: "bg-emerald-50 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-900/60", icon: "bg-emerald-500 text-white shadow-emerald-500/30", mark: "text-emerald-500", cta: "text-emerald-700 dark:text-emerald-400" },
} as const;

export default function PendingAction({
  label, value, icon: Icon, tone, cta, onClick,
}: {
  label: string; value: ReactNode; icon: LucideIcon; tone: keyof typeof ACTION_TONES; cta: string; onClick: () => void;
}) {
  const t = ACTION_TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${t.card}`}>
      <Icon className={`pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 opacity-[0.08] ${t.mark}`} aria-hidden="true" />
      <div className="relative flex items-start gap-4">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-lg ${t.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
          <button onClick={onClick} className={`mt-2 inline-flex items-center gap-1 text-[13px] font-semibold hover:underline ${t.cta}`}>
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

