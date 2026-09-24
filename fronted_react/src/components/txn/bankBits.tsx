export function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-gray-400">—</span>;
  const current = /current/i.test(type);
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-0.5 text-[12px] font-semibold capitalize ${
        current
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
          : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
      }`}
    >
      {type}
    </span>
  );
}
