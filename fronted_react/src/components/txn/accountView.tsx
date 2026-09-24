import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { AxiosResponse } from "axios";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  Landmark,
  Loader2,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSelfProfile } from "@/api/apiHelper";
import { ActionMenu, EmptyState } from "@/components/admin-part/ui";
import { TspStat } from "@/components/admin-part/tspShared";
import Pager from "@/components/admin-part/Pager";
import { filterInputCls } from "@/components/admin-part/listUtils";
import { TypeBadge } from "@/components/txn/bankBits";
import { bankInitials, bankTone } from "@/components/txn/bankUtils";

/** Common banks for the Bank Name picker; anything else goes through "Other bank…". */
const BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank",
  "IDFC FIRST Bank",
  "Yes Bank",
  "Bank of India",
  "Indian Bank",
  "Central Bank of India",
  "Federal Bank",
  "AU Small Finance Bank",
];

type PayoutBankAccount = {
  id: number;
  user_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string | null;
  bank_branch?: string | null;
  account_type?: string | null;
  bank_address?: string | null;
  is_validate: boolean;
};

type PayoutBankAccountListResponse = {
  total: number;
  items: PayoutBankAccount[];
};

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

function normalizeAccountNumber(v: string) {
  return v.replace(/[\s-]/g, "");
}
function safeToString(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Error && typeof v.message === "string") return v.message;
  try {
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  } catch {
    return String(v);
  }
}
function extractErrorMessage(err: any) {
  try {
    if (!err) return { message: "Unknown error" };
    const payload = err?.payload ?? err?.response?.data ?? err?.data ?? null;
    if (typeof err === "string") return { message: err };
    if (err instanceof Error && typeof err.message === "string") return { message: err.message };
    if (payload) {
      if (Array.isArray(payload.detail)) {
        const msgs: string[] = [];
        for (const it of payload.detail) msgs.push(typeof it?.msg === "string" ? it.msg : safeToString(it));
        return { message: msgs.join("; ") || safeToString(payload) };
      }
      if (typeof payload.detail === "string") return { message: payload.detail };
      if (typeof payload.message === "string") return { message: payload.message };
      if (typeof payload.msg === "string") return { message: payload.msg };
      return { message: safeToString(payload) };
    }
    if (err.fieldErrors) return { message: safeToString(err.fieldErrors) };
    return { message: safeToString(err) };
  } catch {
    return { message: "Failed to parse error" };
  }
}

