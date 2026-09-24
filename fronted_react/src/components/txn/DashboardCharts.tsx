import { useEffect, useId, useRef, type ReactNode } from "react";
import { CHART_COLORS as C, getChart, destroyCharts, formatLakhs, loadChartJs, useIsDark } from "@/components/txn/chartUtils";
import type { ChartData } from "@/components/txn/useChartData";
import { ArrowRight, BarChart3 } from "lucide-react";


export type { ChartData, ChartDay } from "@/components/txn/useChartData";

/** Small SVG trend line with a soft fill, for stat cards. */
export function Sparkline({ values, color, className = "h-12 w-28" }: { values: number[]; color: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const w = 112, h = 48, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small SVG bar series for stat cards. */
export function MiniBars({ values, color, className = "h-12 w-24" }: { values: number[]; color: string; className?: string }) {
  if (values.length === 0) return null;
  const w = 96, h = 48, gap = 3;
  const max = Math.max(...values, 0) || 1;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * (h - 2));
        return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={Math.min(2, bw / 2)} fill={color} opacity={v ? 0.35 + 0.65 * (v / max) : 0.15} />;
      })}
    </svg>
  );
}

const cardCls = "rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";

function ChartLoading({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
    </div>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div className="flex flex-col items-center justify-center text-gray-400" style={{ height }}>
      <BarChart3 className="mb-2 h-8 w-8 opacity-30" />
      <span className="text-[12px]">No data for this period</span>
    </div>
  );
}

