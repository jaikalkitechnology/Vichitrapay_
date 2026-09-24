/** Shared helpers for the TSP Providers / TSP Mapping pages. */

export const PROVIDER_TONES = [
  { tile: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", code: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300" },
  { tile: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400", code: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300" },
  { tile: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", code: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300" },
  { tile: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", code: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300" },
  { tile: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", code: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300" },
];
export const providerTone = (i: number) => PROVIDER_TONES[i % PROVIDER_TONES.length];

export const AVATAR_TONES = [
  "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
];
export const avatarTone = (i: number) => AVATAR_TONES[i % AVATAR_TONES.length];

const ts = (d?: string | null) => (d ? new Date(d).getTime() : 0);

/** Items created since the 1st of the current month. */
export function thisMonthCount(items: { created_at?: string | null }[]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return items.filter((i) => ts(i.created_at) >= start).length;
}

/** Running total at the end of each of the last `weeks` weeks (from created_at). */
export function cumulativeByWeek(items: { created_at?: string | null }[], weeks = 8) {
  const WEEK = 7 * 24 * 3600 * 1000;
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const cutoff = now - (weeks - 1 - i) * WEEK;
    return items.filter((it) => ts(it.created_at) <= cutoff).length;
  });
}

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—";

export const DIRECTION_LABEL: Record<string, string> = {
  payin: "Pay-in",
  payout: "Pay-out",
  both: "Pay-in & Pay-out",
};
