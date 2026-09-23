import React, { useEffect, useRef, useState } from "react";
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

function loadChartJs(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof Chart !== "undefined") return resolve();
    const s = document.createElement("script");
    s.src = CHART_JS_URL;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

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
        setData(res.data);
      } catch { /* non-critical */ }
      setLoading(false);
    })();
  }, [days]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    loadChartJs().then(() => {
      if (cancelled) return;

      // destroy old
      charts.current.forEach((c) => { try { c.destroy(); } catch {} });
      charts.current = [];

      const textColor = "#5a6a7e";
      const gridColor = "rgba(0,0,0,0.05)";
      const scales = {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, border: { display: false } },
      };

      Chart.defaults.font.family = "system-ui, sans-serif";
      Chart.defaults.animation.duration = 800;
      Chart.defaults.animation.easing = "easeInOutQuart";
      Chart.defaults.plugins.tooltip.backgroundColor = "#1A1D27";
      Chart.defaults.plugins.tooltip.borderColor = "#2D3148";
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.cornerRadius = 8;
      Chart.defaults.plugins.tooltip.padding = { top: 8, bottom: 8, left: 12, right: 12 };

      // 1. Revenue line
      if (revenueRef.current) {
        const ctx = revenueRef.current.getContext("2d")!;
        const blueGrad = ctx.createLinearGradient(0, 0, 0, 240);
        blueGrad.addColorStop(0, "rgba(56,113,194,.18)");
        blueGrad.addColorStop(1, "rgba(56,113,194,0)");
        const cyanGrad = ctx.createLinearGradient(0, 0, 0, 240);
        cyanGrad.addColorStop(0, "rgba(0,173,239,.12)");
        cyanGrad.addColorStop(1, "rgba(0,173,239,0)");

        charts.current.push(new Chart(ctx, {
          type: "line",
          data: {
            labels: data.daily.map((d) => d.date),
            datasets: [
              {
                label: "PayIn", data: data.daily.map((d) => d.payin_volume),
                borderColor: "#3871C2", backgroundColor: blueGrad,
                borderWidth: 2.5, tension: 0.4, fill: true,
                pointRadius: 4, pointBackgroundColor: "#3871C2", pointBorderColor: "#fff", pointBorderWidth: 2,
              },
              {
                label: "PayOut", data: data.daily.map((d) => d.payout_volume),
                borderColor: "#00ADEF", backgroundColor: cyanGrad,
                borderWidth: 2, tension: 0.4, fill: true, borderDash: [5, 3],
                pointRadius: 3, pointBackgroundColor: "#00ADEF", pointBorderColor: "#fff", pointBorderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c: any) => c.dataset.label + ": ₹" + c.raw.toLocaleString("en-IN") } },
            },
            scales: { ...scales, y: { ...scales.y, ticks: { ...scales.y.ticks, callback: (v: number) => "₹" + (v >= 100000 ? (v / 100000).toFixed(1) + "L" : (v / 1000).toFixed(0) + "K") } } },
          },
        }));
      }

      // 2. Status donut
      if (donutRef.current) {
        const total = data.status.success + data.status.pending + data.status.failed || 1;
        charts.current.push(new Chart(donutRef.current, {
          type: "doughnut",
          data: {
            labels: ["Success", "Pending", "Failed"],
            datasets: [{
              data: [data.status.success, data.status.pending, data.status.failed],
              backgroundColor: ["#41B93D", "#F68713", "#DC2626"],
              borderWidth: 0, hoverOffset: 6,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "68%",
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
            labels: data.daily.map((d) => d.date),
            datasets: [
              {
                label: "PayIn", data: data.daily.map((d) => d.payin_count),
                backgroundColor: "rgba(56,113,194,.75)", borderRadius: 6, borderSkipped: false,
                barPercentage: 0.6, categoryPercentage: 0.7,
              },
              {
                label: "PayOut", data: data.daily.map((d) => d.payout_count),
                backgroundColor: "rgba(0,173,239,.6)", borderRadius: 6, borderSkipped: false,
                barPercentage: 0.6, categoryPercentage: 0.7,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 16, font: { size: 11 }, color: textColor } } },
            scales,
          },
        }));
      }

      // 4. Fees area
      if (feesRef.current) {
        const ctx = feesRef.current.getContext("2d")!;
        const grad = ctx.createLinearGradient(0, 0, 0, 240);
        grad.addColorStop(0, "rgba(246,135,19,.18)");
        grad.addColorStop(1, "rgba(246,135,19,0)");

        charts.current.push(new Chart(ctx, {
          type: "line",
          data: {
            labels: data.daily.map((d) => d.date),
            datasets: [{
              label: "Fees", data: data.daily.map((d) => d.fees),
              borderColor: "#F68713", backgroundColor: grad,
              borderWidth: 2.5, tension: 0.4, fill: true,
              pointRadius: 5, pointBackgroundColor: "#F68713", pointBorderColor: "#fff", pointBorderWidth: 2,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c: any) => "Fees: ₹" + c.raw.toLocaleString("en-IN") } },
            },
            scales: { ...scales, y: { ...scales.y, ticks: { ...scales.y.ticks, callback: (v: number) => "₹" + (v / 1000).toFixed(0) + "K" } } },
          },
        }));
      }
    });

    return () => { cancelled = true; };
  }, [data]);

  const total = data ? data.status.success + data.status.pending + data.status.failed : 0;
  const pct = (v: number) => total ? Math.round((v / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Revenue + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Revenue Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">PayIn vs PayOut volume</p>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${days === d ? "bg-[#3871C2] text-white" : "border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#3871C2] hover:text-[#3871C2]"}`}
                >{d}D</button>
              ))}
            </div>
          </div>
          <div style={{ height: 240, position: "relative" }}>
            {loading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-[#3871C2]/20 border-t-[#3871C2] rounded-full animate-spin" /></div>
              : <canvas ref={revenueRef} />}
          </div>
          <div className="flex gap-5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#3871C2]" /> PayIn Volume</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#00ADEF]" /> PayOut Volume</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Transaction Status</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">Today's breakdown</p>
          <div style={{ height: 200, position: "relative" }}>
            {loading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-[#41B93D]/20 border-t-[#41B93D] rounded-full animate-spin" /></div>
              : <canvas ref={donutRef} />}
          </div>
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
            <div className="flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#41B93D]" /> Success</span><span className="font-semibold">{data?.status.success ?? 0} ({pct(data?.status.success ?? 0)}%)</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F68713]" /> Pending</span><span className="font-semibold">{data?.status.pending ?? 0} ({pct(data?.status.pending ?? 0)}%)</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> Failed</span><span className="font-semibold">{data?.status.failed ?? 0} ({pct(data?.status.failed ?? 0)}%)</span></div>
          </div>
        </div>
      </div>

      {/* Row 2: Bar + Fees */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Daily Transactions</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">PayIn vs PayOut counts — last {days} days</p>
          <div style={{ height: 240, position: "relative" }}>
            {loading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-[#3871C2]/20 border-t-[#3871C2] rounded-full animate-spin" /></div>
              : <canvas ref={barRef} />}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Platform Fees</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">Charges collected — last {days} days</p>
          <div style={{ height: 240, position: "relative" }}>
            {loading ? <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-[#F68713]/20 border-t-[#F68713] rounded-full animate-spin" /></div>
              : <canvas ref={feesRef} />}
          </div>
        </div>
      </div>
    </div>
  );
}