// Vertical dashed line at the hovered point (Revenue Overview tooltip)
const crosshair = {
  id: "vpCrosshair",
  afterDatasetsDraw(chart: any) {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(59,107,246,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export default function DashboardCharts({
  data,
  loading,
  rangeLabel,
  onViewDetails,
  title = "Revenue Overview",
  statusSubtitle,
  headerRight,
}: {
  data: ChartData | null;
  loading: boolean;
  rangeLabel: string;
  /** omit to hide the "View Details" button */
  onViewDetails?: () => void;
  title?: string;
  statusSubtitle?: string;
  /** extra controls in the volume card header (e.g. a 7D/14D/30D switch) */
  headerRight?: ReactNode;
}) {
  const dark = useIsDark();
  const revenueRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<any[]>([]);
  const height = 240;

  const hasDaily = !!data && data.daily.length > 0;
  const total = data ? data.status.success + data.status.pending + data.status.failed : 0;

  useEffect(() => {
    if (!data || loading) return;
    let cancelled = false;

    loadChartJs().then(() => {
      if (cancelled) return;
      destroyCharts(charts.current);
      charts.current = [];

      const textColor = dark ? "#94A3B8" : "#64748B";
      const gridColor = dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)";

      getChart().defaults.font.family = "Inter, system-ui, sans-serif";
      getChart().defaults.font.size = 11;
      getChart().defaults.color = textColor;

      if (revenueRef.current && hasDaily) {
        const ctx = revenueRef.current.getContext("2d")!;
        const fill = (rgb: string, top: number) => {
          const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || height);
          g.addColorStop(0, `rgba(${rgb},${top})`);
          g.addColorStop(1, `rgba(${rgb},0.02)`);
          return g;
        };
        charts.current.push(
          new (getChart())(ctx, {
            type: "line",
            plugins: [crosshair],
            data: {
              labels: data.daily.map((d) => d.date),
              datasets: [
                {
                  label: "PayIn",
                  data: data.daily.map((d) => d.payin_volume),
                  borderColor: C.payin,
                  backgroundColor: fill("59,107,246", 0.35),
                  borderWidth: 2.5,
                  tension: 0.4,
                  fill: true,
                  pointRadius: 0,
                  pointHoverRadius: 6,
                  pointHoverBorderWidth: 3,
                  pointHoverBackgroundColor: C.payin,
                  pointHoverBorderColor: dark ? "#111827" : "#fff",
                },
                {
                  label: "PayOut",
                  data: data.daily.map((d) => d.payout_volume),
                  borderColor: C.payout,
                  backgroundColor: fill("244,63,114", 0.22),
                  borderWidth: 2,
                  borderDash: [6, 4],
                  tension: 0.4,
                  fill: true,
                  pointRadius: 0,
                  pointHoverRadius: 6,
                  pointHoverBorderWidth: 3,
                  pointHoverBackgroundColor: C.payout,
                  pointHoverBorderColor: dark ? "#111827" : "#fff",
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: dark ? "#1E293B" : "#FFFFFF",
                  titleColor: dark ? "#E2E8F0" : "#0F172A",
                  bodyColor: dark ? "#CBD5E1" : "#334155",
                  borderColor: dark ? "#334155" : "#E2E8F0",
                  borderWidth: 1,
                  padding: 10,
                  cornerRadius: 10,
                  usePointStyle: true,
                  boxPadding: 4,
                  callbacks: {
                    label: (c: any) => ` ${c.dataset.label}   ₹${formatLakhs(Number(c.raw))}`,
                  },
                },
              },
              scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, maxTicksLimit: 10 } },
                y: {
                  grid: { color: gridColor },
                  border: { display: false },
                  beginAtZero: true,
                  ticks: { color: textColor, callback: (v: number) => "₹" + formatLakhs(v) },
                },
              },
            },
          })
        );
      }

      if (donutRef.current && total > 0) {
        charts.current.push(
          new (getChart())(donutRef.current, {
            type: "doughnut",
            data: {
              labels: ["Success", "Pending", "Failed"],
              datasets: [
                {
                  data: [data.status.success, data.status.pending, data.status.failed],
                  backgroundColor: [C.success, C.pending, C.failed],
                  borderWidth: 0,
                  hoverOffset: 4,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: "74%",
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c: any) => `${c.label}: ${c.raw} (${Math.round((c.raw / total) * 100)}%)` } },
              },
            },
          })
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data, loading, dark, hasDaily, total]);

  useEffect(() => () => destroyCharts(charts.current), []);

  const pct = (v: number) => (total ? ((v / total) * 100).toFixed(1) : "0.0");
  const rows = [
    { label: "Success", color: C.success, value: data?.status.success ?? 0 },
    { label: "Pending", color: C.pending, value: data?.status.pending ?? 0 },
    { label: "Failed", color: C.failed, value: data?.status.failed ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className={`${cardCls} flex flex-col xl:col-span-2`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">PayIn vs PayOut volume · {rangeLabel}</p>
          </div>
          {headerRight}
        </div>
        <div className="relative flex-1" style={{ minHeight: height }}>
          {loading ? <ChartLoading height={height} /> : !hasDaily ? <ChartEmpty height={height} /> : <div className="absolute inset-0"><canvas ref={revenueRef} /></div>}
        </div>
        <div className="mt-3 flex gap-6 text-[13px] text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.payin }} /> PayIn Volume
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.payout }} /> PayOut Volume
          </span>
        </div>
      </div>

      <div className={cardCls}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Transaction Status</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">{statusSubtitle ?? rangeLabel}</p>
          </div>
          {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            View Details <ArrowRight className="h-3.5 w-3.5" />
          </button>
          )}
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
          <div className="relative h-44 w-44 flex-shrink-0">
            {loading ? (
              <ChartLoading height={176} />
            ) : total === 0 ? (
              <ChartEmpty height={176} />
            ) : (
              <>
                <canvas ref={donutRef} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{pct(data!.status.success)}%</span>
                  <span className="text-[12px] text-gray-500">Success Rate</span>
                </div>
              </>
            )}
          </div>
          <div className="flex w-full flex-col gap-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] dark:bg-gray-800/60">
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} /> {r.label}
                </span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {r.value.toLocaleString("en-IN")} <span className="font-normal text-gray-400">({pct(r.value)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
