const pad = (n: number) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** First and last day of the current calendar month (local time). */
export function currentMonthRange() {
  const now = new Date();
  return {
    from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

/** True when from..to is exactly one whole calendar month. */
export function isWholeMonth(from?: string, to?: string) {
  if (!from || !to) return false;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return fd === 1 && fy === ty && fm === tm && td === new Date(ty, tm, 0).getDate();
}

/** "+12.0% from last month" style label, or null when there is no baseline. */
export function changeLabel(cur: number, prev: number | undefined | null, monthly: boolean) {
  if (prev === undefined || prev === null || prev === 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  return {
    up: pct >= 0,
    text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% ${monthly ? "vs last month" : "vs prev. period"}`,
  };
}

export const fmtDateTimeParts = (d?: string | null) => {
  if (!d) return { day: "—", time: "" };
  const t = new Date(d);
  return {
    day: t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
};

export const filterInputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
