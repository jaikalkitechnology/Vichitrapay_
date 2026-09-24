import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Wallet, IndianRupee, History, RefreshCw, CheckCircle, AlertCircle, ArrowRight, ArrowLeftRight, BarChart3, CalendarDays, Database, Eye } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/admin-part/ui";
import {
  getSelfProfile, Merchant, MerchantMetricsResponse, getMerchantMetric
} from "@/api/apiHelper";
import api from "@/api/api"
import { BASE_URL } from "@/config"
import TransactionsPage from "@/components/txn/txnView"
import ApiDocs from "@/components/txn/apiDocs"
import PaymentLinkGenerator from "@/components/txn/paymentLinkGenerator"
import ChangePassword from "@/components/txn/changePassword"
import PayoutAccountsPage from "@/components/txn/accountView"
import MerchantTopup from "@/components/txn/MerchantTopup";
import Passbook from "@/components/txn/passbook";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TspStat } from "@/components/admin-part/tspShared";
import { VolumeBarsChart } from "@/components/txn/AnalyticsCharts";
import useAnalytics from "@/components/txn/useAnalytics";
import QuickWithdraw from "@/components/txn/QuickWithdraw";
import MerchantSettlements from "@/components/txn/MerchantSettlements";

type SettlementRow = {
  id: number | string;
  txn_id?: string;
  amount: number;
  status?: string;
  requested_at?: string | null;
  settled_at?: string | null;
  bank_account?: { bank_name?: string | null; last4: string } | null;
};

const fmtDay = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace("Sept", "Sep") : "-";

/** Merchant-facing names for settlement statuses. */
const settleLabel = (st?: string) =>
  ({ success: "Completed", completed: "Completed", approved: "Approved", pending: "Pending", requested: "Pending", failed: "Rejected" } as Record<string, string>)[
    String(st || "").toLowerCase()
  ] ?? st ?? "—";

/** "17 Sep" from YYYY-MM-DD */
const dayMonth = (ymd: string) => {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep");
};

const MERCHANT_TABS = ["dashboard", "transactions", "paymentLink", "bankAccount", "settlements", "merchantsTopup", "passbook", "developer", "changePassword"];

function getTabFromPath(pathname: string): string {
  const segment = pathname.replace(/^\/merchant\/?/, "").split("/")[0];
  return segment && MERCHANT_TABS.includes(segment) ? segment : "dashboard";
}

