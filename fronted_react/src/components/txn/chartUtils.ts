import { useEffect, useState } from "react";

// Chart.js is loaded from cdnjs on demand (see loadChartJs).
declare const Chart: any;

/** The global Chart.js constructor; call only after loadChartJs() resolves. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js comes from a CDN script without types
export const getChart = (): any => (window as unknown as { Chart: unknown }).Chart;

const CHART_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";

export const CHART_COLORS = {
  payin: "#3B6BF6",
  payout: "#F43F72",
  success: "#22C55E",
  pending: "#F59E0B",
  failed: "#EF4444",
};

export function loadChartJs(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof Chart !== "undefined") return resolve();
    const s = document.createElement("script");
    s.src = CHART_JS_URL;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export function destroyCharts(list: { destroy: () => void }[]) {
  list.forEach((c) => {
    try {
      c.destroy();
    } catch {
      // chart already torn down
    }
  });
}

export function formatLakhs(v: number) {
  if (v >= 10000000) return (v / 10000000).toFixed(1) + "Cr";
  if (v >= 100000) return (v / 100000).toFixed(v >= 1000000 ? 0 : 1) + "L";
  if (v >= 1000) return (v / 1000).toFixed(0) + "K";
  return String(v);
}

/** Tracks the `dark` class that DashboardLayout toggles on <html>. */
export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

