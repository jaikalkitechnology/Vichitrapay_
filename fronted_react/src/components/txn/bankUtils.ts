const BANK_TONES = [
  "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
];

/** Stable colour per bank name, so the same bank looks the same everywhere. */
export function bankTone(name?: string | null) {
  const s = (name ?? "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BANK_TONES[h % BANK_TONES.length];
}

/** "HDFC Bank" → "H", "State Bank of India" → "SI" */
export function bankInitials(name?: string | null) {
  return (
    (name ?? "?")
      .replace(/\b(bank|of|the|ltd|limited)\b/gi, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "B"
  );
}
