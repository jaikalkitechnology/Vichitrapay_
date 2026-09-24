import { useCallback, useEffect, useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";

export type ChartDay = {
  date: string;
  payin_volume: number;
  payout_volume: number;
  payin_count: number;
  payout_count: number;
  fees: number;
};

export type ChartData = {
  daily: ChartDay[];
  status: { success: number; pending: number; failed: number };
};

/** Loads /admin/chart-data for the given window and normalises partial payloads. */
export default function useChartData(days: number) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE_URL}/admin/chart-data?days=${days}`);
      const d = res.data ?? {};
      setData({
        daily: Array.isArray(d.daily) ? d.daily : [],
        status: {
          success: Number(d.status?.success || 0),
          pending: Number(d.status?.pending || 0),
          failed: Number(d.status?.failed || 0),
        },
      });
    } catch {
      // non-critical — keep the last data
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}
