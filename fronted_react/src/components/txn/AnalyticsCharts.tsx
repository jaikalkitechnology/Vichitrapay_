import { useEffect, useRef } from "react";
import { BarChart3 } from "lucide-react";
import { CHART_COLORS, destroyCharts, formatLakhs, getChart, loadChartJs, useIsDark } from "@/components/txn/chartUtils";

type Point = { label: string };

const cardCls = "rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const HEIGHT = 230;

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center text-gray-400" style={{ height: HEIGHT }}>
      <BarChart3 className="mb-2 h-8 w-8 opacity-30" />
      <span className="text-[12px]">No data for this period</span>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center" style={{ height: HEIGHT }}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
    </div>
  );
}

/** One Chart.js canvas that is rebuilt when `build` inputs or the theme change. */
/** A Chart.js config object (loaded from CDN, so untyped here). */
type ChartConfig = Record<string, unknown> | null | false;

function useChart(build: (ctx: CanvasRenderingContext2D, theme: { text: string; grid: string; dark: boolean }) => ChartConfig, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<{ destroy: () => void }[]>([]);
  const dark = useIsDark();
  useEffect(() => {
    let cancelled = false;
    loadChartJs().then(() => {
      if (cancelled || !ref.current) return;
      destroyCharts(chart.current);
      const C = getChart();
      C.defaults.font.family = "Inter, system-ui, sans-serif";
      C.defaults.font.size = 11;
      const cfg = build(ref.current.getContext("2d")!, {
        text: dark ? "#94A3B8" : "#64748B",
        grid: dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)",
        dark,
      });
      chart.current = cfg ? [new C(ref.current, cfg)] : [];
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dark]);
  useEffect(() => () => destroyCharts(chart.current), []);
  return ref;
}

const tooltip = (dark: boolean) => ({
  backgroundColor: dark ? "#1E293B" : "#FFFFFF",
  titleColor: dark ? "#E2E8F0" : "#0F172A",
  bodyColor: dark ? "#CBD5E1" : "#334155",
  borderColor: dark ? "#334155" : "#E2E8F0",
  borderWidth: 1,
  padding: 10,
  cornerRadius: 10,
  usePointStyle: true,
  boxPadding: 4,
});

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex justify-center gap-6 text-[13px] text-gray-600 dark:text-gray-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

/** Grouped bars: PayIn and PayOut transaction counts per day (all statuses). */
export function DailyTransactionsChart({
  points,
  loading,
  subtitle,
}: {
  points: (Point & { payin: number; payout: number })[];
  loading: boolean;
  subtitle: string;
}) {
  const has = points.some((p) => p.payin || p.payout);
  const ref = useChart(
    (_ctx, t) =>
      has && {
        type: "bar",
        data: {
          labels: points.map((p) => p.label),
          datasets: [
            { label: "PayIn", data: points.map((p) => p.payin), backgroundColor: CHART_COLORS.payin, borderRadius: 4, maxBarThickness: 14 },
            { label: "PayOut", data: points.map((p) => p.payout), backgroundColor: "#A855F7", borderRadius: 4, maxBarThickness: 14 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: tooltip(t.dark) },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: t.text, maxTicksLimit: 11, maxRotation: 0, autoSkipPadding: 8 } },
            y: { grid: { color: t.grid }, border: { display: false }, beginAtZero: true, ticks: { color: t.text, precision: 0 } },
          },
        },
      },
    [points, has]
  );
  return (
    <div className={cardCls}>
      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Daily Transactions</h3>
      <p className="mb-4 mt-0.5 text-[13px] text-gray-500">{subtitle}</p>
      <div className="relative" style={{ height: HEIGHT }}>
        {loading ? <Loading /> : !has ? <Empty /> : <canvas ref={ref} />}
      </div>
      <Legend items={[{ label: "PayIn", color: CHART_COLORS.payin }, { label: "PayOut", color: "#A855F7" }]} />
    </div>
  );
}

/** Area line of platform fees (charges + GST on successful transactions) per day. */
export function FeesChart({ points, loading, subtitle }: { points: (Point & { fees: number })[]; loading: boolean; subtitle: string }) {
  const has = points.some((p) => p.fees);
  const ref = useChart(
    (ctx, t) => {
      if (!has) return null;
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, "rgba(245,158,11,0.35)");
      g.addColorStop(1, "rgba(245,158,11,0.02)");
      return {
        type: "line",
        data: {
          labels: points.map((p) => p.label),
          datasets: [
            {
              label: "Fees",
              data: points.map((p) => p.fees),
              borderColor: CHART_COLORS.pending,
              backgroundColor: g,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: CHART_COLORS.pending,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { ...tooltip(t.dark), callbacks: { label: (c: { raw: unknown }) => ` Fees   ₹${Number(c.raw).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` } },
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: t.text, maxTicksLimit: 11, maxRotation: 0, autoSkipPadding: 8 } },
            y: { grid: { color: t.grid }, border: { display: false }, beginAtZero: true, ticks: { color: t.text, callback: (v: number) => "₹" + formatLakhs(v) } },
          },
        },
      };
    },
    [points, has]
  );
  return (
    <div className={cardCls}>
      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Platform Fees</h3>
      <p className="mb-4 mt-0.5 text-[13px] text-gray-500">{subtitle}</p>
      <div className="relative" style={{ height: HEIGHT }}>
        {loading ? <Loading /> : !has ? <Empty /> : <canvas ref={ref} />}
      </div>
    </div>
  );
}
