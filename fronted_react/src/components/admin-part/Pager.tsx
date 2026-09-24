import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page buttons with gaps: 1 … 4 5 6 … 12 */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  if (current <= 3) [2, 3, 4, 5].forEach((n) => pages.add(n));
  if (current >= total - 2) [total - 4, total - 3, total - 2, total - 1].forEach((n) => pages.add(n));
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

const btn =
  "flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-[14px] text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800";

/** "Showing a to b of n <noun>" plus numbered page buttons. */
export default function Pager({
  page,
  perPage,
  total,
  noun,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 px-5 py-4 dark:border-gray-800 md:flex-row">
      <div className="text-[14px] text-gray-500">
        Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{from.toLocaleString("en-IN")}</span> to{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{to.toLocaleString("en-IN")}</span> of{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{total.toLocaleString("en-IN")}</span> {noun}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              key={n}
              onClick={() => n !== page && onPage(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(btn, n === page && "border-indigo-600 bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-600 dark:border-indigo-600 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-600")}
            >
              {n.toLocaleString("en-IN")}
            </button>
          )
        )}
        <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
