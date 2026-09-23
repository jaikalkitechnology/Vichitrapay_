// src/pages/admin/AdminDashboard.tsx (MerchatList.tsx)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// --- (Your imports remain the same) ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, KeyRound, Lock, Pencil, PlusCircle, Settings } from "lucide-react";
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

  // Mobile responsive helpers
  const toggleMobileMenu = (merchantId: string) => {
    setMobileMenuOpen(mobileMenuOpen === merchantId ? null : merchantId);
  };

  return (
    <div className="space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Merchants Management</h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Manage merchant accounts, balances, and settings</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={openCreateModal}
              className="h-8"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Merchant
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Total Merchants</p>
                <p className="text-xl sm:text-2xl lg:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '...' : list?.total || 0}
                </p>
              </div>
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">KYC Verified</p>
                <p className="text-xl sm:text-2xl lg:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                  {loading ? '...' : rows.filter(u => u.kyc_verified).length}
                </p>
              </div>
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Main Content Card */}
        <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
          <CardHeader className="border-b border-gray-200 dark:border-gray-800 px-4 py-2.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Merchant List</CardTitle>
                <CardDescription>Manage and monitor all merchant accounts</CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <Input
                    placeholder="Search merchants..."
                    value={params.search ?? ""}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => loadUsers({})}
                    className="rounded-lg border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => loadUsers({ sort_desc: !params.sort_desc })}
                    className="rounded-lg border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {params.sort_desc ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                        </svg>
                        Latest
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        Oldest
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600"></div>
                <p className="mt-4 text-gray-600">Loading merchants...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Error Loading Data</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
                <Button onClick={() => loadUsers()} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : !list || list.items.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No merchants found</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Try adjusting your search or create a new merchant</p>
                <Button onClick={openCreateModal} className="mt-4">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Merchant
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile View - Card Layout */}
                <div className="sm:hidden space-y-3 p-4">
                  {rows.map((u) => (
                    <div key={u.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3 bg-white dark:bg-gray-900">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{u.username}</div>
                            {u.kyc_verified && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 truncate mt-1">{u.email}</div>
                          <div className="text-xs text-gray-500 mt-1">{u.company_name || "-"}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMobileMenu(u.id)}
                          className="ml-2"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-800">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Wallet Balance</div>
                          <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {u.wallet ? `₹${Number(u.wallet.balance).toLocaleString()}` : "-"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Payout Balance</div>
                          <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {u.payout_wallet ? `₹${Number(u.payout_wallet.balance).toLocaleString()}` : "-"}
                          </div>
                        </div>
                      </div>

                      {mobileMenuOpen === u.id && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" onClick={() => openEdit(u)}>
                              Edit
                            </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCredentialsModal(u.id)}
                            className="rounded-lg border-purple-200 text-purple-700 hover:bg-purple-50 whitespace-nowrap"
                          >
                            Credentials
                          </Button>


                            <Button size="sm" variant="outline" onClick={() => openSettingsModal(u.id)}>
                              Settings
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openModal(u, "to_payout")}
                              className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              To Payout
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openModal(u, "to_wallet")}
                              className="rounded-lg border-orange-200 text-orange-700 hover:bg-orange-50"
                            >
                              To Wallet
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openAdjustModal(u.id, "wallet")} className="rounded-lg border-green-200 text-green-700 hover:bg-green-50">
                              Adjust Wallet
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openAdjustModal(u.id, "payout")} className="rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                              Adjust Payout
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openPwdModal(u.id)} className="rounded-lg border-red-200 text-red-700 hover:bg-red-50">
                              Change Password
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop View - Table Layout */}
                <div className="hidden sm:block overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>KYC Status</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead className="text-right">Wallet Balance</TableHead>
                        <TableHead className="text-right">Payout Balance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((u) => (
                        <TableRow key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                  {u.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">{u.username}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-gray-700 dark:text-gray-300">{u.email}</div>
                            <div className="text-sm text-gray-500">{u.phone_number || "-"}</div>
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{u.company_name ?? "-"}</TableCell>
                          <TableCell>
                            {u.kyc_verified ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1">
                                <svg className="w-3 h-3 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600 border-gray-300 px-3 py-1">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.view_password ? (
                              <button
                                type="button"
                                onClick={() => togglePassword(u.id)}
                                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                title={revealed[u.id] ? "Hide password" : "Show password"}
                              >
                                {revealed[u.id] ? u.view_password : "••••••••"}
                                {revealed[u.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                              {u.wallet ? `₹${Number(u.wallet.balance).toLocaleString()}` : "-"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                              {u.payout_wallet ? `₹${Number(u.payout_wallet.balance).toLocaleString()}` : "-"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <ActionMenu
                                label={`Actions for ${u.username}`}
                                items={[
                                  { label: "Edit Merchant", icon: Pencil, onClick: () => openEdit(u) },
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
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 border-t border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{((params.page - 1) * params.per_page) + 1}</span> to{" "}
                  <span className="font-semibold">{Math.min(params.page * params.per_page, list.total)}</span> of{" "}
                  <span className="font-semibold">{list.total}</span> merchants
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadUsers({ page: params.page - 1 })}
                    disabled={params.page <= 1}
                    className="rounded-lg border-gray-300"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 rounded-lg">{params.page}</span>
                    <span className="text-gray-500">of</span>
                    <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadUsers({ page: params.page + 1 })}
                    disabled={params.page >= totalPages}
                    className="rounded-lg border-gray-300"
                  >
                    Next
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- Modals --- */}
      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create New Merchant</h3>
              <button onClick={closeCreateModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateSubmit}>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username *</label>
                <Input
                  placeholder="Enter username"
                  value={createForm.username}
                  onChange={e => setCreateForm(s => ({ ...s, username: e.target.value }))}
                  required
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                <Input
                  placeholder="Enter email"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h3>
            <p className="text-sm text-gray-500 mb-4">Merchant: <span className="font-mono">{pwdUserId}</span></p>
            <form onSubmit={handlePwdSubmit}>
              <div className="mb-4">
                <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1 block">New Password</label>
                <Input
                  type="password"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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