export default function PayoutAccountsPage(): JSX.Element {
  // form state
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountType, setAccountType] = useState("Savings");
  const [bankAddress, setBankAddress] = useState("");

  // list state
  const [items, setItems] = useState<PayoutBankAccount[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);

  // UI state
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // client-side search
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<PayoutBankAccount | null>(null);
  const [payoutBalance, setPayoutBalance] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadBalance = () =>
    getSelfProfile()
      .then((m) => setPayoutBalance(Number(m?.payout_wallet?.balance ?? 0)))
      .catch(() => setPayoutBalance(null));

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset]);

  async function fetchList() {
    setLoadingList(true);
    setError(null);

    try {
      const params = { limit, offset };
      const url = `${BASE_URL}/merchant/payout-bank-accounts`;
      const resp: AxiosResponse<PayoutBankAccountListResponse> = await api.get(url, { params });
      const data = resp.data;
      setItems(data?.items ?? []);
      setTotal(typeof data?.total === "number" ? data.total : data?.items?.length ?? 0);
    } catch (err: any) {
      console.error("fetchList error:", err);
      const extracted = extractErrorMessage(err);
      setError(extracted.message || "Failed to fetch accounts");
    } finally {
      setLoadingList(false);
    }
  }

  function validateForm() {
    const errs: Record<string, string> = {};
    if (!accountHolderName || accountHolderName.trim().length < 2) {
      errs.account_holder_name = "Account holder name is required (min 2 chars)";
    }
    const accClean = normalizeAccountNumber(accountNumber || "");
    if (!accClean || accClean.length < 6 || accClean.length > 30) {
      errs.account_number = "Account number must be 6-30 characters (no spaces/dashes)";
    }
    if (!bankName.trim()) errs.bank_name = "Select or enter your bank";
    const ifscClean = (ifscCode || "").trim().toUpperCase();
    if (!IFSC_REGEX.test(ifscClean)) {
      errs.ifsc_code = "IFSC format invalid (example: SBIN0000001)";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    const payload = {
      account_holder_name: accountHolderName.trim(),
      account_number: normalizeAccountNumber(accountNumber),
      ifsc_code: ifscCode.trim().toUpperCase(),
      bank_name: bankName?.trim() || null,
      bank_branch: bankBranch?.trim() || null,
      account_type: accountType?.trim() || null,
      bank_address: bankAddress?.trim() || null,
    };

    setCreating(true);
    try {
      const url = `${BASE_URL}/merchant/payout-bank-accounts`;
      const resp: AxiosResponse<any> = await api.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        validateStatus: (s) => s >= 200 && s < 500,
      });

      if (resp.status === 201) {
        const created: PayoutBankAccount = resp.data;
        setItems((prev) => [created, ...prev].slice(0, limit));
        setTotal((t) => t + 1);
        // reset form
        setAccountHolderName("");
        setAccountNumber("");
        setIfscCode("");
        setBankName("");
        setBankBranch("");
        setAccountType("Savings");
        setBankAddress("");
        setFormErrors({});
        setError(null);
        setShowForm(false);
        toast({ title: "Account added", description: "It will be usable once the admin team verifies it." });
      } else if (resp.status === 409) {
        const body = resp.data;
        const msg = body?.detail || body?.message || "Duplicate account exists";
        setError(safeToString(msg));
      } else if (resp.status === 422 || resp.status === 400) {
        const body = resp.data;
        if (body && typeof body === "object") {
          if (Array.isArray(body.detail)) {
            const mapped: Record<string, string> = {};
            for (const it of body.detail) {
              const key = Array.isArray(it.loc) && it.loc.length > 1 ? it.loc.slice(1).join(".") : String(it.loc ?? "");
              const m = typeof it.msg === "string" ? it.msg : safeToString(it);
              if (key) mapped[key] = (mapped[key] ? mapped[key] + "; " : "") + m;
            }
            if (Object.keys(mapped).length) {
              setFormErrors((prev) => ({ ...prev, ...mapped }));
              setError("Validation error");
            } else {
              setError(JSON.stringify(body));
            }
          } else if (typeof body.detail === "string") {
            setError(body.detail);
          } else {
            setError(JSON.stringify(body));
          }
        } else {
          setError(`Failed to create account: ${resp.status}`);
        }
      } else {
        setError(`Failed to create account: ${resp.status} ${safeToString(resp.data ?? resp.statusText)}`);
      }
    } catch (err: any) {
      console.error("create account error:", err);
      const extracted = extractErrorMessage(err);
      setError(extracted.message || "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  // filtered items (client-side search over the current page)
  const filtered = useMemo(() => {
    const ql = (q || "").trim().toLowerCase();
    if (!ql) return items;
    return items.filter((it) =>
      `${it.account_holder_name} ${it.account_number} ${it.ifsc_code} ${it.bank_name ?? ""} ${it.bank_branch ?? ""}`.toLowerCase().includes(ql)
    );
  }, [items, q]);

  const verified = items.filter((it) => it.is_validate).length;
  const fieldErr = (k: string) => (formErrors[k] ? <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{formErrors[k]}</p> : null);
  const label = "mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300";
  const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
  const formOpen = showForm || (!loadingList && total === 0);
  const bankChoice = BANKS.includes(bankName) ? bankName : bankName ? "__other" : "";

  const resetForm = () => {
    setAccountHolderName("");
    setAccountNumber("");
    setIfscCode("");
    setBankName("");
    setBankBranch("");
    setAccountType("Savings");
    setBankAddress("");
    setFormErrors({});
    setError(null);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: text });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const openForm = () => {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Payout Accounts</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Bank accounts you can withdraw your payout balance to</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => { fetchList(); loadBalance(); }} className="h-11 rounded-xl px-4">
            <RefreshCw className={loadingList ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button onClick={openForm} className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25">
            <Plus /> Add Account
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat label="Total Accounts" value={loadingList && !items.length ? "…" : total} icon={Landmark} tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" hint="Added to your profile" />
        <TspStat label="Verified Accounts" value={verified} icon={ShieldCheck} tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" hint="Ready for withdrawals" hintTone={verified ? "up" : "muted"} />
        <TspStat
          label="Pending Accounts"
          value={Math.max(0, items.length - verified)}
          icon={Clock}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          hint="Waiting for admin verification"
          hintTone={items.length - verified > 0 ? "warn" : "muted"}
        />
        <TspStat
          label="Payout Balance"
          value={payoutBalance == null ? "…" : `₹${Math.round(payoutBalance).toLocaleString("en-IN")}`}
          icon={Wallet}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          hint="Available to withdraw"
        />
      </div>

      {/* Accounts */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Your Accounts</h2>
              <p className="text-[13px] text-gray-500">Manage your bank accounts for payouts</p>
            </div>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts..." className={`${filterInputCls} pl-10`} aria-label="Search accounts" />
          </div>
        </div>

        {error && !formOpen && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-3 pl-5 pr-3">#</th>
                <th className="px-3 py-3">Bank Details</th>
                <th className="px-3 py-3">Account Number</th>
                <th className="px-3 py-3">IFSC Code</th>
                <th className="px-3 py-3">Account Holder</th>
                <th className="px-3 py-3">Account Type</th>
                <th className="px-3 py-3">Status</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loadingList ? (
                <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon={Landmark} title={q ? "No accounts match your search" : "No payout accounts yet"} description={q ? undefined : "Add a bank account below to start withdrawing"} />
                  </td>
                </tr>
              ) : (
                filtered.map((it, i) => (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 pl-5 pr-3 text-gray-500">{offset + i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${bankTone(it.bank_name)}`}>{bankInitials(it.bank_name)}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{it.bank_name || "Bank"}</div>
                          <div className="truncate text-[12px] text-gray-500">{it.bank_branch || it.account_holder_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12.5px] text-gray-800 dark:text-gray-200">•••• {String(it.account_number || "").slice(-4)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12.5px] text-gray-700 dark:text-gray-300">{it.ifsc_code}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-800 dark:text-gray-200">{it.account_holder_name}</td>
                    <td className="px-3 py-3"><TypeBadge type={it.account_type} /></td>
                    <td className="px-3 py-3">
                      {it.is_validate ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-3 pr-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setView(it)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12.5px] font-medium text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-400"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <ActionMenu
                          label={`More for account ${it.id}`}
                          items={[
                            { label: "Copy account number", icon: Copy, onClick: () => copy(it.account_number) },
                            { label: "Copy IFSC", icon: Copy, onClick: () => copy(it.ifsc_code) },
                            ...(it.is_validate ? [{ label: "Withdraw to this account", icon: ArrowRight, onClick: () => navigate("/merchant/settlements") }] : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && <Pager page={Math.floor(offset / limit) + 1} perPage={limit} total={total} noun="accounts" onPage={(pg) => setOffset((pg - 1) * limit)} />}
      </div>

      {/* Add account */}
      <div ref={formRef} className={card}>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left"
          aria-expanded={formOpen}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <PlusCircle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Add New Payout Account</h2>
            <p className="text-[13px] text-gray-500">Add a new bank account to receive payouts. New accounts need admin verification before use.</p>
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition ${formOpen ? "rotate-180" : ""}`} />
        </button>
        {formOpen && (
          <form onSubmit={handleSubmit} className="border-t border-gray-100 p-5 dark:border-gray-800" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className={label} htmlFor="pa-bank">Bank Name *</label>
                <select
                  id="pa-bank"
                  value={bankChoice}
                  onChange={(e) => setBankName(e.target.value === "__other" ? " " : e.target.value)}
                  className={filterInputCls}
                >
                  <option value="">Select bank</option>
                  {BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="__other">Other bank…</option>
                </select>
                {bankChoice === "__other" && (
                  <input value={bankName.trimStart()} onChange={(e) => setBankName(e.target.value || " ")} placeholder="Enter bank name" className={`${filterInputCls} mt-2`} autoFocus />
                )}
                {fieldErr("bank_name")}
              </div>
              <div>
                <label className={label} htmlFor="pa-acc">Account Number *</label>
                <input id="pa-acc" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter account number" autoComplete="off" className={filterInputCls} />
                {fieldErr("account_number")}
              </div>
              <div>
                <label className={`${label} flex items-center justify-between`} htmlFor="pa-ifsc">
                  <span>IFSC Code *</span>
                  <a href="https://www.rbi.org.in/Scripts/IFSCMICRDetails.aspx" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    Find IFSC Code <ExternalLink className="h-3 w-3" />
                  </a>
                </label>
                <input id="pa-ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} maxLength={11} placeholder="Enter IFSC code" autoComplete="off" className={filterInputCls} />
                {fieldErr("ifsc_code")}
              </div>
              <div>
                <label className={label} htmlFor="pa-holder">Account Holder Name *</label>
                <input id="pa-holder" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Enter account holder name" autoComplete="off" className={filterInputCls} />
                {fieldErr("account_holder_name")}
              </div>
              <div>
                <label className={label} htmlFor="pa-type">Account Type *</label>
                <select id="pa-type" value={accountType || "Savings"} onChange={(e) => setAccountType(e.target.value)} className={filterInputCls}>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="pa-branch">Branch (Optional)</label>
                <input id="pa-branch" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="e.g. Andheri West" className={filterInputCls} />
              </div>
            </div>
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }} className="h-11 rounded-xl px-5">Cancel</Button>
              <Button type="submit" disabled={creating} className="h-11 rounded-xl px-5">
                {creating ? <Loader2 className="animate-spin" /> : <Plus />} Add Account
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Details */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{view?.bank_name || "Bank account"}</DialogTitle>
            <DialogDescription>{view?.is_validate ? "Verified — you can withdraw to this account" : "Pending verification by the admin team"}</DialogDescription>
          </DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {([
                ["Account Holder", view.account_holder_name],
                ["Account Number", view.account_number],
                ["IFSC Code", view.ifsc_code],
                ["Account Type", view.account_type || "—"],
                ["Branch", view.bank_branch || "—"],
                ["Address", view.bank_address || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="min-w-0">
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
}
