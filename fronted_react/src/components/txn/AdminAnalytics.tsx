// Admin Analytics — platform performance for a date range, plus pending workload
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, BarChart3, CreditCard, Database, Download, IndianRupee, Loader2, Shield, UserCheck, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { AdminSummaryOut } from "@/api/apiHelper";
import DashboardCharts from "@/components/txn/DashboardCharts";
import { DailyTransactionsChart, FeesChart } from "@/components/txn/AnalyticsCharts";
import useAnalytics, { dayLabel, toChartData } from "@/components/txn/useAnalytics";
import { downloadReportCsv } from "@/components/txn/reportDownload";
import { TspStat } from "@/components/admin-part/tspShared";
import PendingAction from "@/components/admin-part/PendingAction";
import { DateRangeInput, RangeToggle } from "@/components/admin-part/filterBits";
import { changeLabel, errorText, currentMonthRange, isWholeMonth, lastNDays, rangeText, spanDays } from "@/components/admin-part/listUtils";

const inrCompact = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};

export default function AdminAnalytics({
  summary,
  balance,
  onRefreshBalance,
}: {
  summary: AdminSummaryOut | null;
  balance: string | null;
  onRefreshBalance: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [range, setRange] = useState(currentMonthRange);
  const [exporting, setExporting] = useState(false);
  const { data, loading, error } = useAnalytics({ from_date: range.from, to_date: range.to });

  const monthly = isWholeMonth(range.from, range.to);
  const t = data?.totals;
  const p = data?.previous;
  const daily = data?.daily ?? [];
  const span = spanDays(range.from, range.to);
  const today = lastNDays(1).to;
  const quick = span && range.to === today && [7, 14, 30].includes(span) ? span : null;
  const label = quick ? `Last ${quick} days` : rangeText(range.from, range.to);

  const hint = (cur: number | null | undefined, prev: number | null | undefined, fallback: string) => {
    const c = cur == null ? null : changeLabel(cur, prev ?? null, monthly);
    return c ? { hint: c.text, hintTone: (c.up ? "up" : "down") as "up" | "down" } : { hint: fallback, hintTone: "muted" as const };
  };
  // success-rate change is shown in percentage points, not relative %
  const rateHint = () => {
    if (t?.success_rate == null || p?.success_rate == null) return { hint: "Successful / all transactions", hintTone: "muted" as const };
    const d = t.success_rate - p.success_rate;
    return { hint: `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts ${monthly ? "vs last month" : "vs prev. period"}`, hintTone: (d >= 0 ? "up" : "down") as "up" | "down" };
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      await downloadReportCsv({ date_from: range.from, date_to: range.to });
      toast({ title: "Report downloaded", description: rangeText(range.from, range.to) });
    } catch (err) {
      toast({ title: "Export failed", description: errorText(err, "Error"), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const points = daily.map((d) => ({ label: dayLabel(d.date), payin: d.payin_total, payout: d.payout_total, fees: d.fees }));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Analytics</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Platform performance and pending workload</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-[300px]">
            <DateRangeInput from={range.from} to={range.to} onChange={(from, to) => from && to && setRange({ from, to })} />
          </div>
          <Button onClick={exportReport} disabled={exporting} className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25">
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export Report
          </Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Success Rate"
          value={loading && !data ? "…" : t?.success_rate != null ? `${t.success_rate.toFixed(1)}%` : "—"}
          icon={BarChart3}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          {...rateHint()}
          trend={daily.map((d) => {
            const all = d.payin_total + d.payout_total;
            return all ? ((d.payin_count + d.payout_count) / all) * 100 : 0;
          })}
          color="#3B6BF6"
        />
        <TspStat
          label="Avg Transaction Size"
          value={loading && !data ? "…" : t?.avg_txn_size != null ? `₹${Math.round(t.avg_txn_size).toLocaleString("en-IN")}` : "—"}
          icon={Database}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          {...hint(t?.avg_txn_size, p?.avg_txn_size, "Successful transactions")}
          trend={daily.map((d) => {
            const n = d.payin_count + d.payout_count;
            return n ? (d.payin_volume + d.payout_volume) / n : 0;
          })}
          color="#8B5CF6"
        />
        <TspStat
          label="Total Volume"
          value={loading && !data ? "…" : inrCompact(t?.success_volume ?? 0)}
          icon={IndianRupee}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          {...hint(t?.success_volume, p?.success_volume, "Successful PayIn + PayOut")}
          trend={daily.map((d) => d.payin_volume + d.payout_volume)}
          color="#22C55E"
        />
        <TspStat
          label="Active Merchants"
          value={loading && !data ? "…" : (t?.active_merchants ?? 0).toLocaleString("en-IN")}
          icon={Users}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          {...hint(t?.active_merchants, p?.active_merchants, "With transactions in range")}
        />
      </div>

      {/* Volume + status */}
      <DashboardCharts
        data={toChartData(data)}
        loading={loading}
        title="Transaction Volume"
        rangeLabel={label}
        statusSubtitle="Overall transaction success rate"
        headerRight={<RangeToggle value={quick} onChange={(n) => setRange(lastNDays(n))} />}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DailyTransactionsChart points={points} loading={loading} subtitle={`Transaction count · ${label}`} />
        <FeesChart points={points} loading={loading} subtitle={`Charges + GST collected · ${label}`} />
      </div>

      {/* Pending workload */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <PendingAction label="Pending KYC" value={summary?.merchant_kyc_pending ?? "—"} icon={UserCheck} tone="indigo" cta="View details" onClick={() => navigate("/admin/merchants")} />
        <PendingAction label="Pending Settlements" value={summary?.total_settle_pending ?? "—"} icon={CreditCard} tone="amber" cta="Process now" onClick={() => navigate("/admin/settlements")} />
        <PendingAction label="Bank Approvals" value={summary?.pending_bank_approvals ?? "—"} icon={Shield} tone="red" cta="Review now" onClick={() => navigate("/admin/bankApproval")} />
        <PendingAction label="Payout Balance" value={balance ?? "—"} icon={Wallet} tone="green" cta="Refresh balance" onClick={onRefreshBalance} />
      </div>
      <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-gray-400">
        <Activity className="h-3.5 w-3.5" /> Volumes, averages and fees count successful transactions; the daily chart counts every status.
      </p>
    </div>
  );
}
