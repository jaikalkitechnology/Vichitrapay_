// Admin Payout Management — display accounts shown to merchants, and top-up approvals
import { useCallback, useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { fetchUsersWithWallets } from "@/api/apiHelper";
import type { UserWithWallets } from "@/api/apiHelper";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Hourglass,
  IndianRupee,
  Info,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import Pager from "@/components/admin-part/Pager";
import { DateRangeInput } from "@/components/admin-part/filterBits";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";

type DisplayAccount = {
  id: number;
  account_holder_name?: string | null;
  beneficiary_account_number?: string | null;
  beneficiary_ifsc?: string | null;
  beneficiary_bank_name?: string | null;
  is_validate?: boolean | null;
};

type Topup = {
  id: number;
  user_id: string;
  payer_name?: string | null;
  payer_bank_name?: string | null;
  beneficiary_account_number?: string | null;
  beneficiary_bank_name?: string | null;
  amount: number;
  instrument?: string | null;
  utr_or_txn_id?: string | null;
  reference_note?: string | null;
  receipt_url?: string | null;
  status: string;
  created_at?: string | null;
  verified_at?: string | null;
  admin_notes?: string | null;
  user?: { username?: string | null; company_name?: string | null } | null;
  verified_by_user?: { username?: string | null } | null;
};

type Page<T> = { total: number; items: T[] };

const EMPTY_FORM = { account_holder_name: "", beneficiary_account_number: "", beneficiary_ifsc: "", beneficiary_bank_name: "", is_validate: false };
const INSTRUMENT: Record<string, string> = { bank: "Bank", upi: "UPI", netbanking: "NetBanking", card: "Card", other: "Other" };

const money = (v?: number | null) => (v === undefined || v === null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
const fmtWhen = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const errText = (e: unknown) => errorText(e);

/** Receipts are stored as paths relative to the API host. */
function receiptUrl(raw?: string | null) {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const base = API_ORIGIN.replace(/\/$/, "");
  return raw.startsWith("/") ? base + raw : `${base}/${raw}`;
}

function IconInput({ icon: Icon, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon: typeof User }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input {...props} className={`${filterInputCls} pl-10`} />
    </div>
  );
}

function AccountStatus({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
      <Check className="h-3.5 w-3.5" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
      <Clock className="h-3.5 w-3.5" /> Inactive
    </span>
  );
}

const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const TH = "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500";
const TD = "whitespace-nowrap px-3 py-3 text-[13px] text-gray-700 dark:text-gray-300";

export default function AdminPayoutManagement() {
  const { toast } = useToast();

  // display accounts
  const [accounts, setAccounts] = useState<DisplayAccount[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [deleting, setDeleting] = useState<DisplayAccount | null>(null);

  // top-ups
  const [tab, setTab] = useState<"pending" | "verified">("pending");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [topups, setTopups] = useState<Page<Topup> | null>(null);
  const [counts, setCounts] = useState<{ pending: number; verified: number; verifiedMonth: number } | null>(null);
  const [merchants, setMerchants] = useState<UserWithWallets[]>([]);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [confirmAll, setConfirmAll] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [rejecting, setRejecting] = useState<Topup | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState<Topup | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get(`${BASE_URL}/admin/admin/display-account`);
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("display accounts", e);
      setAccounts([]);
    }
  }, []);

  const loadMerchants = useCallback(() => {
    fetchUsersWithWallets({ page: 1, per_page: 500 })
      .then((r) => setMerchants(r.items))
      .catch(() => setMerchants([]));
  }, []);

  const loadCounts = useCallback(async () => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    try {
      const [p, v, vm] = await Promise.all([
        api.get(`${BASE_URL}/admin/admin/topup/pending`, { params: { page: 1, per_page: 1 } }),
        api.get(`${BASE_URL}/admin/admin/topup/verified`, { params: { page: 1, per_page: 1 } }),
        api.get(`${BASE_URL}/admin/admin/topup/verified`, { params: { page: 1, per_page: 1, date_from: monthStart } }),
      ]);
      setCounts({ pending: p.data?.total ?? 0, verified: v.data?.total ?? 0, verifiedMonth: vm.data?.total ?? 0 });
    } catch (e) {
      console.error("topup counts", e);
    }
  }, []);

  const loadTopups = useCallback(async () => {
    setTopups(null);
    const params: Record<string, string | number> = { page, per_page: perPage };
    if (merchantFilter) params.user_id = merchantFilter;
    if (range.from) params.date_from = range.from;
    if (range.to) params.date_to = `${range.to}T23:59:59`;
    try {
      const res = await api.get(`${BASE_URL}/admin/admin/topup/${tab}`, { params });
      setTopups({ total: res.data?.total ?? 0, items: res.data?.items ?? [] });
    } catch (e) {
      toast({ title: "Could not load top-ups", description: errText(e), variant: "destructive" });
      setTopups({ total: 0, items: [] });
    }
  }, [tab, page, merchantFilter, range, toast]);

  useEffect(() => {
    loadAccounts();
    loadMerchants();
    loadCounts();
  }, [loadAccounts, loadMerchants, loadCounts]);

  useEffect(() => {
    loadTopups();
  }, [loadTopups]);

  const refreshTopups = () => {
    loadTopups();
    loadCounts();
    loadMerchants(); // payout balances change on approval
  };

  // ---- display account form ----
  async function submitAccount(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...form,
      account_holder_name: form.account_holder_name.trim(),
      beneficiary_account_number: form.beneficiary_account_number.trim(),
      beneficiary_ifsc: form.beneficiary_ifsc.trim().toUpperCase(),
      beneficiary_bank_name: form.beneficiary_bank_name.trim(),
    };
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payload.beneficiary_ifsc)) {
      setFormError("IFSC must be 11 characters, like HDFC0001234");
      return;
    }
    setSaving(true);
    try {
      if (editingId == null) await api.post(`${BASE_URL}/admin/admin/display-account`, payload);
      else await api.patch(`${BASE_URL}/admin/admin/display-account/${editingId}`, payload);
      toast({ title: editingId == null ? "Account created" : "Account updated", description: payload.account_holder_name });
      setForm(EMPTY_FORM);
      setEditingId(null);
      loadAccounts();
    } catch (err) {
      setFormError(errText(err));
    } finally {
      setSaving(false);
    }
  }

  function editAccount(a: DisplayAccount) {
    setEditingId(a.id);
    setForm({
      account_holder_name: a.account_holder_name ?? "",
      beneficiary_account_number: a.beneficiary_account_number ?? "",
      beneficiary_ifsc: a.beneficiary_ifsc ?? "",
      beneficiary_bank_name: a.beneficiary_bank_name ?? "",
      is_validate: !!a.is_validate,
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.delete(`${BASE_URL}/admin/admin/display-account/${deleting.id}`);
      toast({ title: "Account deleted", description: deleting.account_holder_name ?? "" });
      if (editingId === deleting.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      setDeleting(null);
      loadAccounts();
    } catch (err) {
      toast({ title: "Delete failed", description: errText(err), variant: "destructive" });
    }
  }

  // ---- top-up actions ----
  const approve = async (t: Topup, quiet = false) => {
    setBusy((b) => ({ ...b, [t.id]: true }));
    try {
      await api.post(`${BASE_URL}/admin/admin/topup/${t.id}/approve`);
      if (!quiet) toast({ title: "Top-up approved", description: `${money(t.amount)} credited to ${t.user_id}` });
      return true;
    } catch (err) {
      toast({ title: `Approve failed (#${t.id})`, description: errText(err), variant: "destructive" });
      return false;
    } finally {
      setBusy((b) => ({ ...b, [t.id]: false }));
    }
  };

  const approveAll = async () => {
    const list = topups?.items ?? [];
    setBulkRunning(true);
    let ok = 0;
    for (const t of list) {
      if (await approve(t, true)) ok += 1;
    }
    setBulkRunning(false);
    setConfirmAll(false);
    toast({ title: "Bulk approval finished", description: `${ok} of ${list.length} top-ups approved` });
    refreshTopups();
  };

  const reject = async () => {
    if (!rejecting || !rejectReason.trim()) return;
    setBusy((b) => ({ ...b, [rejecting.id]: true }));
    try {
      const fd = new FormData();
      fd.append("reason", rejectReason.trim());
      await api.post(`${BASE_URL}/admin/admin/topup/${rejecting.id}/reject`, fd);
      toast({ title: "Top-up rejected", description: `#${rejecting.id} · ${rejecting.user_id}` });
      setRejecting(null);
      setRejectReason("");
      refreshTopups();
    } catch (err) {
      toast({ title: "Reject failed", description: errText(err), variant: "destructive" });
    } finally {
      setBusy((b) => ({ ...b, [rejecting.id]: false }));
    }
  };

  const q = accountSearch.trim().toLowerCase();
  const visibleAccounts = useMemo(
    () =>
      (accounts ?? []).filter(
        (a) =>
          !q ||
          [a.account_holder_name, a.beneficiary_account_number, a.beneficiary_ifsc, a.beneficiary_bank_name].some((v) => (v ?? "").toLowerCase().includes(q))
      ),
    [accounts, q]
  );
  const activeAccounts = (accounts ?? []).filter((a) => a.is_validate).length;
  const payoutTotal = merchants.reduce((s, m) => s + Number(m.payout_wallet?.balance ?? 0), 0);
  const withBalance = merchants.filter((m) => Number(m.payout_wallet?.balance ?? 0) > 0).length;
  const pendingOnPage = tab === "pending" ? topups?.items.length ?? 0 : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Payout Management</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Manage display accounts and top-up approvals</p>
        </div>
        <Button variant="outline" onClick={() => { loadAccounts(); refreshTopups(); }} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
          <RefreshCw /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Display Accounts"
          value={accounts ? accounts.length : "…"}
          icon={Wallet}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint={accounts ? `${activeAccounts} shown to merchants` : undefined}
          hintTone={activeAccounts ? "up" : "muted"}
        />
        <TspStat
          label="Pending Top-ups"
          value={counts ? counts.pending.toLocaleString("en-IN") : "…"}
          icon={Hourglass}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          hint="Awaiting approval"
          hintTone={counts?.pending ? "warn" : "muted"}
        />
        <TspStat
          label="Approved Top-ups"
          value={counts ? counts.verified.toLocaleString("en-IN") : "…"}
          icon={CheckCircle2}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={counts ? `+${counts.verifiedMonth} this month` : undefined}
          hintTone={counts?.verifiedMonth ? "up" : "muted"}
        />
        <TspStat
          label="Total Payout Balance"
          value={merchants.length ? `₹${Math.round(payoutTotal).toLocaleString("en-IN")}` : "…"}
          icon={IndianRupee}
          tile="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          hint={merchants.length ? `Across ${withBalance} merchant${withBalance === 1 ? "" : "s"}` : undefined}
        />
      </div>

      {/* Add / edit display account */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
        <form onSubmit={submitAccount} className={`${card} p-5`}>
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              {editingId == null ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </span>
            <div className="flex-1">
              <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">{editingId == null ? "Add Display Account" : "Edit Display Account"}</h2>
              <p className="text-[13px] text-gray-500">Configure accounts for merchant display</p>
            </div>
            {editingId != null && (
              <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); }}>
                Cancel edit
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Account Holder Name <span className="text-red-500">*</span></span>
              <IconInput icon={User} required value={form.account_holder_name} onChange={(e) => setForm((f) => ({ ...f, account_holder_name: e.target.value }))} placeholder="Enter account holder name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Account Number <span className="text-red-500">*</span></span>
              <IconInput icon={CreditCard} required inputMode="numeric" pattern="[0-9]{6,20}" title="6–20 digits" value={form.beneficiary_account_number} onChange={(e) => setForm((f) => ({ ...f, beneficiary_account_number: e.target.value.replace(/\s/g, "") }))} placeholder="Enter account number" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">IFSC Code <span className="text-red-500">*</span></span>
              <IconInput icon={Landmark} required maxLength={11} value={form.beneficiary_ifsc} onChange={(e) => setForm((f) => ({ ...f, beneficiary_ifsc: e.target.value.toUpperCase() }))} placeholder="Enter IFSC code" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Bank Name <span className="text-red-500">*</span></span>
              <IconInput icon={Landmark} required value={form.beneficiary_bank_name} onChange={(e) => setForm((f) => ({ ...f, beneficiary_bank_name: e.target.value }))} placeholder="Enter bank name" />
            </label>
          </div>
          {formError && <p className="mt-3 text-[13px] text-red-600">{formError}</p>}
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-gray-100 bg-slate-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={form.is_validate} onChange={(e) => setForm((f) => ({ ...f, is_validate: e.target.checked }))} className="mt-0.5 h-5 w-5 rounded accent-indigo-600" />
              <span>
                <span className="block text-[14px] font-semibold text-gray-900 dark:text-gray-100">Validated Account</span>
                <span className="block text-[13px] text-gray-500">Show this account to merchants for top-ups</span>
              </span>
            </label>
            <Button type="submit" disabled={saving} className="h-11 rounded-xl px-5">
              {saving ? <Loader2 className="animate-spin" /> : editingId == null ? <Plus /> : <Check />}
              {editingId == null ? "Create Account" : "Save Changes"}
            </Button>
          </div>
        </form>

        <div className={`${card} relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60 p-5 dark:from-indigo-950/30 dark:via-gray-900 dark:to-violet-950/20`}>
          <div className="relative mx-auto my-4 flex h-28 w-40 items-center justify-center" aria-hidden="true">
            <span className="absolute left-0 top-6 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-violet-500 shadow-sm dark:bg-gray-800"><IndianRupee className="h-4 w-4" /></span>
            <span className="absolute bottom-2 left-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-500 shadow-sm dark:bg-gray-800"><Landmark className="h-4 w-4" /></span>
            <span className="absolute right-0 top-8 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-violet-500 shadow-sm dark:bg-gray-800"><IndianRupee className="h-4 w-4" /></span>
            <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/30">
              <Wallet className="h-10 w-10" />
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-green-500 dark:border-gray-900"><Check className="h-4 w-4" /></span>
            </span>
          </div>
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Merchant Display Accounts</h3>
          <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-400">These accounts are shown to merchants when they submit a top-up payment.</p>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-white/70 p-3 text-[13px] text-gray-700 dark:border-indigo-900/50 dark:bg-gray-900/60 dark:text-gray-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
            Only accounts marked “Validated” are displayed to merchants.
          </div>
        </div>
      </div>

      {/* Display accounts */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">Display Accounts</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Accounts available for merchant top-ups</p>
          </div>
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Search accounts..." className={`${filterInputCls} pl-10`} aria-label="Search accounts" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr>
                <th className={`${TH} pl-5`}>#</th>
                <th className={TH}>Account Holder</th>
                <th className={TH}>Account Number</th>
                <th className={TH}>IFSC Code</th>
                <th className={TH}>Bank Name</th>
                <th className={TH}>Status</th>
                <th className={`${TH} pr-5 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {accounts === null ? (
                <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : visibleAccounts.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Landmark} title={accounts.length ? "No matching accounts" : "No display accounts yet"} description={accounts.length ? undefined : "Add one above so merchants know where to send top-ups"} /></td></tr>
              ) : (
                visibleAccounts.map((a, i) => (
                  <tr key={a.id} className={editingId === a.id ? "bg-indigo-50/50 dark:bg-indigo-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}>
                    <td className={`${TD} pl-5 text-gray-500`}>{i + 1}</td>
                    <td className={`${TD} font-semibold text-gray-900 dark:text-gray-100`}>{a.account_holder_name || "—"}</td>
                    <td className={`${TD} font-mono text-[12.5px]`}>{a.beneficiary_account_number || "—"}</td>
                    <td className={`${TD} font-mono text-[12.5px]`}>{a.beneficiary_ifsc || "—"}</td>
                    <td className={TD}>{a.beneficiary_bank_name || "—"}</td>
                    <td className={TD}><AccountStatus active={!!a.is_validate} /></td>
                    <td className={`${TD} pr-5`}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => editAccount(a)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[12.5px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button onClick={() => setDeleting(a)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[12.5px] font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top-ups */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">{tab === "pending" ? "Pending Top-ups" : "Approved Top-ups"}</h2>
              <p className="mt-0.5 text-[13px] text-gray-500">{tab === "pending" ? "Awaiting approval from administrators" : "Top-ups already credited to payout wallets"}</p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800/60" role="tablist">
              {(["pending", "verified"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => { setTab(t); setPage(1); }}
                  className={`h-8 rounded-md px-3 text-[12.5px] font-semibold ${tab === t ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-900 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400"}`}
                >
                  {t === "pending" ? `Pending${counts ? ` (${counts.pending})` : ""}` : "Approved"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select value={merchantFilter} onChange={(e) => { setMerchantFilter(e.target.value); setPage(1); }} className={`${filterInputCls} sm:w-48`} aria-label="Merchant filter">
              <option value="">All Merchants</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>{m.username}</option>
              ))}
            </select>
            <div className="sm:w-[290px]">
              <DateRangeInput from={range.from} to={range.to} onChange={(from, to) => { setRange({ from, to }); setPage(1); }} ariaLabel="Submitted date range" />
            </div>
            {tab === "pending" && (
              <Button onClick={() => setConfirmAll(true)} disabled={!pendingOnPage || bulkRunning} className="h-11 rounded-xl px-4">
                <Check /> Approve All
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr>
                <th className={`${TH} pl-5`}>#</th>
                <th className={TH}>User ID</th>
                <th className={TH}>Payer Name</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Beneficiary</th>
                <th className={TH}>UTR / Txn ID</th>
                <th className={TH}>Instrument</th>
                <th className={TH}>{tab === "pending" ? "Submitted On" : "Approved On"}</th>
                <th className={TH}>Receipt</th>
                <th className={`${TH} sticky right-0 bg-slate-50 pr-5 text-right shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] dark:bg-gray-800`}>{tab === "pending" ? "Actions" : "Approved By"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {topups === null ? (
                <tr><td colSpan={10} className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : topups.items.length === 0 ? (
                <tr><td colSpan={10}><EmptyState icon={tab === "pending" ? ShieldCheck : Clock} title={tab === "pending" ? "No pending top-ups" : "No approved top-ups"} description={merchantFilter || range.from || range.to ? "Try changing the filters" : undefined} /></td></tr>
              ) : (
                topups.items.map((t, i) => {
                  const url = receiptUrl(t.receipt_url);
                  return (
                    <tr key={t.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className={`${TD} pl-5 text-gray-500`}>{(page - 1) * perPage + i + 1}</td>
                      <td className={TD}>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{t.user_id}</div>
                        {t.user?.username && <div className="text-[12px] text-gray-500">{t.user.username}</div>}
                      </td>
                      <td className={TD}>{t.payer_name || "—"}</td>
                      <td className={`${TD} text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100`}>{money(t.amount)}</td>
                      <td className={TD}>
                        <div>{t.beneficiary_bank_name || "—"}</div>
                        {t.beneficiary_account_number && <div className="font-mono text-[12px] text-gray-500">••{t.beneficiary_account_number.slice(-4)}</div>}
                      </td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{t.utr_or_txn_id || "—"}</td>
                      <td className={TD}>{INSTRUMENT[t.instrument ?? ""] ?? t.instrument ?? "—"}</td>
                      <td className={TD}>{fmtWhen(tab === "pending" ? t.created_at : t.verified_at ?? t.created_at)}</td>
                      <td className={TD}>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            <FileText className="h-3.5 w-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-[12px] text-gray-400">None</span>
                        )}
                      </td>
                      <td className={`${TD} sticky right-0 bg-white pr-5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)] group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-gray-800`}>
                        {tab === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setApproving(t)}
                              disabled={busy[t.id] || bulkRunning}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 text-[12.5px] font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
                            >
                              {busy[t.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                            </button>
                            <button
                              onClick={() => { setRejecting(t); setRejectReason(""); }}
                              disabled={busy[t.id] || bulkRunning}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[12.5px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-[12.5px] text-gray-500">{t.verified_by_user?.username || "—"}</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {topups && topups.total > 0 && <Pager page={page} perPage={perPage} total={topups.total} noun="top-ups" onPage={setPage} />}
      </div>

      {/* Approve one */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve top-up?</DialogTitle>
            <DialogDescription>
              {money(approving?.amount)} will be credited to {approving?.user_id}'s payout wallet. Check the UTR ({approving?.utr_or_txn_id || "none"}) against your bank statement first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button
              variant="success"
              onClick={async () => {
                const t = approving!;
                setApproving(null);
                if (await approve(t)) refreshTopups();
              }}
            >
              <Check /> Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve all on page */}
      <Dialog open={confirmAll} onOpenChange={(o) => !o && !bulkRunning && setConfirmAll(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve all {pendingOnPage} top-ups on this page?</DialogTitle>
            <DialogDescription>
              Each one credits the merchant's payout wallet ({money((topups?.items ?? []).reduce((s, t) => s + Number(t.amount || 0), 0))} in total). Only the rows currently listed are approved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmAll(false)} disabled={bulkRunning}>Cancel</Button>
            <Button variant="success" onClick={approveAll} disabled={bulkRunning}>
              {bulkRunning ? <Loader2 className="animate-spin" /> : <Check />} Approve All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject with reason */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject top-up</DialogTitle>
            <DialogDescription>
              #{rejecting?.id} · {rejecting?.user_id} · {money(rejecting?.amount)}
            </DialogDescription>
          </DialogHeader>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Reason <span className="text-red-500">*</span></span>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. UTR not found in bank statement"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim() || (rejecting ? busy[rejecting.id] : false)}>
              <X /> Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete account */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete display account?</DialogTitle>
            <DialogDescription>
              {deleting?.account_holder_name} · {deleting?.beneficiary_bank_name} {deleting?.beneficiary_account_number}. Merchants will no longer see it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