export default function MerchantDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [summary, setSummary] = useState<MerchantMetricsResponse | null>(null);
  const [recent, setRecent] = useState<SettlementRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewSettlement, setViewSettlement] = useState<SettlementRow | null>(null);
  const [now] = useState(() => new Date());
  const analytics = useAnalytics({}, "/merchant/analytics");

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [profileData, metricsData] = await Promise.all([getSelfProfile(), getMerchantMetric()]);
      setMerchant(profileData);
      setSummary(metricsData);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // latest withdrawal requests (debit settlements only)
  const fetchRecent = useCallback(async () => {
    try {
      const r = await api.get(`${BASE_URL}/merchant/settlements`, { params: { page: 1, per_page: 5 } });
      setRecent(r.data?.items ?? []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchRecent();
  }, [fetchRecent]);

  const refreshDashboard = () => {
    fetchData();
    fetchRecent();
    analytics.reload();
  };

  // ---- derived metrics (merchant_panel_design.md → Dashboard) ----
  const m = summary?.metrics;
  const walletBal = Number(merchant?.wallet?.balance || 0);
  const payoutBal = Number(merchant?.payout_wallet?.balance || 0);
  const todayVol = Number(m?.payin?.today?.total_volume || 0);
  const yestVol = Number(m?.payin?.yesterday?.total_volume || 0);
  const todayTxns = Number(m?.payin?.today?.total_txns || 0);
  const yestTxns = Number(m?.payin?.yesterday?.total_txns || 0);
  const avgValue = todayTxns ? todayVol / todayTxns : 0;
  const volChange = yestVol ? ((todayVol - yestVol) / yestVol) * 100 : null;
  const inrFmt = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
  const settlements = recent;

  const withdrawForm = <QuickWithdraw balance={merchant ? payoutBal : null} onWithdrawn={refreshDashboard} />;

  const periods = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "30_days", label: "30 Days" },
  ] as const;

  const week = analytics.data?.daily ?? [];
  const settleRemark = (st?: string) =>
    ({ success: "Settled to your bank account", completed: "Settled to your bank account", approved: "Approved, transfer in progress", pending: "Under process", requested: "Under process", failed: "Rejected by admin" } as Record<string, string>)[
      String(st || "").toLowerCase()
    ] ?? "—";
  const nowLabel = now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const renderDashboard = () => (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Welcome back, {merchant?.full_name?.split(" ")[0] || merchant?.username || "Merchant"}!
          </h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Here's what's happening with your payments today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {merchant && (
            <span
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold ${
                merchant.kyc_verified
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400"
              }`}
            >
              {merchant.kyc_verified ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {merchant.kyc_verified ? "KYC Verified" : "KYC Pending"}
            </span>
          )}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[13px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <CalendarDays className="h-4 w-4 text-gray-500" /> {nowLabel}
          </span>
          <Button variant="outline" onClick={refreshDashboard} disabled={isRefreshing} className="h-9 rounded-xl" aria-label="Refresh dashboard">
            <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Total Balance"
          value={merchant ? inrFmt(walletBal + payoutBal) : "…"}
          icon={Wallet}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={`Wallet ${inrFmt(walletBal)} + Payout ${inrFmt(payoutBal)}`}
        />
        <TspStat
          label="Today's Volume"
          value={summary ? inrFmt(todayVol) : "…"}
          icon={BarChart3}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint={volChange === null ? `${inrFmt(yestVol)} yesterday` : `${volChange >= 0 ? "+" : ""}${volChange.toFixed(1)}% vs yesterday`}
          hintTone={volChange === null ? "muted" : volChange >= 0 ? "up" : "down"}
          trend={week.map((d) => d.payin_volume)}
          color="#22C55E"
        />
        <TspStat
          label="Today's Txns"
          value={summary ? todayTxns.toLocaleString("en-IN") : "…"}
          icon={ArrowLeftRight}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          hint={`${yestTxns.toLocaleString("en-IN")} yesterday`}
          trend={week.map((d) => d.payin_count)}
          color="#8B5CF6"
        />
        <TspStat
          label="Avg Value"
          value={summary ? inrFmt(avgValue) : "…"}
          icon={IndianRupee}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          hint="Per successful PayIn today"
          trend={week.map((d) => (d.payin_count ? d.payin_volume / d.payin_count : 0))}
          color="#F59E0B"
        />
      </div>

      {withdrawForm}

      {/* Recent settlements */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Recent Settlements</h2>
              <p className="text-[13px] text-gray-500">Latest payout settlements to your bank account</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/merchant/settlements")} className="rounded-xl text-indigo-600 dark:text-indigo-400">
            View All <ArrowRight />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-3 pl-5 pr-3">Settlement ID</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Remarks</th>
                <th className="py-3 pl-3 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={History} title="No withdrawals yet" description="Your withdrawal history will appear here" />
                  </td>
                </tr>
              ) : (
                settlements.slice(0, 5).map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap py-3 pl-5 pr-3 font-mono text-[12.5px] text-gray-700 dark:text-gray-300">{it.txn_id || it.id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{inrFmt(Number(it.amount || 0))}</td>
                    <td className="px-3 py-3"><StatusBadge status={it.status}>{settleLabel(it.status)}</StatusBadge></td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">{fmtDay(it.requested_at)}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {it.status === "success" && it.bank_account ? `Settled to ${it.bank_account.bank_name ?? "bank"} •••• ${it.bank_account.last4}` : settleRemark(it.status)}
                    </td>
                    <td className="py-2 pl-3 pr-5 text-right">
                      <button
                        onClick={() => setViewSettlement(it)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 text-[12.5px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance + 7-day volume */}
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.7fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Performance</h2>
              <p className="text-[13px] text-gray-500">Successful transactions overview</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
                <tr className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-3 pl-5 pr-3 text-left">Period</th>
                  <th className="px-3 py-3 text-right">PayIn Volume</th>
                  <th className="px-3 py-3 text-right">PayIn Txns</th>
                  <th className="px-3 py-3 text-right">PayIn Fees</th>
                  <th className="px-3 py-3 text-right">PayOut Volume</th>
                  <th className="px-3 py-3 text-right">PayOut Txns</th>
                  <th className="py-3 pl-3 pr-5 text-right">PayOut Fees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {periods.map((p) => {
                  const pin = m?.payin?.[p.key];
                  const pout = m?.payout?.[p.key];
                  const num = "whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-gray-700 dark:text-gray-300";
                  return (
                    <tr key={p.key}>
                      <td className="py-3.5 pl-5 pr-3 text-[14px] font-semibold text-gray-900 dark:text-gray-100">{p.label}</td>
                      <td className={num}>{inrFmt(Number(pin?.total_volume || 0))}</td>
                      <td className={num}>{Number(pin?.total_txns || 0).toLocaleString("en-IN")}</td>
                      <td className={num}>{inrFmt(Number(pin?.total_charges || 0))}</td>
                      <td className={num}>{inrFmt(Number(pout?.total_volume || 0))}</td>
                      <td className={num}>{Number(pout?.total_txns || 0).toLocaleString("en-IN")}</td>
                      <td className={`${num} pr-5`}>{inrFmt(Number(pout?.total_charges || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <VolumeBarsChart
          title="Transaction Volume"
          subtitle="Last 7 days · successful"
          loading={analytics.loading}
          points={week.map((d) => ({ label: dayMonth(d.date), payin: d.payin_volume, payout: d.payout_volume }))}
        />
      </div>

      <Dialog open={!!viewSettlement} onOpenChange={(o) => !o && setViewSettlement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
            <DialogDescription className="break-all">{viewSettlement?.txn_id || viewSettlement?.id}</DialogDescription>
          </DialogHeader>
          {viewSettlement && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {([
                ["Amount", inrFmt(Number(viewSettlement.amount || 0))],
                ["Status", <StatusBadge key="s" status={viewSettlement.status}>{settleLabel(viewSettlement.status)}</StatusBadge>],
                ["Requested", fmtDay(viewSettlement.requested_at)],
                ["Settled", viewSettlement.status === "success" ? fmtDay(viewSettlement.settled_at) : "—"],
                ["Bank Account", viewSettlement.bank_account ? `${viewSettlement.bank_account.bank_name ?? "Bank"} •••• ${viewSettlement.bank_account.last4}` : "—"],
                ["Remarks", settleRemark(viewSettlement.status)],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className={k === "Remarks" ? "col-span-2" : ""}>
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderSettlements = () => <MerchantSettlements />;

  const renderTransactions = () => <TransactionsPage />;
  const bankAccount = () => <PayoutAccountsPage />;
  const MerchantTopUp = () => <MerchantTopup />;
  const PassBook = () => <Passbook />;
  const renderDeveloper = () => <ApiDocs />;
  const renderPaymentLink = () => <PaymentLinkGenerator />;
  const renderChangePassword = () => <ChangePassword />;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'transactions':
        return renderTransactions();
      case 'paymentLink':
        return renderPaymentLink();
      case "bankAccount":
        return bankAccount();
      case 'settlements':
        return renderSettlements();
      case 'merchantsTopup':
        return MerchantTopUp();
      case 'passbook':
        return PassBook();
      case 'developer':
        return renderDeveloper();
      case 'changePassword':
        return renderChangePassword();
      default:
        return renderDashboard();
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {isRefreshing && !merchant && activeTab === "dashboard" ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      ) : (
        renderContent()
      )}
    </DashboardLayout>
  );
}
