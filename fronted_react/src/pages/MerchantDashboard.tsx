import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, Plus, IndianRupee, History, RefreshCw, CheckCircle, AlertCircle, Activity, ArrowRight } from "lucide-react";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, inputCls } from "@/components/admin-part/ui";
import { useToast } from "@/hooks/use-toast";
import {
  getSelfProfile, Merchant, MerchantMetricsResponse, getMerchantMetric, PayoutBankAccountList, PayoutBankAccountOut, listPayoutBankAccounts
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

type SettlementRow = {
  id: number | string;
  txn_id?: string;
  amount: number;
  status?: string;
  requested_at?: string | null;
  settled_date?: string | null;
};

const fmtDay = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MerchantMetricsResponse | null>(null);
  const [amount, setAmount] = useState("");
  const [bankAccounts, setBankAccounts] = useState<(PayoutBankAccountOut & { account_mask?: string })[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('today');

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [profileData, metricsData] = await Promise.all([
        getSelfProfile(),
        getMerchantMetric()
      ]);
      setMerchant(profileData);
      setSummary(metricsData);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res: PayoutBankAccountList = await listPayoutBankAccounts({
        limit: 20,
        offset: 0,
      });
      setBankAccounts(res.items ?? []);
      if (res.items.length > 0) setSelectedBank(res.items[0].id);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch payout accounts");
      setBankAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetch();
  }, []);

  useEffect(() => {
    const fetchList = async (p = 1) => {
      try {
        const r = await api.get(`${BASE_URL}/merchant/settled?page=${p}&per_page=10`);
        setItems(r.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchList(page);
  }, [page]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError("Enter valid amount");
      return;
    }
    if (!selectedBank) {
      setError("Select a bank account");
      return;
    }

    setLoading(true);
    try {
      const resp = await api.post(`${BASE_URL}/merchant/withdraw`,
        { amount: Number(amount), bank_account_id: `${selectedBank}` },
      );
      setLoading(false);
      if (resp.data.success) {
        setAmount("");
        toast({
          title: "✅ Withdrawal Requested",
          description: "Your withdrawal request has been submitted successfully",
          variant: "default",
        });
        fetchData(); // Refresh data
      } else {
        setError(resp.data.message || "Unknown error");
      }
    } catch (err) {
      setLoading(false);
      setError(err?.response?.data?.detail || err.message || "Request failed");
    }
  };

  const getMetricValue = (type: 'payin' | 'payout', metric: string) => {
    if (!summary?.metrics) return "0";
    const data = summary.metrics[type][activeTimeframe];
    return data ? data[metric] : "0";
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
  const settlements = (Array.isArray(items) ? items : []) as SettlementRow[];

  const withdrawForm = (
    <Panel
      title="Quick Withdraw"
      actions={<StatusBadge status="success" className="normal-case">{`Available: ${inrFmt(payoutBal)}`}</StatusBadge>}
    >
      <form onSubmit={handleSubmit} className="p-4">
        {bankAccounts.length === 0 && !loading ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-gray-500">Add a payout bank account to withdraw funds.</p>
            <Button type="button" onClick={() => navigate("/merchant/bankAccount")}>
              <Plus /> Add Bank Account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-gray-600 dark:text-gray-400">Amount (₹)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${inputCls} w-full`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[12px] text-gray-600 dark:text-gray-400">
                Bank Account
                <button type="button" onClick={() => setAmount(String(payoutBal))} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Use max
                </button>
              </span>
              <select
                value={selectedBank ?? ""}
                onChange={(e) => setSelectedBank(Number(e.target.value))}
                className={`${inputCls} w-full`}
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name || "Bank"} •••• {String(acc.account_mask ?? acc.account_number ?? "").slice(-4)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={loading || !amount || !selectedBank}>
              {loading ? <RefreshCw className="animate-spin" /> : null}
              Withdraw <ArrowRight />
            </Button>
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
      </form>
    </Panel>
  );

  const settlementTable = (rows: SettlementRow[], compact: boolean) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Settlement ID</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            {!compact && <TableHead>Requested</TableHead>}
            <TableHead className={compact ? "text-right" : ""}>{compact ? "Date" : "Settled"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={compact ? 4 : 5}>
                <EmptyState icon={History} title="No withdrawals yet" description="Your withdrawal history will appear here" />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-mono text-[12px] whitespace-nowrap text-gray-600 dark:text-gray-400">{it.txn_id || it.id}</TableCell>
                <TableCell className="text-right font-mono tabular-nums font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                  {inrFmt(Number(it.amount || 0))}
                </TableCell>
                <TableCell><StatusBadge status={it.status} /></TableCell>
                {!compact && <TableCell className="whitespace-nowrap">{fmtDay(it.requested_at)}</TableCell>}
                <TableCell className={`whitespace-nowrap ${compact ? "text-right" : ""}`}>
                  {fmtDay(compact ? it.settled_date || it.requested_at : it.settled_date)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  const periods = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "30_days", label: "30 Days" },
  ] as const;

  const renderDashboard = () => (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Welcome back, ${merchant?.full_name?.split(" ")[0] || merchant?.username || "Merchant"}!`}
        description="Here's what's happening with your payments today."
        actions={
          <>
            {merchant && <StatusBadge status={merchant.kyc_verified ? "verified" : "pending"}>{merchant.kyc_verified ? "KYC Verified" : "KYC Pending"}</StatusBadge>}
            <Button variant="outline" onClick={() => { fetchData(); fetch(); }} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Balance" value={inrFmt(walletBal + payoutBal)} icon={Wallet} hint={`Wallet ${inrFmt(walletBal)} + Payout ${inrFmt(payoutBal)}`} />
        <StatCard
          label="Today's Volume"
          value={inrFmt(todayVol)}
          icon={Activity}
          hint={volChange === null ? `${inrFmt(yestVol)} yesterday` : `${volChange >= 0 ? "↑" : "↓"} ${Math.abs(volChange).toFixed(1)}% vs yesterday`}
          hintTone={volChange === null ? "muted" : volChange >= 0 ? "up" : "down"}
        />
        <StatCard label="Today's Txns" value={todayTxns.toLocaleString("en-IN")} icon={CheckCircle} hint={`${yestTxns.toLocaleString("en-IN")} yesterday`} />
        <StatCard label="Avg Value" value={inrFmt(avgValue)} icon={IndianRupee} hint="Per successful PayIn today" />
      </div>

      {withdrawForm}

      <Panel
        title="Recent Settlements"
        actions={<Button variant="outline" onClick={() => navigate("/merchant/settlements")}>View All</Button>}
      >
        {settlementTable(settlements.slice(0, 5), true)}
      </Panel>

      <Panel title="Performance" meta="Successful transactions">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">PayIn Volume</TableHead>
                <TableHead className="text-right">PayIn Txns</TableHead>
                <TableHead className="text-right">PayIn Fees</TableHead>
                <TableHead className="text-right">PayOut Volume</TableHead>
                <TableHead className="text-right">PayOut Txns</TableHead>
                <TableHead className="text-right">PayOut Fees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => {
                const pin = m?.payin?.[p.key];
                const pout = m?.payout?.[p.key];
                const num = "text-right font-mono tabular-nums whitespace-nowrap";
                return (
                  <TableRow key={p.key}>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-100">{p.label}</TableCell>
                    <TableCell className={num}>{inrFmt(Number(pin?.total_volume || 0))}</TableCell>
                    <TableCell className={num}>{Number(pin?.total_txns || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className={num}>{inrFmt(Number(pin?.total_charges || 0))}</TableCell>
                    <TableCell className={num}>{inrFmt(Number(pout?.total_volume || 0))}</TableCell>
                    <TableCell className={num}>{Number(pout?.total_txns || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className={num}>{inrFmt(Number(pout?.total_charges || 0))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );

  const renderSettlements = () => (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settlements"
        description="Withdrawals from your payout balance to your bank accounts"
        actions={
          <Button variant="outline" onClick={() => { fetch(); setPage(1); fetchData(); }}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      {withdrawForm}
      <Panel title="Settlement History" meta={`${settlements.length} results`}>
        {settlementTable(settlements, false)}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-[13px] text-gray-500 dark:border-gray-800">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={settlements.length < 10}>Next</Button>
          </div>
        </div>
      </Panel>
    </div>
  );

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
      {loading && !merchant && activeTab === "dashboard" ? (
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
