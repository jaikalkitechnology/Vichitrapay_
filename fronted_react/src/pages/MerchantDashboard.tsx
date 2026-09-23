import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { GradientCard, GradientCardContent, GradientCardDescription, GradientCardHeader, GradientCardTitle } from "@/components/ui/gradient-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, TrendingUp, CreditCard, DollarSign, Copy, Plus, Eye, EyeOff, IndianRupee, User, Banknote, ArrowUpDown, History, Code, Settings, Bell, Shield, RefreshCw, Download, Filter, Search, CheckCircle, Clock, AlertCircle, BarChart3, QrCode, Smartphone, Globe, ShieldCheck, Zap, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getSelfProfile, Merchant, MerchantMetricsResponse, getMerchantMetric, PayoutBankAccountList, listPayoutBankAccounts
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [bankAccounts, setBankAccounts] = useState([]);
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

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight bg-gradient-to-r from-[#3871C2] to-[#00ADEF] bg-clip-text text-transparent">
            Welcome back, {merchant?.full_name?.split(" ")[0] || "Merchant"}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Here's what's happening with your business today</p>
        </div>






      </div>





      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#3871C2] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Balance</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>
                ₹{((merchant?.wallet?.balance || 0) + (merchant?.payout_wallet?.balance || 0)).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(56,113,194,.08)'}}>
              <Wallet className="h-6 w-6 text-[#3871C2]" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              12% from last week
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#41B93D] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Today's Volume</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>
                ₹{getMetricValue('payin', 'total_volume')}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(65,185,61,.08)'}}>
              <BarChart3 className="h-6 w-6 text-[#41B93D]" />
            </div>
          </div>
          <div className="mt-4">
            <Progress value={65} className="h-2 bg-gray-200" />
            <p className="text-xs text-gray-500 mt-2">65% of daily target</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#00ADEF] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Successful Txns</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>
                {getMetricValue('payin', 'total_txns')}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(0,173,239,.08)'}}>
              <CheckCircle className="h-6 w-6 text-[#00ADEF]" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600">98.5% Success Rate</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#F68713] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg. Txn Value</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1.5" style={{fontVariantNumeric:'tabular-nums'}}>
                ₹{summary?.metrics?.payin?.today?.avg_txn_value || "0"}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:'rgba(246,135,19,.08)'}}>
              <CreditCard className="h-6 w-6 text-[#F68713]" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm">
              <Target className="h-4 w-4 mr-1 text-gray-400" />
              <span className="text-gray-600">Industry avg: ₹1,250</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Balances */}
        <div className="lg:col-span-2 space-y-8">
          {/* Timeframe Selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Performance Overview</h2>
            <div className="flex items-center space-x-2">
              {['today', 'yesterday', '7_days', '30_days'].map((timeframe) => (
                <Button
                  key={timeframe}
                  variant={activeTimeframe === timeframe ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTimeframe(timeframe)}
                  className={
                    activeTimeframe === timeframe
                      ? "bg-gradient-to-r from-[#3871C2] to-[#00ADEF]"
                      : "border-gray-300"
                  }
                >
                  {timeframe.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>




          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">




            <Card className="bg-gradient-to-br from-[#3871C2]/5 to-white border-[#3871C2]/20">
              <CardHeader>
                <CardTitle className="text-[#3871C2] flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  PayIn Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Volume</span>
                  <span className="text-lg font-semibold text-[#3871C2]">₹{getMetricValue('payin', 'total_volume')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Transactions</span>
                  <span className="text-lg font-semibold text-[#00ADEF]">{getMetricValue('payin', 'total_txns')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Fees Collected</span>
                  <span className="text-lg font-semibold text-[#F68713]">₹{getMetricValue('payin', 'total_charges')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="text-lg font-semibold text-[#41B93D]">98.5%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#41B93D]/5 to-white border-[#41B93D]/20">
              <CardHeader>
                <CardTitle className="text-[#41B93D] flex items-center">
                  <ArrowUpDown className="h-5 w-5 mr-2" />
                  PayOut Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Volume</span>
                  <span className="text-lg font-semibold text-[#41B93D]">₹{getMetricValue('payout', 'total_volume')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Transactions</span>
                  <span className="text-lg font-semibold text-[#00ADEF]">{getMetricValue('payout', 'total_txns')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Fees</span>
                  <span className="text-lg font-semibold text-[#F68713]">₹{getMetricValue('payout', 'total_charges')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg Processing</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">2.5 hrs</span>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GradientCard className="bg-gradient-to-r from-[#3871C2] to-[#00ADEF] text-white">
              <GradientCardHeader>
                <GradientCardTitle className="flex items-center">
                  <Wallet className="h-5 w-5 mr-2" />
                  PayIn Balance
                </GradientCardTitle>
              </GradientCardHeader>
              <GradientCardContent>
                <div className="text-[22px] font-semibold">
                  ₹{merchant?.wallet?.balance.toLocaleString('en-IN') || "0"}
                </div>
                <p className="text-white/80 text-sm mt-2">Available for transactions</p>
              </GradientCardContent>
            </GradientCard>

            <GradientCard className="bg-gradient-to-r from-[#41B93D] to-emerald-500 text-white">
              <GradientCardHeader>
                <GradientCardTitle className="flex items-center">
                  <IndianRupee className="h-5 w-5 mr-2" />
                  PayOut Balance
                </GradientCardTitle>
              </GradientCardHeader>
              <GradientCardContent>
                <div className="text-[22px] font-semibold">
                  ₹{merchant?.payout_wallet?.balance.toLocaleString('en-IN') || "0"}
                </div>
                <p className="text-white/80 text-sm mt-2">Available for withdrawal</p>
              </GradientCardContent>
            </GradientCard>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <History className="h-5 w-5 mr-2 text-[#3871C2]" />
                  Recent Activity
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('transactions')}
                  className="text-[#3871C2] hover:text-[#3871C2]/80"
                >
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${item.status === 'completed' ? 'bg-green-100 text-green-600' :
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                        {item.status === 'completed' ? <CheckCircle className="h-5 w-5" /> :
                          item.status === 'pending' ? <Clock className="h-5 w-5" /> :
                            <AlertCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">Withdrawal Request</p>
                        <p className="text-sm text-gray-500">ID: {item.txn_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#41B93D]">₹{item.amount}</p>
                      <p className="text-sm text-gray-500">{item.settled_date ? new Date(item.settled_date).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Profile */}
        <div className="space-y-8">
          {/* Profile Card */}
          <Card className="border-[#00ADEF]/20 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-[#3871C2]">
                <User className="h-5 w-5 mr-2" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#3871C2] to-[#00ADEF] flex items-center justify-center text-white text-lg font-semibold">
                    {merchant?.full_name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{merchant?.full_name || merchant?.username}</h3>
                    <p className="text-sm text-gray-600">{merchant?.company_name}</p>
                    <div className="flex items-center mt-1">
                      <Badge variant={merchant?.kyc_verified ? "default" : "secondary"} className={
                        merchant?.kyc_verified
                          ? "bg-gradient-to-r from-[#41B93D] to-green-500"
                          : "bg-gradient-to-r from-[#F68713] to-orange-500"
                      }>
                        {merchant?.kyc_verified ? "✅ KYC Verified" : "⚠️ KYC Pending"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-500 w-24">Email:</span>
                    <span className="font-medium">{merchant?.email}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 w-24">Phone:</span>
                    <span className="font-medium">{merchant?.phone_number}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 w-24">Merchant ID:</span>
                    <span className="font-mono font-medium">{merchant?.id}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => setActiveTab('merchantsTopup')}
                className="w-full justify-start bg-white dark:bg-gray-800/10 hover:bg-white dark:bg-gray-800/20 text-white border-0"
              >
                <Banknote className="h-4 w-4 mr-3" />
                Top Up Balance
              </Button>
              <Button
                onClick={() => setActiveTab('settlements')}
                className="w-full justify-start bg-white dark:bg-gray-800/10 hover:bg-white dark:bg-gray-800/20 text-white border-0"
              >
                <ArrowUpDown className="h-4 w-4 mr-3" />
                Withdraw Funds
              </Button>
              <Button
                onClick={() => setActiveTab('bankAccount')}
                className="w-full justify-start bg-white dark:bg-gray-800/10 hover:bg-white dark:bg-gray-800/20 text-white border-0"
              >
                <Settings className="h-4 w-4 mr-3" />
                Manage Accounts
              </Button>
              <Button
                onClick={() => setActiveTab('passbook')}
                className="w-full justify-start bg-white dark:bg-gray-800/10 hover:bg-white dark:bg-gray-800/20 text-white border-0"
              >
                <CreditCard className="h-4 w-4 mr-3" />
                View Passbook
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderSettlements = () => (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: '#3871C2' }}>Withdraw Funds</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Transfer money from your payout balance to bank accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 transition-colors"
            style={{ borderColor: '#00ADEF', color: '#3871C2' }}
            onClick={fetch}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border overflow-hidden" style={{ borderColor: '#00ADEF' }}>
            {/* Form Header */}
            <div className="p-6 border-b" style={{ borderColor: 'rgba(0, 173, 239, 0.1)', backgroundColor: '#F0F9FF' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#3871C2' }}>New Withdrawal Request</h2>
              <p className="text-gray-600 mt-1">Enter the amount and select a bank account</p>
            </div>

            {/* Form Content */}
            <div className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#3871C2' }}>
                    Amount to Withdraw
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/3 transform -translate-y-1/2 flex items-center">
                      <span className="text-2xl font-bold" style={{ color: '#3871C2' }}>₹</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-4 text-xl border-2 rounded-xl focus:outline-none transition-colors"
                      style={{
                        borderColor: amount ? '#3871C2' : '#CBD5E1',
                        backgroundColor: '#F8FAFC'
                      }}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <button
                        type="button"
                        onClick={() => setAmount((merchant?.payout_wallet?.balance || 0).toString())}
                        className="text-sm font-medium hover:underline"
                        style={{ color: '#00ADEF' }}
                      >
                        Use Max Amount
                      </button>
                      <span className="text-sm text-gray-600">
                        Available: <span className="font-bold ml-1" style={{ color: '#41B93D' }}>
                          ₹{merchant?.payout_wallet?.balance.toLocaleString('en-IN') || "0"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank Account Selection */}
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#3871C2' }}>
                    Select Bank Account
                  </label>

                  {bankAccounts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {bankAccounts.map((account) => (
                        <div
                          key={account.id}
                          onClick={() => setSelectedBank(account.id)}
                          className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedBank === account.id
                            ? 'border-2 shadow-lg'
                            : 'border hover:border-gray-300'
                            }`}
                          style={{
                            borderColor: selectedBank === account.id ? '#3871C2' : '#E5E7EB',
                            backgroundColor: selectedBank === account.id ? '#F0F9FF' : 'white'
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              <div className="h-9 w-12 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: '#3871C2' }}>
                                <Banknote className="h-6 w-6 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold truncate" style={{ color: '#3871C2' }}>
                                {account.bank_name}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">{account.account_mask}</p>
                              <p className="text-xs text-gray-500 mt-1">{account.account_holder_name}</p>
                            </div>
                            {selectedBank === account.id && (
                              <div className="flex-shrink-0">
                                <div className="h-5 w-5 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: '#41B93D' }}>
                                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 border-2 border-dashed rounded-xl text-center"
                      style={{ borderColor: '#00ADEF', backgroundColor: '#F0F9FF' }}>
                      <Banknote className="h-9 w-12 mx-auto mb-4" style={{ color: '#3871C2' }} />
                      <h3 className="text-lg font-semibold mb-2" style={{ color: '#3871C2' }}>No Bank Accounts</h3>
                      <p className="text-gray-600 mb-6">Add a bank account to withdraw funds</p>
                      <Button
                        onClick={() => setActiveTab('bankAccount')}
                        className="px-6"
                        style={{
                          background: 'linear-gradient(135deg, #3871C2, #00ADEF)',
                          color: 'white'
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Bank Account
                      </Button>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 rounded-xl border"
                    style={{ borderColor: '#F68713', backgroundColor: '#FEF6EC' }}>
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5" style={{ color: '#F68713' }} />
                      <p className="font-medium" style={{ color: '#F68713' }}>{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || !amount || !selectedBank}
                  className="w-full py-4 text-lg font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: loading || !amount || !selectedBank
                      ? '#CBD5E1'
                      : 'linear-gradient(135deg, #3871C2, #00ADEF)',
                    color: 'white'
                  }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Processing Withdrawal...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <ArrowUpDown className="h-5 w-5" />
                      Withdraw ₹{amount || "0"}
                    </div>
                  )}
                </Button>

                {/* Security Note */}
                <div className="text-center pt-4">
                  <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <ShieldCheck className="h-4 w-4" style={{ color: '#41B93D' }} />
                    Your transaction is secured with bank-level encryption
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Withdrawal Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border overflow-hidden" style={{ borderColor: '#00ADEF' }}>
            <div className="p-6 border-b" style={{ borderColor: 'rgba(0, 173, 239, 0.1)', backgroundColor: '#F0FDF4' }}>
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#41B93D' }}>
                <Info className="h-5 w-5" />
                Withdrawal Information
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { label: 'Minimum Amount', value: '₹500', color: '#3871C2' },
                  { label: 'Processing Time', value: '2-4 hours', color: '#00ADEF' },
                  { label: 'Processing Fee', value: '₹10 + 1%', color: '#F68713' },
                  { label: 'Daily Limit', value: '₹50,000', color: '#41B93D' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b last:border-0"
                    style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}>
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border overflow-hidden" style={{ borderColor: '#00ADEF' }}>
            <div className="p-6 border-b" style={{ borderColor: 'rgba(0, 173, 239, 0.1)' }}>
              <h3 className="text-lg font-semibold" style={{ color: '#3871C2' }}>Quick Stats</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { label: 'This Month', value: getMetricValue('payout', 'total_volume'), color: '#41B93D', bg: '#F0FDF4' },
                  { label: 'Pending Requests', value: '3', color: '#F68713', bg: '#FEF6EC' },
                  { label: 'Total Withdrawals', value: items.length.toString(), color: '#3871C2', bg: '#F0F9FF' },
                ].map((stat, index) => (
                  <div key={index} className="p-4 rounded-xl" style={{ backgroundColor: stat.bg }}>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{stat.label}</span>
                      <span className="text-lg font-semibold" style={{ color: stat.color }}>
                        {stat.label === 'This Month' ? '₹' : ''}{stat.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Withdrawals */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border overflow-hidden" style={{ borderColor: '#00ADEF' }}>

  {/* Header */}
  <div className="p-6 border-b" style={{ borderColor: 'rgba(0, 173, 239, 0.1)' }}>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">

      {/* Left Title */}
      <div className="flex items-center gap-3">
        <History className="h-5 w-5" style={{ color: '#3871C2' }} />
        <h3 className="text-lg font-semibold" style={{ color: '#3871C2' }}>
          Recent Withdrawals
        </h3>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">

        {/* Search */}
        <div className="relative flex-1 sm:flex-none">
          <input
            placeholder="Search transactions..."
            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none"
            style={{ borderColor: '#00ADEF' }}
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        {/* Filter Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          style={{ borderColor: '#00ADEF', color: '#3871C2' }}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>

      </div>
    </div>
  </div>

  {/* Table */}
  <div className="overflow-x-auto">
    <table className="min-w-[700px] w-full">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-900">
          {['ID', 'Date', 'Amount', 'Bank Account', 'Status', 'Reference'].map((header) => (
            <th
              key={header}
              className="text-left py-4 px-6 text-sm font-semibold whitespace-nowrap"
              style={{ color: '#3871C2' }}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {items.length > 0 ? (
          items.map((item) => (
            <tr key={item.id} className="border-b hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors">

              <td className="py-4 px-6">
                <div className="font-mono text-sm text-gray-700 dark:text-gray-300">{item.id}</div>
              </td>

              <td className="py-4 px-6">
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {item.settled_date
                    ? new Date(item.settled_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </div>
              </td>

              <td className="py-4 px-6">
                <div className="font-bold text-lg" style={{ color: "#41B93D" }}>
                  ₹{item.amount}
                </div>
              </td>

              <td className="py-4 px-6">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap">••••{item.txn_id?.slice(-4)}</span>
                </div>
              </td>

              <td className="py-4 px-6">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    item.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : item.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {item.status}
                </span>
              </td>

              <td className="py-4 px-6">
                <div className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                  {item.txn_id}
                </div>
              </td>

            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="py-12 text-center">
              <History className="h-9 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "#3871C2" }}>
                No Withdrawals Yet
              </h3>
              <p className="text-gray-600">Your withdrawal history will appear here</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>

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
      <div className="">
        <div className="max-w-7x1 mx-auto sm:px-6 lg:px-0 py-">
          {loading && !merchant ? (
            <div className="space-y-8">
              <Skeleton className="h-9 w-64" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Add missing Info icon component
const Info = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);