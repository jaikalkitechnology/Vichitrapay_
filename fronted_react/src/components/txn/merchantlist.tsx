// src/pages/admin/AdminDashboard.tsx (MerchatList.tsx)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// --- (Your imports remain the same) ---
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  fetchUsersWithWallets,
  createUser,
  addMerchant,
  updateMerchant,
  fetchAdminMerchantCredentials
} from "@/api/apiHelper";
import {
  PaginatedUsersWithWallets,
  UserWithWallets,
  UserCreatePayload,
  UserUpdatePayload,
  UsersWithWalletsParams,
} from "@/api/apiHelper";
import {
  addMerchantSettings,
  getMerchantSetting,
  updateMerchantSettings,
} from "@/api/apiHelper";
import {
  AlertCircle,
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Check,
  Clock,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkline } from "@/components/txn/DashboardCharts";
import { ActionMenu } from "@/components/admin-part/ui";
import api from "@/api/api"
import {BASE_URL} from "@/config"

export interface MerchantSettings {
  id: string;
  payInCharges: number;
  payOutCharges: number;
  payOutChargesFlat: number | null;
  webhook: string | null;
  webhook_payout: string | null;
  ip: string | null;
}

const AVATAR_TONES = [
  "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
];
const avatarTone = (i: number) => AVATAR_TONES[i % AVATAR_TONES.length];

const fmtMoney = (v?: number | string | null) =>
  v === undefined || v === null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDay = (d?: string | null) => {
  if (!d) return "—";
  const t = new Date(d);
  return `${String(t.getDate()).padStart(2, "0")} ${t.toLocaleString("en-US", { month: "short" })} ${t.getFullYear()}`;
};
const fmtTime = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";

/** Page buttons with gaps: 1 … 4 5 6 … 12 */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

function KycBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
      <Check className="h-3.5 w-3.5" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
      <Clock className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

type MerchantStats = {
  total: number;
  verified: number;
  pending: number;
  addedThisMonth: number;
  addedLastMonth: number;
  verifiedThisMonth: number;
  pendingThisMonth: number;
  trendTotal: number[];
  trendVerified: number[];
  trendPending: number[];
  trendDaily: number[];
};

const STATS_SAMPLE = 500; // max per_page the API allows

/**
 * Header-card numbers. Totals come from the API's counts; month and trend figures
 * come from the newest STATS_SAMPLE sign-ups (exact unless more joined in the window).
 */
