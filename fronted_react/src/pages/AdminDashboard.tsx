import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  GradientCard,
  GradientCardContent,
  GradientCardDescription,
  GradientCardHeader,
  GradientCardTitle,
} from "@/components/ui/gradient-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Zap,
  Filter,
  RefreshCw,
  Search,
  Download,
  Eye,
  MoreVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminSummary, AdminSummaryOut } from "@/api/apiHelper";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import DashboardCharts from "@/components/txn/DashboardCharts";
import MerchatList from "@/components/txn/merchantlist";
import MerchantTransactionsPage from "@/components/txn/merchantTxnView";
import AdminPayoutManagement from "@/components/txn/AdminPayoutManagement";
import TspMappingPage from "@/components/admin-part/TspMappingPage";
import TspProvidersPage from "@/components/admin-part/TspProvidersPage";
import AdminReport from "@/components/txn/AdminReport";
import BankApproval from "@/components/txn/BankApproval";

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

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-";

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    pending: "secondary",
    failed: "destructive",
    approved: "default",
    rejected: "destructive",
    requested: "secondary",
    active: "default",
    inactive: "secondary",
    banned: "destructive",
  };
  
  const colors: Record<string, { bg: string, text: string }> = {
    completed: { bg: "bg-gradient-to-r from-emerald-500 to-green-500", text: "text-white" },
    pending: { bg: "bg-gradient-to-r from-amber-500 to-yellow-500", text: "text-white" },
    failed: { bg: "bg-gradient-to-r from-red-500 to-rose-500", text: "text-white" },
    approved: { bg: "bg-gradient-to-r from-blue-500 to-cyan-500", text: "text-white" },
    rejected: { bg: "bg-gradient-to-r from-red-500 to-pink-500", text: "text-white" },
    requested: { bg: "bg-gradient-to-r from-orange-500 to-amber-500", text: "text-white" },
  };

  return (
    <Badge 
      variant={variants[status] || "outline"} 
      className={`capitalize px-3 py-1 rounded-full font-medium ${colors[status]?.bg || ''} ${colors[status]?.text || ''}`}
    >
      {status}
    </Badge>
  );
};

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


  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight bg-gradient-to-r from-[#3871C2] to-[#00ADEF] bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Overview of platform performance and metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchBalance(); }}
            className="rounded-lg border-gray-200 dark:border-gray-700 text-gray-600 hover:border-[#3871C2] hover:text-[#3871C2]">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white dark:bg-gray-800 p-5">
              <div className="h-4 w-28 bg-gray-100 animate-pulse rounded mb-3" />
              <div className="h-7 w-20 bg-gray-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#3871C2] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Merchants</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>{summary?.total_merchants}</h3>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(56,113,194,.08)'}}>
                <Users className="h-5 w-5 text-[#3871C2]" />
              </div>
            </div>
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Active today</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#41B93D] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Today's Volume</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>{inr.format(Number(summary?.today?.success_volume || 0))}</h3>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(65,185,61,.08)'}}>
                <BarChart3 className="h-5 w-5 text-[#41B93D]" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{summary?.today?.success_count || 0} success txns</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#00ADEF] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Today's Transactions</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>{(summary?.today?.payin?.success || 0) + (summary?.today?.payout?.success || 0)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(0,173,239,.08)'}}>
                <CreditCard className="h-5 w-5 text-[#00ADEF]" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{(summary?.yesterday?.payin?.success || 0) + (summary?.yesterday?.payout?.success || 0)} yesterday</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#F68713] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Platform Fees</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>{inr.format(Number(summary?.today?.charges || 0))}</h3>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(246,135,19,.08)'}}>
                <IndianRupee className="h-5 w-5 text-[#F68713]" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{inr.format(Number(summary?.yesterday?.charges || 0))} yesterday</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">No summary data</div>
      )}

      {/* Charts */}
      <DashboardCharts />

      {/* Pending Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50/80 to-white rounded-xl border border-blue-100/60 p-5">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-[#3871C2]" /><span className="text-sm font-semibold text-[#3871C2]">Pending KYC</span></div>
          <p className="text-xs text-gray-500 mb-3">Merchants awaiting verification</p>
          <div className="text-[22px] font-semibold text-[#3871C2]" style={{fontVariantNumeric:'tabular-nums'}}>{summary?.merchant_kyc_pending || 0}</div>
          <button onClick={() => navigate("/admin/merchants")} className="text-xs font-medium text-[#3871C2] mt-3 hover:underline">Review Now →</button>
        </div>
        <div className="bg-gradient-to-br from-amber-50/80 to-white rounded-xl border border-amber-100/60 p-5">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-[#F68713]" /><span className="text-sm font-semibold text-[#F68713]">Pending Settlements</span></div>
          <p className="text-xs text-gray-500 mb-3">Awaiting approval</p>
          <div className="text-[22px] font-semibold text-[#F68713]" style={{fontVariantNumeric:'tabular-nums'}}>{summary?.total_settle_pending || 0}</div>
          <button onClick={() => navigate("/admin/settlements")} className="text-xs font-medium text-[#F68713] mt-3 hover:underline">Manage Now →</button>
        </div>
        <div className="bg-gradient-to-br from-purple-50/80 to-white rounded-xl border border-purple-100/60 p-5">
          <div className="flex items-center gap-2 mb-1"><Shield className="h-4 w-4 text-purple-600" /><span className="text-sm font-semibold text-purple-600">Bank Approvals</span></div>
          <p className="text-xs text-gray-500 mb-3">Accounts pending review</p>
          <div className="text-[22px] font-semibold text-purple-600" style={{fontVariantNumeric:'tabular-nums'}}>{summary?.pending_bank_approvals || 0}</div>
          <button onClick={() => navigate("/admin/bankApproval")} className="text-xs font-medium text-purple-600 mt-3 hover:underline">Review Now →</button>
        </div>
        <div className="bg-gradient-to-br from-emerald-50/80 to-white rounded-xl border border-emerald-100/60 p-5">
          <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-[#41B93D]" /><span className="text-sm font-semibold text-[#41B93D]">Payout Balance</span></div>
          <p className="text-xs text-gray-500 mb-3">Available for settlements</p>
          <div className="text-[22px] font-semibold text-[#41B93D]" style={{fontVariantNumeric:'tabular-nums'}}>{balance ? `₹${balance.balance}` : "—"}</div>
          <button onClick={fetchBalance} className="text-xs font-medium text-[#41B93D] mt-3 hover:underline flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Refresh</button>
        </div>
      </div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[22px] font-semibold bg-gradient-to-r from-[#3871C2] via-[#00ADEF] to-[#41B93D] bg-clip-text text-transparent">
            Settlement Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Approve and manage all settlement requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-40 bg-white dark:bg-gray-800 border-[#00ADEF]">
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

          <Button
            variant="outline"
            className="border-[#00ADEF] text-[#3871C2] hover:bg-[#00ADEF]/10"
            onClick={() => fetchList(page)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <Card className="border-[#00ADEF]/20 shadow-lg">
        <CardContent className="p-6">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-gradient-to-r from-[#3871C2]/5 to-[#00ADEF]/5">
                <TableRow>
                  <TableHead className="font-semibold text-[#3871C2]">Settlement ID</TableHead>
                  <TableHead className="font-semibold text-[#3871C2]">Merchant</TableHead>
                  <TableHead className="font-semibold text-[#3871C2] text-right">Amount</TableHead>
                  <TableHead className="font-semibold text-[#3871C2]">Date</TableHead>
                  <TableHead className="font-semibold text-[#3871C2]">Status</TableHead>
                  <TableHead className="font-semibold text-[#3871C2]">Requested</TableHead>
                  <TableHead className="font-semibold text-[#3871C2] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((it) => (
                  <TableRow key={it.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700/50">
                    <TableCell className="font-mono text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#3871C2]/10 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-[#3871C2]" />
                        </div>
                        <span className="truncate max-w-[180px]" title={it.txn_id}>
                          {it.txn_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{it.user_id}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-[#41B93D] text-lg">
                        {inr.format(it.amount)}
                      </span>
                    </TableCell>
                    <TableCell>{fmtDateTime(it.settled_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={it.status} />
                    </TableCell>
                    <TableCell>{fmtDateTime(it.requested_at)}</TableCell>
                    <TableCell>
                      {it.status === "pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-[#41B93D] to-emerald-500 hover:opacity-90 text-white"
                            onClick={() => handleSettlementAction(it.txn_id, "approved")}
                            disabled={settlementLoadingMap[it.txn_id]}
                          >
                            {settlementLoadingMap[it.txn_id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleSettlementAction(it.txn_id, "rejected")}
                            disabled={settlementLoadingMap[it.txn_id]}
                          >
                            {settlementLoadingMap[it.txn_id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Reject"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <Clock className="h-9 w-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">No settlements found</h3>
                        <p className="text-gray-500">Try changing your filters or check back later</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="block md:hidden space-y-4">
            {filteredItems.map((it) => (
              <Card key={it.id} className="border-[#00ADEF]/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#3871C2]/10 to-[#00ADEF]/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-[#3871C2]" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">ID: {it.txn_id.slice(0, 12)}...</div>
                        <div className="text-xs text-gray-500">Merchant: {it.user_id}</div>
                      </div>
                    </div>
                    <StatusBadge status={it.status} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <div className="text-gray-500">Amount</div>
                      <div className="font-bold text-[#41B93D]">{inr.format(it.amount)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Date</div>
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
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-[#41B93D] to-emerald-500 text-white"
                        onClick={() => handleSettlementAction(it.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600"
                        onClick={() => handleSettlementAction(it.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No settlements found
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Showing {filteredItems.length} settlements
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-[#00ADEF] text-[#3871C2]"
              >
                Previous
              </Button>
              <span className="px-4 py-2 bg-gradient-to-r from-[#3871C2]/10 to-[#00ADEF]/10 rounded-lg font-medium text-[#3871C2]">
                Page {page}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                className="border-[#00ADEF] text-[#3871C2]"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[22px] font-semibold bg-gradient-to-r from-[#3871C2] via-[#00ADEF] to-[#41B93D] bg-clip-text text-transparent">
            Platform Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Detailed insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* <Button variant="outline" className="border-[#00ADEF] text-[#3871C2]">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button> */}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-[#41B93D]">
          <CardHeader>
            <CardTitle className="flex items-center text-[#41B93D]">
              <BarChart3 className="h-5 w-5 mr-2" />
              Transaction Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[22px] font-semibold text-[#41B93D]">94.2%</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+2.1% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#3871C2]">
          <CardHeader>
            <CardTitle className="flex items-center text-[#3871C2]">
              <CreditCard className="h-5 w-5 mr-2" />
              Avg Transaction Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[22px] font-semibold text-[#3871C2]">₹8,450</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+5.3% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#00ADEF]">
          <CardHeader>
            <CardTitle className="flex items-center text-[#00ADEF]">
              <Clock className="h-5 w-5 mr-2" />
              Settlement Processing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[22px] font-semibold text-[#00ADEF]">2.4 hrs</div>
            <div className="flex items-center mt-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">-0.8 hrs from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-gray-50 to-white border">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-gray-100">
            <Shield className="h-5 w-5 mr-2" />
            Platform Health Monitor
          </CardTitle>
          <CardDescription>Real-time system status and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-white rounded-lg border border-emerald-100">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-3">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-medium">API Uptime</div>
                  <div className="text-sm text-gray-500">Last 30 days</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600">99.9%</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Active Merchants", value: summary?.total_merchants || "—", icon: Users, color: "blue" },
                { label: "Pending KYC", value: summary?.merchant_kyc_pending || "—", icon: AlertCircle, color: "amber" },
                { label: "Pending Settlements", value: summary?.total_settle_pending || "—", icon: Clock, color: "orange" },
              ].map((item, index) => (
                <div key={index} className="p-4 bg-white dark:bg-gray-800 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">{item.label}</div>
                      <div className="text-2xl font-bold mt-2" style={{ color: `var(--color-${item.color}-600)` }}>
                        {item.value}
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-full bg-${item.color}-100 flex items-center justify-center`}>
                      <item.icon className={`h-5 w-5 text-${item.color}-600`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
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
      <div className="">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-0 py-8">
          {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}