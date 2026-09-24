import { useCallback, useEffect, useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { ChartData } from "@/components/txn/useChartData";

export type AnalyticsDay = {
  date: string; // YYYY-MM-DD
  payin_volume: number;
  payout_volume: number;
  /** successful transactions */
  payin_count: number;
  payout_count: number;
  /** all statuses */
  payin_total: number;
  payout_total: number;
  fees: number;
};

export type AnalyticsTotals = {
  txns: number;
  success_count: number;
  success_volume: number;
  success_rate: number | null;
  avg_txn_size: number | null;
  fees: number;
  active_merchants: number;
};

export type Analytics = {
  from_date: string;
  to_date: string;
  daily: AnalyticsDay[];
  status: { success: number; pending: number; failed: number };
  totals: AnalyticsTotals;
  previous: AnalyticsTotals;
};

export type AnalyticsParams = {
  from_date?: string;
  to_date?: string;
  user_id?: string;
  transaction_type?: string;
  status?: string;
  search?: string;
};

/** "Sep 1" from YYYY-MM-DD without timezone shifts. */
export const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Shape the analytics payload for the shared volume/status chart. */
export const toChartData = (a: Analytics | null): ChartData | null =>
  a && {
    daily: a.daily.map((d) => ({
      date: dayLabel(d.date),
      payin_volume: d.payin_volume,
      payout_volume: d.payout_volume,
      payin_count: d.payin_count,
      payout_count: d.payout_count,
      fees: d.fees,
    })),
    status: a.status,
  };

/** GET analytics for the given filters; refetches when they change. */
/** Pass endpoint "/merchant/analytics" for the logged-in merchant's own numbers. */
export default function useAnalytics(params: AnalyticsParams, endpoint = "/admin/analytics") {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v !== undefined && v !== ""));
      const res = await api.get(`${BASE_URL}${endpoint}`, { params: clean });
      setData(res.data);
    } catch (err: any) {
      console.error("analytics error", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [key, endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