async function loadMerchantStats(): Promise<MerchantStats> {
  const [all, verifiedRes] = await Promise.all([
    fetchUsersWithWallets({ page: 1, per_page: STATS_SAMPLE, sort_by: "created_at", sort_desc: true }),
    fetchUsersWithWallets({ page: 1, per_page: 1, kyc_verified: true }),
  ]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const rows = all.items.map((u) => ({ t: u.created_at ? new Date(u.created_at).getTime() : 0, v: u.kyc_verified }));
  const total = all.total;
  const verified = verifiedRes.total;
  const inMonth = rows.filter((r) => r.t >= monthStart);

  // cumulative count at the end of each of the last 8 weeks
  const WEEK = 7 * 24 * 3600 * 1000;
  const cumulative = (count: number, pick: (r: { v: boolean }) => boolean) =>
    Array.from({ length: 8 }, (_, i) => {
      const cutoff = now.getTime() - (7 - i) * WEEK;
      return count - rows.filter((r) => pick(r) && r.t > cutoff).length;
    });

  const daysSoFar = now.getDate();
  const trendDaily = Array.from({ length: Math.max(daysSoFar, 2) }, (_, d) => {
    const start = monthStart + d * 24 * 3600 * 1000;
    return inMonth.filter((r) => r.t >= start && r.t < start + 24 * 3600 * 1000).length;
  });

  return {
    total,
    verified,
    pending: Math.max(0, total - verified),
    addedThisMonth: inMonth.length,
    addedLastMonth: rows.filter((r) => r.t >= lastMonthStart && r.t < monthStart).length,
    verifiedThisMonth: inMonth.filter((r) => r.v).length,
    pendingThisMonth: inMonth.filter((r) => !r.v).length,
    trendTotal: cumulative(total, () => true),
    trendVerified: cumulative(verified, (r) => r.v),
    trendPending: cumulative(Math.max(0, total - verified), (r) => !r.v),
    trendDaily,
  };
}

type SelectedState = { merchant: UserWithWallets; direction: "to_payout" | "to_wallet" } | null;

export default function MerchatList() {
  const { toast } = useToast();
  const [list, setList] = useState<PaginatedUsersWithWallets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<UsersWithWalletsParams>({
    page: 1,
    per_page: 20,
    sort_by: "created_at",
    sort_desc: true,
    search: undefined,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<UserCreatePayload>({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone_number: "",
    company_name: "",
    role: 2,
  });
  const [editingUser, setEditingUser] = useState<UserWithWallets | null>(null);
  const [editForm, setEditForm] = useState<UserUpdatePayload | null>(null);
  const [updating, setUpdating] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsMerchantId, setSettingsMerchantId] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsExists, setSettingsExists] = useState<boolean | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    payInCharges: "" as string | number,
    payOutCharges: "" as string | number,
    payOutChargesFlat: "" as string | number,
    webhook: "" as string | null,
    webhook_payout: "" as string | null,
    ip: "" as string | null,
  });

  // transfer modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedState>(null); // { merchant, direction }
  const [amount, setAmount] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // password change modal
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // wallet adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustWalletType, setAdjustWalletType] = useState<"wallet" | "payout">("wallet");
  const [adjustAction, setAdjustAction] = useState<"increase" | "decrease">("increase");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);
  // Passwords are masked until the admin clicks to reveal one
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const togglePassword = (id: string) => setRevealed((r) => ({ ...r, [id]: !r[id] }));
  // credentials modal
  const [credOpen, setCredOpen] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [credMerchantId, setCredMerchantId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});

  const openCredentialsModal = async (merchantId: string) => {
  setCredMerchantId(merchantId);
  setCredOpen(true);
  setCredLoading(true);
  setCredentials([]);

  try {
    const res = await fetchAdminMerchantCredentials(merchantId);
    setCredentials(res.credentials || []);
  } catch (err) {
    toast({
      title: "Failed to load credentials",
      description: getErrorMessage(err),
    });
  } finally {
    setCredLoading(false);
  }
};
  // helper to extract error message safely
  function getErrorMessage(err: any) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err instanceof Error && err.message) return err.message;
    // axios style
    if (err?.response?.data?.detail) return String(err.response.data.detail);
    if (err?.response?.data?.message) return String(err.response.data.message);
    if (err?.response?.data) return JSON.stringify(err.response.data);
    if (err?.message) return String(err.message);
    return JSON.stringify(err);
  }

  function openModal(merchant: UserWithWallets, direction: "to_payout" | "to_wallet") {
    setSelected({ merchant, direction });
    setAmount("");
    setTransferError(null);
    setOpen(true);
    setMobileMenuOpen(null);
  }

  function closeModal() {
    setOpen(false);
    setSelected(null);
    setAmount("");
    setTransferError(null);
    setTransferLoading(false);
  }

  async function submitTransfer(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selected) return;

    // Amount can be blank -> full transfer. If provided, must be > 0
    let payloadAmount: number | null = null;
    if (amount !== "") {
      const parsed = Number(amount);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setTransferError("Enter a valid amount greater than 0, or leave blank to transfer full balance.");
        return;
      }
      payloadAmount = parsed;
    }

    setTransferLoading(true);
    setTransferError(null);

    const body: any = {
      user_id: selected.merchant.id,
      direction: selected.direction,
    };
    if (payloadAmount !== null) body.amount = payloadAmount;

    try {
      // axios: pass body directly
      const res = await api.post(`${BASE_URL}/admin/transfer`, body);
      const data = res?.data;

      if (!res || res.status >= 400) {
        // try to get message from response
        const msg = getErrorMessage(res?.data ?? res);
        throw new Error(msg);
      }

      // Success
      // Update local list optimistically (if you want)
      // We update the user's wallet/payout balances from response if present
      if (data && data.user_id) {
        setList((prev) => {
          if (!prev) return prev;
          const items = prev.items.map((it) => {
            if (it.id !== data.user_id) return it;
            // copy and patch balances if present in response
            const updated = { ...it };
            if (data.wallet_balance !== undefined && updated.wallet) {
              updated.wallet = { ...updated.wallet, balance: Number(data.wallet_balance) };
            }
            if (data.payout_wallet_balance !== undefined && updated.payout_wallet) {
              updated.payout_wallet = { ...updated.payout_wallet, balance: Number(data.payout_wallet_balance) };
            }
            return updated;
          });
          return { ...prev, items };
        });
      }

      closeModal();
      toast({ title: "Transfer successful", description: `Transferred ₹${data.transferred_amount}.` });
    } catch (err: any) {
      const msg = getErrorMessage(err);
      console.error("Transfer error:", err);
      setTransferError(msg);
      toast({ title: "Transfer failed", description: msg });
      setTransferLoading(false);
    }
  }

  const searchTimer = useRef<number | null>(null);
  const [viewUser, setViewUser] = useState<UserWithWallets | null>(null);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const refreshStats = useCallback(() => {
    loadMerchantStats()
      .then(setStats)
      .catch((err) => console.error("merchant stats", err));
  }, []);
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const loadUsers = useCallback(
    async (overrideParams?: Partial<UsersWithWalletsParams>) => {
      setLoading(true);
      setError(null);
      try {
        const merged = { ...params, ...(overrideParams ?? {}) };
        const data = await fetchUsersWithWallets(merged);
        setList(data);
        setParams((p) => ({ ...p, ...(overrideParams ?? {}) }));
      } catch (err: any) {
        console.error("fetch users", err);
        const msg = getErrorMessage(err);
        setError(msg);
        toast({ title: "Failed to load users", description: msg });
      } finally {
        setLoading(false);
      }
    },
    [params, toast]
  );

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = useMemo(() => {
    if (!list) return 1;
    return Math.max(1, Math.ceil(list.total / list.per_page));
  }, [list]);

  const openCreateModal = () => setCreateOpen(true);
  const closeCreateModal = () => setCreateOpen(false);

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setCreating(true);
    try {
      await addMerchant(createForm);
      toast({ title: "Merchant created", description: `${createForm.username} created.` });
      await loadUsers({ page: 1 });
      refreshStats();
      closeCreateModal();
      setCreateForm({ username: "", email: "", password: "", full_name: "", phone_number: "", company_name: "", role: 2 });
    } catch (err: any) {
      console.error("create error", err);
      const msg = getErrorMessage(err);
      toast({ title: "Create failed", description: msg });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: UserWithWallets) => {
    setEditingUser(u);
    setEditForm({
      username: u.username,
      email: u.email,
      full_name: u.full_name ?? undefined,
      phone_number: u.phone_number ?? undefined,
      company_name: u.company_name ?? undefined,
      role: u.role ?? undefined,
      kyc_verified: u.kyc_verified,
    });
    setMobileMenuOpen(null);
  };

  const handleUpdateSubmit = async () => {
    if (!editingUser || !editForm) return;
    setUpdating(true);
    try {
      const updated = await updateMerchant(editingUser.id, editForm);
      toast({ title: "Updated", description: `${editingUser.username} updated.` });
      setList((prev) => {
        if (!prev) return prev;
        const items = prev.items.map((it) => (it.id === editingUser.id ? { ...it, ...updated } as UserWithWallets : it));
        return { ...prev, items };
      });
      setEditingUser(null);
      setEditForm(null);
      refreshStats();
    } catch (err: any) {
      console.error("update error", err);
      toast({ title: "Update failed", description: getErrorMessage(err) });
    } finally {
      setUpdating(false);
    }
  };

  const onSearchChange = (value: string) => {
    setParams((p) => ({ ...p, search: value }));
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      loadUsers({ page: 1, search: value });
    }, 400) as unknown as number;
  };

  const rows = list?.items ?? [];

  const openSettingsModal = async (merchantId: string) => {
    setSettingsError(null);
    setSettingsMerchantId(merchantId);
    setSettingsModalOpen(true);
    setSettingsLoading(true);
    setSettingsExists(null);
    setMobileMenuOpen(null);
    try {
      const data = await getMerchantSetting(merchantId);
      setSettingsForm({
        payInCharges: data.payInCharges ?? "",
        payOutCharges: data.payOutCharges ?? "",
        payOutChargesFlat: data.payOutChargesFlat ?? "",
        webhook: data.webhook ?? "",
        webhook_payout: data.webhook_payout ?? "",
        ip: data.ip ?? "",
      });
      setSettingsExists(true);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setSettingsForm({ payInCharges: "", payOutCharges: "", payOutChargesFlat: "", webhook: "", webhook_payout: "", ip: "" });
        setSettingsExists(false);
      } else {
        setSettingsError(getErrorMessage(err));
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  const closeSettingsModal = () => {
    setSettingsModalOpen(false);
  };

  const handleSettingsSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!settingsMerchantId) return;
    setSettingsError(null);

    const pin = settingsForm.payInCharges === "" ? null : Number(settingsForm.payInCharges);
    const pout = settingsForm.payOutCharges === "" ? null : Number(settingsForm.payOutCharges);
    const poutFlat = settingsForm.payOutChargesFlat === "" ? null : Number(settingsForm.payOutChargesFlat);
    if (pin === null || isNaN(pin) || pout === null || isNaN(pout)) {
      setSettingsError("PayIn and PayOut charges are required numbers.");
      return;
    }

    const payload = {
      id: settingsMerchantId,
      payInCharges: pin,
      payOutCharges: pout,
      payOutChargesFlat: poutFlat,
      webhook: settingsForm.webhook || null,
      webhook_payout: settingsForm.webhook_payout || null,
      ip: settingsForm.ip || null,
    };

    setSettingsSaving(true);
    try {
      if (settingsExists) {
        await updateMerchantSettings(settingsMerchantId, payload);
        toast({ title: "Updated", description: `Settings updated.` });
      } else {
        await addMerchantSettings(payload);
        toast({ title: "Created", description: `Settings created.` });
      }
      closeSettingsModal();
    } catch (err: any) {
      setSettingsError(getErrorMessage(err));
    } finally {
      setSettingsSaving(false);
    }
  };

  // Password change
  const openPwdModal = (userId: string) => {
    setPwdUserId(userId);
    setPwdValue("");
    setPwdOpen(true);
    setMobileMenuOpen(null);
  };

  const handlePwdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pwdUserId || pwdValue.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters" });
      return;
    }
    setPwdLoading(true);
    try {
      await api.patch(`${BASE_URL}/admin/user/${pwdUserId}/password`, { new_password: pwdValue });
      toast({ title: "Password Changed", description: "Merchant password updated successfully." });
      setPwdOpen(false);
    } catch (err: any) {
      toast({ title: "Failed", description: getErrorMessage(err) });
    } finally {
      setPwdLoading(false);
    }
  };

  // Wallet adjust
  const openAdjustModal = (userId: string, walletType: "wallet" | "payout") => {
    setAdjustUserId(userId);
    setAdjustWalletType(walletType);
    setAdjustAction("increase");
    setAdjustAmount("");
    setAdjustOpen(true);
    setMobileMenuOpen(null);
  };

  const handleAdjustSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!adjustUserId || !adjustAmount || Number(adjustAmount) <= 0) {
      toast({ title: "Error", description: "Enter a valid amount" });
      return;
    }
    setAdjustLoading(true);
    try {
      const res = await api.post(`${BASE_URL}/admin/wallet-adjust`, {
        user_id: adjustUserId,
        wallet_type: adjustWalletType,
        action: adjustAction,
        amount: Number(adjustAmount),
      });
      const data = res.data;
      toast({ title: "Balance Updated", description: data.message });
      // update local list
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) => {
            if (it.id !== adjustUserId) return it;
            const updated = { ...it };
            if (data.wallet_balance !== undefined && updated.wallet) {
              updated.wallet = { ...updated.wallet, balance: data.wallet_balance };
            }
            if (data.payout_wallet_balance !== undefined && updated.payout_wallet) {
              updated.payout_wallet = { ...updated.payout_wallet, balance: data.payout_wallet_balance };
            }
            return updated;
          }),
        };
      });
      setAdjustOpen(false);
    } catch (err: any) {
      toast({ title: "Failed", description: getErrorMessage(err) });
    } finally {
      setAdjustLoading(false);
    }
  };

  const refreshAll = () => {
    loadUsers({});
    refreshStats();
  };

  // Mobile responsive helpers
  const toggleMobileMenu = (merchantId: string) => {
    setMobileMenuOpen(mobileMenuOpen === merchantId ? null : merchantId);
  };

  const startItem = list && list.total > 0 ? (params.page - 1) * params.per_page + 1 : 0;
  const endItem = list ? Math.min(params.page * params.per_page, list.total) : 0;
  const kycFilter = params.kyc_verified === undefined ? "all" : params.kyc_verified ? "verified" : "pending";

  const statCards = [
    { label: "Total Merchants", value: stats?.total, icon: Users, tile: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", line: "#3B6BF6", added: stats?.addedThisMonth, trend: stats?.trendTotal },
    { label: "KYC Verified", value: stats?.verified, icon: ShieldCheck, tile: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", line: "#8B5CF6", added: stats?.verifiedThisMonth, trend: stats?.trendVerified },
    { label: "New This Month", value: stats?.addedThisMonth, icon: UserPlus, tile: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400", line: "#22C55E", added: stats?.addedLastMonth, addedLabel: "last month", trend: stats?.trendDaily },
    { label: "KYC Pending", value: stats?.pending, icon: ShieldAlert, tile: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", line: "#F43F5E", added: stats?.pendingThisMonth, trend: stats?.trendPending, warn: true },
  ];

  const iconAction =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-indigo-600 shadow-sm transition hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40";

  return (
    <div className="space-y-5">
      <div className="space-y-5">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Merchants Management</h1>
            <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Manage merchant accounts, balances, and settings</p>
          </div>
          <Button onClick={openCreateModal} className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25">
            <Plus /> Add Merchant
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${c.tile}`}>
                  <c.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{c.label}</p>
                  <p className="mt-1 text-[28px] font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">
                    {c.value === undefined ? "…" : c.value.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                {c.added !== undefined ? (
                  <p className={`flex items-center gap-1 text-[13px] font-medium ${c.warn && c.added > 0 ? "text-rose-600 dark:text-rose-400" : c.added > 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                    <TrendingUp className="h-3.5 w-3.5" />
                    {c.addedLabel ? `${c.added} ${c.addedLabel}` : `+${c.added} this month`}
                  </p>
                ) : <span />}
                {c.trend && <Sparkline values={c.trend} color={c.line} className="h-10 w-24 flex-shrink-0" />}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Merchant List</h2>
              <p className="mt-0.5 text-[14px] text-gray-500">Manage and monitor all merchant accounts</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by name, email or contact..."
                  value={params.search ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-11 w-full rounded-xl pl-10 sm:w-72"
                  aria-label="Search merchants"
                />
              </div>
              <div className="flex gap-3">
                <Select
                  value={kycFilter}
                  onValueChange={(v) => loadUsers({ page: 1, kyc_verified: v === "all" ? undefined : v === "verified" })}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl sm:w-40" aria-label="KYC status filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All KYC Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={refreshAll} className="h-11 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <RefreshCw /> Refresh
                </Button>
              </div>
            </div>
          </div>

          <div>
            {loading ? (
              <div className="flex flex-col items-center justify-center border-t border-gray-100 py-16 dark:border-gray-800">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
                <p className="mt-4 text-[13px] text-gray-500">Loading merchants...</p>
              </div>
            ) : error ? (
              <div className="border-t border-gray-100 p-8 text-center dark:border-gray-800">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Error Loading Data</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
                <Button onClick={() => loadUsers()} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : !list || list.items.length === 0 ? (
              <div className="border-t border-gray-100 p-12 text-center dark:border-gray-800">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No merchants found</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Try adjusting your search or create a new merchant</p>
                <Button onClick={openCreateModal} className="mt-4">
                  <Plus /> Add First Merchant
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile View - Card Layout */}
                <div className="space-y-3 border-t border-gray-100 p-4 dark:border-gray-800 sm:hidden">
                  {rows.map((u, i) => (
                    <div key={u.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start gap-3">
                        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${avatarTone(i)}`}>
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{u.username}</div>
                          <div className="truncate text-[13px] text-gray-500">{u.email}</div>
                          <div className="mt-1.5"><KycBadge verified={u.kyc_verified} /></div>
                        </div>
                        <button onClick={() => toggleMobileMenu(u.id)} className={iconAction} aria-label={`Actions for ${u.username}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                        <div>
                          <div className="mb-1 text-[12px] text-gray-500">Wallet Balance</div>
                          <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtMoney(u.wallet?.balance)}</div>
                        </div>
                        <div>
                          <div className="mb-1 text-[12px] text-gray-500">Payout Balance</div>
                          <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtMoney(u.payout_wallet?.balance)}</div>
                        </div>
                      </div>

                      {mobileMenuOpen === u.id && (
                        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                          <Button size="sm" variant="outline" onClick={() => setViewUser(u)}>View</Button>
                          <Button size="sm" onClick={() => openEdit(u)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => openCredentialsModal(u.id)}>Credentials</Button>
                          <Button size="sm" variant="outline" onClick={() => openSettingsModal(u.id)}>Settings</Button>
                          <Button size="sm" variant="outline" onClick={() => openModal(u, "to_payout")}>To Payout</Button>
                          <Button size="sm" variant="outline" onClick={() => openModal(u, "to_wallet")}>To Wallet</Button>
                          <Button size="sm" variant="outline" onClick={() => openAdjustModal(u.id, "wallet")}>Adjust Wallet</Button>
                          <Button size="sm" variant="outline" onClick={() => openAdjustModal(u.id, "payout")}>Adjust Payout</Button>
                          <Button size="sm" variant="outline" onClick={() => openPwdModal(u.id)} className="col-span-2 text-red-600 hover:text-red-700">
                            Change Password
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop View - Table Layout */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 dark:bg-gray-800/40 [&>th]:whitespace-nowrap">
                        <TableHead className="w-10 pl-5">#</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>KYC Status</TableHead>
                        <TableHead className="text-right">Wallet Balance</TableHead>
                        <TableHead className="text-right">Payout Balance</TableHead>
                        <TableHead>
                          <button
                            onClick={() => loadUsers({ page: 1, sort_desc: !params.sort_desc })}
                            className="inline-flex items-center gap-1 uppercase hover:text-gray-900 dark:hover:text-gray-100"
                            title={params.sort_desc ? "Newest first — click for oldest first" : "Oldest first — click for newest first"}
                          >
                            Created At {params.sort_desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                          </button>
                        </TableHead>
                        <TableHead className="pr-4 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((u, i) => (
                        <TableRow key={u.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <TableCell className="pl-5 text-gray-600 dark:text-gray-400">{startItem + i}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${avatarTone(i)}`}>
                                {u.username.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{u.username}</div>
                                <div className="max-w-[160px] truncate text-[13px] text-gray-500">{u.full_name || u.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Phone className="h-3.5 w-3.5 text-gray-400" /> {u.phone_number || "—"}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[13px] text-gray-500">
                              <Mail className="h-3.5 w-3.5 text-gray-400" /> {u.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{u.company_name || "—"}</TableCell>
                          <TableCell><KycBadge verified={u.kyc_verified} /></TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtMoney(u.wallet?.balance)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtMoney(u.payout_wallet?.balance)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-gray-700 dark:text-gray-300">{fmtDay(u.created_at)}</div>
                            <div className="text-[13px] text-gray-500">{fmtTime(u.created_at)}</div>
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => setViewUser(u)} className={iconAction} aria-label={`View ${u.username}`} title="View details">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button onClick={() => openEdit(u)} className={iconAction} aria-label={`Edit ${u.username}`} title="Edit merchant">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <ActionMenu
                                label={`More actions for ${u.username}`}
                                items={[
                                  { label: "Settings", icon: Settings, onClick: () => openSettingsModal(u.id) },
                                  { label: "Credentials", icon: KeyRound, onClick: () => openCredentialsModal(u.id) },
                                  { label: "Transfer to Payout", icon: ArrowUpRight, onClick: () => openModal(u, "to_payout") },
                                  { label: "Transfer to Wallet", icon: ArrowDownLeft, onClick: () => openModal(u, "to_wallet") },
                                  { label: "Adjust Wallet", icon: PlusCircle, onClick: () => openAdjustModal(u.id, "wallet") },
                                  { label: "Adjust Payout", icon: PlusCircle, onClick: () => openAdjustModal(u.id, "payout") },
                                  { label: "Change Password", icon: Lock, destructive: true, onClick: () => openPwdModal(u.id) },
                                ]}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* Pagination */}
            {list && list.total > 0 && (
              <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 px-5 py-5 dark:border-gray-800 md:flex-row">
                <div className="text-[14px] text-gray-500">
                  Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{startItem}</span> to{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{endItem}</span> of{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{list.total}</span> merchants
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadUsers({ page: params.page - 1 })}
                    disabled={params.page <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pageNumbers(params.page, totalPages).map((n, i) =>
                    n === null ? (
                      <span key={`gap${i}`} className="px-1 text-gray-400">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => n !== params.page && loadUsers({ page: n })}
                        aria-current={n === params.page ? "page" : undefined}
                        className={
                          n === params.page
                            ? "flex h-10 min-w-10 items-center justify-center rounded-xl bg-indigo-600 px-3 text-[14px] font-semibold text-white shadow-md shadow-indigo-600/25"
                            : "flex h-10 min-w-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-[14px] text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        }
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => loadUsers({ page: params.page + 1 })}
                    disabled={params.page >= totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Merchant */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Merchant Details</DialogTitle>
            <DialogDescription>{viewUser?.id}</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {([
                ["Username", viewUser.username],
                ["Full Name", viewUser.full_name || "—"],
                ["Email", viewUser.email],
                ["Phone", viewUser.phone_number || "—"],
                ["Company", viewUser.company_name || "—"],
                ["KYC Status", <KycBadge key="kyc" verified={viewUser.kyc_verified} />],
                ["Wallet Balance", fmtMoney(viewUser.wallet?.balance)],
                ["Payout Balance", fmtMoney(viewUser.payout_wallet?.balance)],
                ["Created At", viewUser.created_at ? `${fmtDay(viewUser.created_at)}, ${fmtTime(viewUser.created_at)}` : "—"],
                [
                  "Password",
                  viewUser.view_password ? (
                    <button
                      key="pwd"
                      type="button"
                      onClick={() => togglePassword(viewUser.id)}
                      className="inline-flex items-center gap-1.5 rounded-md font-mono text-[13px] hover:text-indigo-600"
                      title={revealed[viewUser.id] ? "Hide password" : "Show password"}
                    >
                      {revealed[viewUser.id] ? viewUser.view_password : "••••••••"}
                      {revealed[viewUser.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  ) : "—",
                ],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="mt-0.5 break-all font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
            <Button onClick={() => { const u = viewUser; setViewUser(null); if (u) openEdit(u); }}>
              <Pencil /> Edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Modals --- */}
      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
          <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Merchant</h3>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
                <Input
                  value={editForm?.username}
                  onChange={e => setEditForm({ ...editForm!, username: e.target.value })}
                 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <Input
                  value={editForm?.email}
                  onChange={e => setEditForm({ ...editForm!, email: e.target.value })}
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                <Input
                  value={editForm?.full_name}
                  onChange={e => setEditForm({ ...editForm!, full_name: e.target.value })}
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone Number</label>
                <Input
                  value={editForm?.phone_number}
                  onChange={e => setEditForm({ ...editForm!, phone_number: e.target.value })}
                 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Company Name</label>
                <Input
                  value={editForm?.company_name}
                  onChange={e => setEditForm({ ...editForm!, company_name: e.target.value })}
                 
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <input
                    type="checkbox"
                    checked={!!editForm?.kyc_verified}
                    onChange={e => setEditForm({ ...editForm!, kyc_verified: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300"
                  />
                  <div>
                    <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">KYC Verified</label>
                    <p className="text-xs text-gray-500">Mark this merchant as KYC verified</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="h-8 px-4">
                Cancel
              </Button>
              <Button onClick={handleUpdateSubmit} disabled={updating} className="h-8 px-4">
                {updating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
          <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create New Merchant</h3>
              <button onClick={closeCreateModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateSubmit} autoComplete="off">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username *</label>
                <Input
                  placeholder="Enter username"
                  autoComplete="off"
                  value={createForm.username}
                  onChange={e => setCreateForm(s => ({ ...s, username: e.target.value }))}
                  required
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                <Input
                  placeholder="Enter email"
                  autoComplete="off"
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(s => ({ ...s, email: e.target.value }))}
                  required
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password *</label>
                <Input
                  placeholder="Enter password"
                  type="password"
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={e => setCreateForm(s => ({ ...s, password: e.target.value }))}
                  required
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                <Input
                  placeholder="Enter full name"
                  value={createForm.full_name}
                  onChange={e => setCreateForm(s => ({ ...s, full_name: e.target.value }))}
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone Number</label>
                <Input
                  placeholder="Enter phone number"
                  value={createForm.phone_number}
                  onChange={e => setCreateForm(s => ({ ...s, phone_number: e.target.value }))}
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Company Name</label>
                <Input
                  placeholder="Enter company name"
                  value={createForm.company_name}
                  onChange={e => setCreateForm(s => ({ ...s, company_name: e.target.value }))}
                 
                />
              </div>
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button variant="outline" type="button" onClick={closeCreateModal} className="h-8 px-4">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="h-8 px-4">
                  {creating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : 'Create Merchant'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
          <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Merchant Settings</h3>
              <button onClick={closeSettingsModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {settingsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600"></div>
                <p className="mt-4 text-gray-600">Loading settings...</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSettingsSave}>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pay In Charges (%) *</label>
                  <Input
                    value={String(settingsForm.payInCharges)}
                    onChange={e => setSettingsForm(s => ({ ...s, payInCharges: e.target.value }))}
                    type="number"
                    step="0.01"
                   
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pay Out Charges (%) *</label>
                  <Input
                    value={String(settingsForm.payOutCharges)}
                    onChange={e => setSettingsForm(s => ({ ...s, payOutCharges: e.target.value }))}
                    type="number"
                    step="0.01"
                   
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pay Out Charges (Flat INR)</label>
                  <Input
                    value={String(settingsForm.payOutChargesFlat)}
                    onChange={e => setSettingsForm(s => ({ ...s, payOutChargesFlat: e.target.value }))}
                    type="number"
                    step="0.01"
                   
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">PayIn Webhook URL</label>
                  <Input
                    value={settingsForm.webhook ?? ''}
                    onChange={e => setSettingsForm(s => ({ ...s, webhook: e.target.value }))}
                    placeholder="https://example.com/webhook/payin"
                   
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">PayOut Webhook URL</label>
                  <Input
                    value={settingsForm.webhook_payout ?? ''}
                    onChange={e => setSettingsForm(s => ({ ...s, webhook_payout: e.target.value }))}
                    placeholder="https://example.com/webhook/payout"
                   
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">IP Whitelist</label>
                  <Input
                    value={settingsForm.ip ?? ''}
                    onChange={e => setSettingsForm(s => ({ ...s, ip: e.target.value }))}
                    placeholder="192.168.1.1 or 192.168.1.0/24"
                   
                  />
                </div>
                {settingsError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center text-red-700">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm">{settingsError}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <Button variant="outline" type="button" onClick={closeSettingsModal} className="h-8 px-4">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={settingsSaving} className="h-8 px-4">
                    {settingsSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving...
                      </>
                    ) : 'Save Settings'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {open && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {selected.direction === "to_payout" ? "Wallet → Payout Transfer" : "Payout → Wallet Transfer"}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Merchant: <span className="font-semibold">{selected.merchant.username}</span>
                </p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitTransfer}>
              <div className="mb-6">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Amount (leave blank for full transfer)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">₹</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Available: ₹${
                      selected.direction === "to_payout" 
                        ? Number(selected.merchant.wallet?.balance || 0).toFixed(2)
                        : Number(selected.merchant.payout_wallet?.balance || 0).toFixed(2)
                    }`}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Leave empty to transfer the full available balance
                </p>
              </div>

              {transferError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-700">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{transferError}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button
                  type="button"
                  onClick={closeModal}
                  variant="outline"
                  className="h-8 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={transferLoading}
                  className={selected.direction === "to_payout" ? "h-8 px-4" : "h-8 px-4 bg-amber-500 hover:bg-amber-600"}
                >
                  {transferLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : 'Confirm Transfer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {credOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Merchant Credentials
          </h3>
          <p className="text-sm text-gray-500">
            Merchant ID: {credMerchantId}
          </p>
        </div>
        <button onClick={() => setCredOpen(false)}>
          ✕
        </button>
      </div>

      {credLoading ? (
        <div className="text-center py-10">Loading credentials...</div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No credentials found
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map((c, idx) => {
            const visible = showSecret[c.provider_id];
            return (
              <div
                key={idx}
                className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="font-semibold text-indigo-600">
                      {c.provider_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.direction.toUpperCase()} • MID: {c.mid}
                    </div>
                  </div>

                  <button
                    className="text-sm text-blue-600"
                    onClick={() =>
                      setShowSecret((p) => ({
                        ...p,
                        [c.provider_id]: !p[c.provider_id],
                      }))
                    }
                  >
                    {visible ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  {[
                    ["Client ID", c.client_id],
                    ["Secret Key", c.secret_key],
                    ["Salt Key 1", c.salt_key1],
                    ["Salt Key 2", c.salt_key2],
                    ["Salt Key 3", c.salt_key3],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-gray-500">{label}</div>
                      <div className="flex items-center gap-2">
                        <span className="break-all">
                          {visible ? value : "••••••••••••••••"}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(value)}
                          className="text-blue-600"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
)}

      {/* Password Change Modal */}
      {pwdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h3>
            <p className="text-sm text-gray-500 mb-4">Merchant: <span className="font-mono">{pwdUserId}</span></p>
            <form onSubmit={handlePwdSubmit} autoComplete="off">
              <div className="mb-4">
                <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1 block">New Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 6 characters"
                  value={pwdValue}
                  onChange={(e) => setPwdValue(e.target.value)}
                 
                  minLength={6}
                  required
                />
              </div>
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button type="button" variant="outline" onClick={() => setPwdOpen(false)} className="h-8">
                  Cancel
                </Button>
                <Button type="submit" disabled={pwdLoading} className="h-8">
                  {pwdLoading ? "Saving..." : "Update Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet Adjust Modal */}
      {adjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 !m-0 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Adjust {adjustWalletType === "wallet" ? "Wallet" : "Payout Wallet"} Balance
            </h3>
            <p className="text-sm text-gray-500 mb-4">Merchant: <span className="font-mono">{adjustUserId}</span></p>
            <form onSubmit={handleAdjustSubmit}>
              <div className="mb-4">
                <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1 block">Action</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustAction("increase")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      adjustAction === "increase"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 hover:bg-green-50"
                    }`}
                  >
                    + Increase
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction("decrease")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      adjustAction === "decrease"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 hover:bg-red-50"
                    }`}
                  >
                    - Decrease
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1 block">Amount (INR)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Enter amount"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                 
                  required
                />
              </div>
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)} className="h-8">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={adjustLoading}
                  className="rounded-lg h-8 text-white"
                  style={{ backgroundColor: adjustAction === "increase" ? "#16A34A" : "#DC2626" }}
                >
                  {adjustLoading ? "Processing..." : adjustAction === "increase" ? "Add Funds" : "Deduct Funds"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}