import { useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import api from "@/api/api";
import { BASE_URL } from "@/config";

declare const Chart: any;

type ChartData = {
  daily: Array<{
    date: string;
    payin_volume: number;
    payout_volume: number;
    payin_count: number;
    payout_count: number;
    fees: number;
  }>;
  status: { success: number; pending: number; failed: number };
};

const CHART_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";

// Chart palette — admin_panel_design.md → Chart Color Palette
const C = {
  payin: "#4F6BF6",
  payout: "#06B6D4",
  success: "#22C55E",
  pending: "#F59E0B",
  failed: "#EF4444",
  fees: "#F59E0B",
};

function loadChartJs(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof Chart !== "undefined") return resolve();
    const s = document.createElement("script");
    s.src = CHART_JS_URL;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

function destroyCharts(list: any[]) {
  list.forEach((c) => {
    try {
      c.destroy();
    } catch {
      // chart already torn down
    }
  });
}

function formatLakhs(v: number) {
  if (v >= 10000000) return (v / 10000000).toFixed(1) + "Cr";
  if (v >= 100000) return (v / 100000).toFixed(v >= 1000000 ? 0 : 1) + "L";
  if (v >= 1000) return (v / 1000).toFixed(0) + "K";
  return String(v);
}

/** Tracks the `dark` class that DashboardLayout toggles on <html>. */
function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Chart heights shrink to 180px below 768px (Chart Responsive Behavior). */
function useChartHeight(desktop: number) {
  const get = () => (window.innerWidth < 768 ? 180 : desktop);
  const [h, setH] = useState(get);
  useEffect(() => {
    const onResize = () => setH(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop]);
  return h;
}

const cardCls = "bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4";
const titleCls = "text-[13px] font-semibold text-gray-900 dark:text-gray-100";
const subCls = "text-[11px] text-gray-500 mt-0.5";

function ChartLoading({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div className="flex flex-col items-center justify-center text-gray-400" style={{ height }}>
      <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
      <span className="text-[11px]">No data for this period</span>
    </div>
  );
}

export default function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const dark = useIsDark();
  const h1 = useChartHeight(220);
  const h2 = useChartHeight(200);

  const revenueRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const feesRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`${BASE_URL}/admin/chart-data?days=${days}`);
        // Normalise so a partial response can't crash the charts
        const d = res.data ?? {};
        setData({
          daily: Array.isArray(d.daily) ? d.daily : [],
          status: {
            success: Number(d.status?.success || 0),
            pending: Number(d.status?.pending || 0),
            failed: Number(d.status?.failed || 0),
          },
        });
      } catch { /* non-critical */ }
      setLoading(false);
    })();
  }, [days]);

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
      const gridColor = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
      const pointBorder = dark ? "#1F2937" : "#fff";

      // Global chart config
      Chart.defaults.font.family = "Inter, system-ui, sans-serif";
      Chart.defaults.font.size = 11;
      Chart.defaults.color = textColor;
      Chart.defaults.animation.duration = 600;
      Chart.defaults.animation.easing = "easeOutQuart";
      Chart.defaults.plugins.tooltip.backgroundColor = dark ? "#1E293B" : "#0F172A";
      Chart.defaults.plugins.tooltip.borderColor = dark ? "#334155" : "#1E293B";
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.cornerRadius = 6;
      Chart.defaults.plugins.tooltip.padding = { top: 6, bottom: 6, left: 10, right: 10 };
      Chart.defaults.plugins.tooltip.titleFont = { size: 11, weight: "600" };
      Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };

      const scales = {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, border: { display: false }, ticks: { color: textColor } },
      };
      const labels = data.daily.map((d) => d.date);
      const fill = (ctx: CanvasRenderingContext2D, rgb: string, top: number, height: number) => {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, `rgba(${rgb},${top})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        return g;
      };

      // 1. Revenue line
      if (revenueRef.current) {
        const ctx = revenueRef.current.getContext("2d")!;
        charts.current.push(new Chart(ctx, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "PayIn", data: data.daily.map((d) => d.payin_volume),
                borderColor: C.payin, backgroundColor: fill(ctx, "79,107,246", 0.12, h1),
                borderWidth: 2, tension: 0.3, fill: true,
                pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: C.payin, pointBorderColor: pointBorder,
              },
              {
                label: "PayOut", data: data.daily.map((d) => d.payout_volume),
                borderColor: C.payout, borderWidth: 1.5, borderDash: [4, 3], tension: 0.3, fill: false,
                pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: C.payout, pointBorderColor: pointBorder,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c: any) => c.dataset.label + ": ₹" + Number(c.raw).toLocaleString("en-IN") } },
            },
            scales: { ...scales, y: { ...scales.y, ticks: { ...scales.y.ticks, callback: (v: number) => "₹" + formatLakhs(v) } } },
          },
        }));
      }

      // 2. Status doughnut
      if (donutRef.current && total > 0) {
        charts.current.push(new Chart(donutRef.current, {
          type: "doughnut",
          data: {
            labels: ["Success", "Pending", "Failed"],
            datasets: [{
              data: [data.status.success, data.status.pending, data.status.failed],
              backgroundColor: [C.success, C.pending, C.failed],
              borderWidth: 0, hoverOffset: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "72%",
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c: any) => c.label + ": " + c.raw + " (" + Math.round((c.raw / total) * 100) + "%)" } },
            },
          },
        }));
      }

      // 3. Daily bar
      if (barRef.current) {
        charts.current.push(new Chart(barRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "PayIn", data: data.daily.map((d) => d.payin_count),
                backgroundColor: C.payin, borderRadius: 4, borderSkipped: false,
                barPercentage: 0.5, categoryPercentage: 0.7,
              },
              {
                label: "PayOut", data: data.daily.map((d) => d.payout_count),
                backgroundColor: C.payout, borderRadius: 4, borderSkipped: false,
                barPercentage: 0.5, categoryPercentage: 0.7,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { boxWidth: 8, padding: 12, font: { size: 11 }, color: textColor } } },
            scales,
          },
        }));
      }

      // 4. Fees area
      if (feesRef.current) {
        const ctx = feesRef.current.getContext("2d")!;
        charts.current.push(new Chart(ctx, {
          type: "line",
          data: {
            labels,
            datasets: [{
              label: "Fees", data: data.daily.map((d) => d.fees),
              borderColor: C.fees, backgroundColor: fill(ctx, "245,158,11", 0.12, h2),
              borderWidth: 2, tension: 0.3, fill: true,
              pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: C.fees, pointBorderColor: pointBorder,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c: any) => "Fees: ₹" + Number(c.raw).toLocaleString("en-IN") } },
            },
            scales: { ...scales, y: { ...scales.y, ticks: { ...scales.y.ticks, callback: (v: number) => "₹" + formatLakhs(v) } } },
          },
        }));
      }
    });

    return () => { cancelled = true; };
  }, [data, loading, dark, h1, h2, total]);

  useEffect(() => () => destroyCharts(charts.current), []);

  const pct = (v: number) => (total ? ((v / total) * 100).toFixed(1) : "0.0");
  const statusRows = [
    { label: "Success", color: C.success, value: data?.status.success ?? 0 },
    { label: "Pending", color: C.pending, value: data?.status.pending ?? 0 },
    { label: "Failed", color: C.failed, value: data?.status.failed ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Revenue (2/3) + Status (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${cardCls}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className={titleCls}>Revenue Overview</h3>
              <p className={subCls}>PayIn vs PayOut volume</p>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors ${
                    days === d
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: h1, position: "relative" }}>
            {loading ? <ChartLoading height={h1} /> : !hasDaily ? <ChartEmpty height={h1} /> : <canvas ref={revenueRef} />}
          </div>
          <div className="text-[11px] text-gray-500 flex gap-4 mt-2">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-indigo-600" /> PayIn Volume</span>
            <span className="flex items-center gap-1.5"><span className="w-4 border-t-[1.5px] border-dashed border-cyan-500" /> PayOut Volume</span>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className={titleCls}>Transaction Status</h3>
          <p className={subCls}>Last {days} days</p>
          <div className="relative mt-3" style={{ height: h1 - 40 }}>
            {loading ? (
              <ChartLoading height={h1 - 40} />
            ) : total === 0 ? (
              <ChartEmpty height={h1 - 40} />
            ) : (
              <>
                <canvas ref={donutRef} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{pct(data!.status.success)}%</span>
                  <span className="text-[11px] text-gray-500">Success Rate</span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[12px]">
            {statusRows.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} /> {r.label}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {r.value.toLocaleString("en-IN")} <span className="text-gray-400 font-normal">({pct(r.value)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Daily bar + Fees (1/2 each) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cardCls}>
          <h3 className={titleCls}>Daily Transactions</h3>
          <p className={`${subCls} mb-3`}>PayIn vs PayOut counts — last {days} days</p>
          <div style={{ height: h2, position: "relative" }}>
            {loading ? <ChartLoading height={h2} /> : !hasDaily ? <ChartEmpty height={h2} /> : <canvas ref={barRef} />}
          </div>
        </div>

        <div className={cardCls}>
          <h3 className={titleCls}>Platform Fees</h3>
          <p className={`${subCls} mb-3`}>Charges collected — last {days} days</p>
          <div style={{ height: h2, position: "relative" }}>
            {loading ? <ChartLoading height={h2} /> : !hasDaily ? <ChartEmpty height={h2} /> : <canvas ref={feesRef} />}
          </div>
        </div>
      </div>
    </div>
  );
}
