import { useState, useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  CreditCard,
  TrendingUp,
  IndianRupee,
  Loader2,
  Wallet,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  RefreshCw,
  UserCheck,
  ArrowRight,
  Activity,
  Check,
  X,
  Eye,
  Copy,
  ExternalLink,
  CalendarDays,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAdminSummary, AdminSummaryOut } from "@/api/apiHelper";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import DashboardCharts, { Sparkline } from "@/components/txn/DashboardCharts";
import useChartData from "@/components/txn/useChartData";
import MerchatList from "@/components/txn/merchantlist";
import MerchantTransactionsPage from "@/components/txn/merchantTxnView";
import AdminPayoutManagement from "@/components/txn/AdminPayoutManagement";
import TspMappingPage from "@/components/admin-part/TspMappingPage";
import TspProvidersPage from "@/components/admin-part/TspProvidersPage";
import AdminReport from "@/components/txn/AdminReport";
import BankApproval from "@/components/txn/BankApproval";
import { ActionMenu, EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin-part/ui";

// ---- helpers ---------------------------------------------------------------
type SettlementStatus = "pending" | "approved" | "rejected" | "requested" | "completed" | "failed";
type SettlementItem = {
  id: string | number;
  txn_id: string;
  user_id: string;
  amount: number;
  currency?: string;
  settled_date?: string | null;
  requested_at?: string | null;
  status: SettlementStatus;
};
type BalanceAmount = { balance: string };
type BalanceResponse = {
  success: boolean;
  balance?: string | number | BalanceAmount[];
  raw?: any;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** ₹18.4L / ₹2.1Cr — compact amounts for stat cards. */
const inrCompact = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};

/** Balance may arrive pre-formatted ("4,50,000"); show it as ₹ either way. */
const fmtBalance = (b: string) => {
  const n = Number(String(b).replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? inr.format(n) : `₹${b}`;
};

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-";

type RecentTxn = {
  id: number;
  user_id: string;
  transaction_type: string;
  order_id?: string | null;
  txn_id?: string | null;
  status?: string | null;
  amount: number;
  created_at?: string | null;
};

// Pending-action cards with a faint watermark icon
const ACTION_TONES = {
  amber: { card: "bg-amber-50 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-900/60", icon: "bg-amber-500 text-white shadow-amber-500/30", mark: "text-amber-500", cta: "text-amber-700 dark:text-amber-400" },
  indigo: { card: "bg-indigo-50 border-indigo-200/70 dark:bg-indigo-950/30 dark:border-indigo-900/60", icon: "bg-indigo-600 text-white shadow-indigo-600/30", mark: "text-indigo-500", cta: "text-indigo-700 dark:text-indigo-400" },
  red: { card: "bg-rose-50 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-900/60", icon: "bg-rose-500 text-white shadow-rose-500/30", mark: "text-rose-500", cta: "text-rose-700 dark:text-rose-400" },
  green: { card: "bg-emerald-50 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-900/60", icon: "bg-emerald-500 text-white shadow-emerald-500/30", mark: "text-emerald-500", cta: "text-emerald-700 dark:text-emerald-400" },
} as const;

function PendingAction({
  label, value, icon: Icon, tone, cta, onClick,
}: {
  label: string; value: ReactNode; icon: typeof Users; tone: keyof typeof ACTION_TONES; cta: string; onClick: () => void;
}) {
  const t = ACTION_TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${t.card}`}>
      <Icon className={`pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 opacity-[0.08] ${t.mark}`} aria-hidden="true" />
      <div className="relative flex items-start gap-4">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-lg ${t.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
          <button onClick={onClick} className={`mt-2 inline-flex items-center gap-1 text-[13px] font-semibold hover:underline ${t.cta}`}>
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

const STAT_TONES = {
  blue: { tile: "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30", line: "#3B6BF6" },
  purple: { tile: "bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30", line: "#8B5CF6" },
  green: { tile: "bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/30", line: "#22C55E" },
  amber: { tile: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30", line: "#F59E0B" },
} as const;

/** % change of today vs yesterday; null when there is no baseline. */
const pctChange = (today: number, yesterday: number) =>
  yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;

function DashStat({
  label, value, icon: Icon, tone, change, hint, trend,
}: {
  label: string;
  value: ReactNode;
  icon: typeof Users;
  tone: keyof typeof STAT_TONES;
  change?: number | null;
  hint: string;
  trend?: number[];
}) {
  const t = STAT_TONES[tone];
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${t.tile}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 truncate text-[26px] font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 text-[12px] leading-5 text-gray-500 dark:text-gray-400">
          {change != null && (
            <div className={`flex items-center gap-0.5 text-[13px] font-semibold ${up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
          <div className="truncate" title={hint}>{hint}</div>
        </div>
        {trend && <Sparkline values={trend} color={t.line} className="h-10 w-24 flex-shrink-0" />}
      </div>
    </div>
  );
}

const cellMono = "font-mono text-[12px] whitespace-nowrap text-gray-600 dark:text-gray-400";
const cellAmount = "font-mono text-[13px] whitespace-nowrap tabular-nums font-medium text-gray-900 dark:text-gray-100";

// ---- component -------------------------------------------------------------
const ADMIN_TABS = ["dashboard", "merchants", "tspMappings", "tspProviders", "transactions", "settlements", "analytics", "payouts", "report", "bankApproval"];

function getTabFromPath(pathname: string): string {
  const segment = pathname.replace(/^\/admin\/?/, "").split("/")[0];
  return segment && ADMIN_TABS.includes(segment) ? segment : "dashboard";
}

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);
  const { toast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminSummaryOut | null>(null);
  const [balance, setBalance] = useState<BalanceAmount | null>(null);
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | SettlementStatus>("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminSummary();
        if (!mounted) return;
        setSummary(data);
      } catch (err: any) {
        if (!mounted) return;
        console.error(err);
        setError(err?.message || "Failed to load merchant");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchList = async (p = 1) => {
    try {
      const r = await api.get(`${BASE_URL}/admin/settled?page=${p}&per_page=20`);
      setItems(r.data as SettlementItem[]);
    } catch (e) {
      console.error(e);
    }
  };
  
  useEffect(() => {
    fetchList(page);
  }, [page]);

  const fetchBalance = async () => {
    try {
      const r = await api.get<BalanceResponse>(`${BASE_URL}/admin/unversal/balance`);
      const payload = r.data;

      if (!payload) {
        setBalance(null);
        return;
      }

      if (typeof payload.balance === "string" || typeof payload.balance === "number") {
        setBalance({ balance: String(payload.balance) });
        return;
      }

      if (Array.isArray(payload.balance) && payload.balance.length > 0) {
        const first = payload.balance[0];
        setBalance({ balance: String(first.balance ?? first) });
        return;
      }

      if (payload.raw && payload.raw.data && payload.raw.data.balance != null) {
        setBalance({ balance: String(payload.raw.data.balance) });
        return;
      }

      setBalance(null);
    } catch (e) {
      console.error("fetchBalance error:", e);
      setBalance(null);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const [settlementLoadingMap, setSettlementLoadingMap] = useState<Record<string, boolean>>({});

  const setSettlementLoading = (id: string | number, v: boolean) => {
    setSettlementLoadingMap((s) => ({ ...s, [String(id)]: v }));
  };

  const handleSettlementAction = async (settlementId: string | number, action: "approved" | "rejected") => {
    const idStr = String(settlementId);
    const verb = action === "approved" ? "approve" : "reject";
    setSettlementLoading(idStr, true);

    try {
      const res = await api.post(`${BASE_URL}/admin/${encodeURIComponent(idStr)}/${verb}`);
      toast({
        title: "✅ Settlement Updated",
        description: `Settlement ${action} successfully`,
        variant: "default",
      });
      await fetchList(page);
    } catch (err: any) {
      console.error("settlement action error", err);
      toast({
        title: "❌ Update Failed",
        description: err?.response?.data?.detail || "Failed to update settlement",
        variant: "destructive",
      });
    } finally {
      setSettlementLoading(idStr, false);
    }
  };


  const [recent, setRecent] = useState<RecentTxn[] | null>(null);
  const fetchRecent = async () => {
    try {
      const r = await api.get(`${BASE_URL}/admin/transactions`, { params: { page: 1, per_page: 5 } });
      setRecent(Array.isArray(r.data?.items) ? r.data.items : []);
    } catch (e) {
      console.error("recent transactions error", e);
      setRecent([]);
    }
  };
  useEffect(() => {
    fetchRecent();
  }, []);

  const [days, setDays] = useState(30);
  const chart = useChartData(days);
  const [viewTxn, setViewTxn] = useState<RecentTxn | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: text });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const refreshDashboard = () => {
    fetchBalance();
    fetchRecent();
    chart.reload();
    getAdminSummary().then(setSummary).catch(() => {});
  };

  const todaySuccess = (summary?.today?.payin?.success || 0) + (summary?.today?.payout?.success || 0);
  const yesterdaySuccess = (summary?.yesterday?.payin?.success || 0) + (summary?.yesterday?.payout?.success || 0);

  const daily = chart.data?.daily ?? [];
  const trendVolume = daily.map((d) => Number(d.payin_volume || 0) + Number(d.payout_volume || 0));
  const trendCount = daily.map((d) => Number(d.payin_count || 0) + Number(d.payout_count || 0));
  const trendFees = daily.map((d) => Number(d.fees || 0));
  const todayVolume = Number(summary?.today?.success_volume || 0);
  const todayFees = Number(summary?.today?.charges || 0);
  const yesterdayFees = Number(summary?.yesterday?.charges || 0);

  const renderDashboard = () => (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description="Overview of your platform activity"
        actions={
          <>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="h-10 w-[160px] rounded-xl bg-white shadow-sm dark:bg-gray-900" aria-label="Date range">
                <CalendarDays className="mr-2 h-4 w-4 text-gray-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="14">Last 14 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10 rounded-xl bg-white shadow-sm dark:bg-gray-900" onClick={refreshDashboard}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                <div className="flex-1">
                  <div className="mb-2 h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-7 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <DashStat
            label="Total Merchants"
            value={Number(summary.total_merchants || 0).toLocaleString("en-IN")}
            icon={Users}
            tone="blue"
            hint={`${summary.merchant_kyc_pending || 0} awaiting KYC`}
          />
          <DashStat
            label="Today's Volume"
            value={inrCompact(todayVolume)}
            icon={TrendingUp}
            tone="purple"
            change={pctChange(todayVolume, Number(summary.yesterday?.success_volume || 0))}
            hint="vs yesterday"
            trend={trendVolume}
          />
          <DashStat
            label="Success Txns"
            value={todaySuccess.toLocaleString("en-IN")}
            icon={CheckCircle}
            tone="green"
            change={pctChange(todaySuccess, yesterdaySuccess)}
            hint={`vs ${yesterdaySuccess.toLocaleString("en-IN")} yesterday`}
            trend={trendCount}
          />
          <DashStat
            label="Platform Fees"
            value={inrCompact(todayFees)}
            icon={IndianRupee}
            tone="amber"
            change={pctChange(todayFees, yesterdayFees)}
            hint={`vs ${inrCompact(yesterdayFees)} yesterday`}
            trend={trendFees}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <EmptyState icon={AlertCircle} title="No summary data" description={error ?? undefined} />
        </div>
      )}

      {/* Charts */}
      <DashboardCharts
        data={chart.data}
        loading={chart.loading}
        rangeLabel={`Last ${days} days`}
        onViewDetails={() => navigate("/admin/transactions")}
      />

      {/* Pending Actions */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <PendingAction label="KYC Pending" value={summary?.merchant_kyc_pending || 0} icon={UserCheck} tone="amber" cta="Review now" onClick={() => navigate("/admin/merchants")} />
        <PendingAction label="Pending Settlements" value={summary?.total_settle_pending || 0} icon={CreditCard} tone="indigo" cta="Process now" onClick={() => navigate("/admin/settlements")} />
        <PendingAction label="Bank Approvals" value={summary?.pending_bank_approvals || 0} icon={Shield} tone="red" cta="Review now" onClick={() => navigate("/admin/bankApproval")} />
        <PendingAction label="Payout Balance" value={balance ? fmtBalance(balance.balance) : "—"} icon={Wallet} tone="green" cta="Refresh" onClick={fetchBalance} />
      </div>

      {/* Recent Transactions */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h3>
            <p className="mt-0.5 text-[13px] text-gray-500">Latest activity across all merchants</p>
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate("/admin/transactions")}>
            View All <ArrowRight />
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 dark:bg-gray-800/40">
              <TableHead>Txn ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent === null ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <Loader2 className="inline h-5 w-5 animate-spin text-indigo-600" />
                </TableCell>
              </TableRow>
            ) : recent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={Activity} title="No transactions yet" />
                </TableCell>
              </TableRow>
            ) : (
              recent.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className={cellMono}>{t.txn_id || "—"}</TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">{t.user_id}</TableCell>
                  <TableCell><StatusBadge status={t.transaction_type} /></TableCell>
                  <TableCell className={cellMono}>{t.order_id || "—"}</TableCell>
                  <TableCell className={`text-right ${cellAmount}`}>{inr.format(Number(t.amount || 0))}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(t.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setViewTxn(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
                        aria-label="View transaction"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <ActionMenu
                        items={[
                          { label: "Open in Transactions", icon: ExternalLink, onClick: () => navigate("/admin/transactions") },
                          { label: "Copy Txn ID", icon: Copy, disabled: !t.txn_id, onClick: () => t.txn_id && copyText(t.txn_id) },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewTxn} onOpenChange={(o) => !o && setViewTxn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>{viewTxn?.txn_id || "—"}</DialogDescription>
          </DialogHeader>
          {viewTxn && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {[
                ["Merchant", viewTxn.user_id],
                ["Type", <StatusBadge key="type" status={viewTxn.transaction_type} />],
                ["Order ID", viewTxn.order_id || "—"],
                ["Amount", inr.format(Number(viewTxn.amount || 0))],
                ["Status", <StatusBadge key="status" status={viewTxn.status} />],
                ["Date", fmtDateTime(viewTxn.created_at)],
              ].map(([k, v]) => (
                <div key={String(k)} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderMerchants = () => <MerchatList />;
  const renderTspMappings = () => <TspMappingPage />;
  const renderTspProviders = () => <TspProvidersPage />;
  const renderTransactions = () => <MerchantTransactionsPage />;
  const renderAdminPayouts = () => <AdminPayoutManagement />;
  const renderReport = () => <AdminReport />;
  const renderBankApproval = () => <BankApproval />;

  const filteredItems =
    statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  const renderSettlements = () => (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settlements"
        description="Approve and manage settlement requests"
        actions={
          <>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fetchList(page)}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <Panel title="Settlement Requests" meta={`${filteredItems.length} results`}>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Settlement ID</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Settled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className={cellMono}>
                    <span className="truncate max-w-[200px] inline-block align-middle" title={it.txn_id}>{it.txn_id}</span>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">{it.user_id}</TableCell>
                  <TableCell className={`text-right ${cellAmount}`}>{inr.format(it.amount)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(it.settled_date)}</TableCell>
                  <TableCell><StatusBadge status={it.status} /></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(it.requested_at)}</TableCell>
                  <TableCell className="text-right">
                    {settlementLoadingMap[it.txn_id] ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 inline" />
                    ) : (
                      <div className="flex justify-end">
                        <ActionMenu
                          items={
                            it.status === "pending"
                              ? [
                                  { label: "Approve", icon: Check, onClick: () => handleSettlementAction(it.txn_id, "approved") },
                                  { label: "Reject", icon: X, destructive: true, onClick: () => handleSettlementAction(it.txn_id, "rejected") },
                                ]
                              : []
                          }
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState icon={Clock} title="No settlements found" description="Try changing your filters or check back later" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {filteredItems.map((it) => (
            <div key={it.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className={`${cellMono} truncate`}>{it.txn_id}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">Merchant: {it.user_id}</div>
                </div>
                <StatusBadge status={it.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-gray-500">Amount</div>
                  <div className={cellAmount}>{inr.format(it.amount)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Settled</div>
                  <div>{fmtDate(it.settled_date)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Currency</div>
                  <div>{it.currency ?? "INR"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Requested</div>
                  <div>{fmtDate(it.requested_at)}</div>
                </div>
              </div>
              {it.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button variant="success" className="flex-1" onClick={() => handleSettlementAction(it.txn_id, "approved")} disabled={settlementLoadingMap[it.txn_id]}>
                    Approve
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => handleSettlementAction(it.txn_id, "rejected")} disabled={settlementLoadingMap[it.txn_id]}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
          {filteredItems.length === 0 && <EmptyState icon={Clock} title="No settlements found" />}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-[13px] text-gray-500">
          <span>Page {page}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderAnalytics = () => (
    <div className="flex flex-col gap-5">
      <PageHeader title="Analytics" description="Platform performance and pending workload" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Transaction Success Rate" value="94.2%" icon={BarChart3} hint="+2.1% from last month" hintTone="up" />
        <StatCard label="Avg Transaction Size" value="₹8,450" icon={CreditCard} hint="+5.3% from last month" hintTone="up" />
        <StatCard label="Settlement Processing Time" value="2.4 hrs" icon={Clock} hint="-0.8 hrs from last month" hintTone="up" />
      </div>

      <Panel title="Platform Health" meta="Real-time system status">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50/60 dark:border-green-900/60 dark:bg-green-950/20 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 flex items-center justify-center">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">API Uptime</div>
                <div className="text-[11px] text-gray-500">Last 30 days</div>
              </div>
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-400 tabular-nums">99.9%</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Active Merchants" value={summary?.total_merchants ?? "—"} icon={Users} />
            <StatCard label="Pending KYC" value={summary?.merchant_kyc_pending ?? "—"} icon={AlertCircle} />
            <StatCard label="Pending Settlements" value={summary?.total_settle_pending ?? "—"} icon={Clock} />
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboard();
      case "merchants":
        return renderMerchants();
      case "tspMappings":
        return renderTspMappings();
      case "tspProviders":
        return renderTspProviders();
      case "transactions":
        return renderTransactions();
      case "settlements":
        return renderSettlements();
      case "payouts":
        return renderAdminPayouts();
      case "analytics":
        return renderAnalytics();
      case "report":
        return renderReport();
      case "bankApproval":
        return renderBankApproval();
      default:
        return renderDashboard();
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}