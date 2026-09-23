import React, { useEffect, useMemo, useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { AxiosResponse } from "axios";
import { Plus, RefreshCw, Search, Banknote, Shield, CheckCircle, XCircle, Edit, Trash2, User, Hash, Building, MapPin, CreditCard } from "lucide-react";

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
  const [accountType, setAccountType] = useState("");
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
        setAccountType("");
        setBankAddress("");
        setFormErrors({});
        setError(null);
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

  // pagination helpers
  function nextPage() {
    if (offset + limit < total) setOffset(offset + limit);
  }
  function prevPage() {
    if (offset - limit >= 0) setOffset(Math.max(0, offset - limit));
  }

  // filtered items (client-side search)
  const filtered = useMemo(() => {
    const ql = (q || "").trim().toLowerCase();
    if (!ql) return items;
    return items.filter((it) =>
      `${it.account_holder_name} ${it.account_number} ${it.ifsc_code} ${it.bank_name ?? ""}`
        .toLowerCase()
        .includes(ql),
    );
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Bank Accounts
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Manage your payout bank accounts for withdrawals</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => fetchList()} 
                className="px-4 h-9 border border-gray-200 dark:border-gray-600 rounded-lg font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#3871C2]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Accounts</div>
                  <div className="text-2xl font-bold text-[#3871C2]">{total}</div>
                </div>
                <Banknote className="w-6 h-6 text-[#3871C2]" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#41B93D]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Validated Accounts</div>
                  <div className="text-2xl font-bold text-[#41B93D]">{items.filter(it => it.is_validate).length}</div>
                </div>
                <Shield className="w-6 h-6 text-[#41B93D]" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 border-l-4 border-l-[#00ADEF]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Accounts per Page</div>
                  <div className="text-2xl font-bold text-[#00ADEF]">{limit}</div>
                </div>
                <CreditCard className="w-6 h-6 text-[#00ADEF]" />
              </div>
            </div>
          </div>
        </div>

        {/* Add Account Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#3871C2] flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add New Bank Account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the details to add a new payout account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Holder Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Account Holder Name
                </label>
                <input
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Full name as per bank records"
                  className={`w-full border ${formErrors.account_holder_name ? 'border-red-300' : 'border-gray-200 dark:border-gray-600'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]`}
                  aria-invalid={!!formErrors.account_holder_name}
                />
                {formErrors.account_holder_name && (
                  <div className="mt-2 text-sm text-red-600 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {formErrors.account_holder_name}
                  </div>
                )}
              </div>

              {/* Account Number */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Account Number
                </label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="1234567890"
                  className={`w-full border ${formErrors.account_number ? 'border-red-300' : 'border-gray-200 dark:border-gray-600'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]`}
                  inputMode="numeric"
                  aria-invalid={!!formErrors.account_number}
                />
                {formErrors.account_number && (
                  <div className="mt-2 text-sm text-red-600 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {formErrors.account_number}
                  </div>
                )}
              </div>

              {/* IFSC Code */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  IFSC Code
                </label>
                <input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="SBIN0000001"
                  className={`w-full border ${formErrors.ifsc_code ? 'border-red-300' : 'border-gray-200 dark:border-gray-600'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2] uppercase`}
                  aria-invalid={!!formErrors.ifsc_code}
                />
                {formErrors.ifsc_code && (
                  <div className="mt-2 text-sm text-red-600 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {formErrors.ifsc_code}
                  </div>
                )}
              </div>

              {/* Bank Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Bank Name
                </label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="State Bank of India"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                />
              </div>

              {/* Bank Branch */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Bank Branch
                </label>
                <input
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="Main Branch"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Account Type
                </label>
                <input
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  placeholder="SAVINGS / CURRENT"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                />
              </div>

              {/* Bank Address */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Bank Address
                </label>
                <textarea
                  value={bankAddress}
                  onChange={(e) => setBankAddress(e.target.value)}
                  placeholder="Complete bank address (optional)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2] resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
              <button
                type="submit"
                disabled={creating}
                className="px-6 h-9 bg-[#41B93D] text-white rounded-lg font-medium hover:bg-[#379e34] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Account
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountHolderName("");
                  setAccountNumber("");
                  setIfscCode("");
                  setBankName("");
                  setBankBranch("");
                  setAccountType("");
                  setBankAddress("");
                  setFormErrors({});
                  setError(null);
                }}
                className="px-6 h-9 border border-gray-200 dark:border-gray-600 rounded-lg font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Reset Form
              </button>

              {/* Search and Controls */}
              <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search accounts..."
                    className="pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                  />
                </div>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3871C2]/20 focus:border-[#3871C2]"
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-gradient-to-r from-[#F68713]/10 to-orange-50 border border-[#F68713]/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-[#F68713]" />
                  <p className="text-[#F68713] font-medium">{error}</p>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Accounts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Bank Accounts</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total: {total} accounts</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {Math.min(total, offset + 1)} - {Math.min(total, offset + (items.length || 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {loadingList ? (
              <div className="p-12 text-center">
                <div className="inline-flex flex-col items-center justify-center">
                  <div className="w-12 h-9 border-4 border-[#3871C2]/20 border-t-[#3871C2] rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Loading accounts...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Banknote className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No accounts found</p>
                  <p className="text-gray-500">Add your first bank account to get started</p>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b">
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">#</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Account Holder</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Account Number</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">IFSC</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Bank</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Branch</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it, idx) => (
                    <tr key={it.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{offset + idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#3871C2]/10 to-[#00ADEF]/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#3871C2]" />
                          </div>
                          <span className="font-medium">{it.account_holder_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                          ••••{it.account_number.slice(-4)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-100">
                          {it.ifsc_code}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{it.bank_name || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{it.bank_branch || "-"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {it.account_type || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          it.is_validate
                            ? 'bg-gradient-to-r from-[#41B93D]/10 to-emerald-100 text-[#41B93D] border border-[#41B93D]/20'
                            : 'bg-gradient-to-r from-[#F68713]/10 to-orange-100 text-[#F68713] border border-[#F68713]/20'
                        }`}>
                          {it.is_validate ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Validated
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Pending
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)} • {total} total accounts
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={offset === 0}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                ← Previous
              </button>
              <button
                onClick={nextPage}
                disabled={offset + limit >= total}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl border-l-4 border-l-[#41B93D]">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#41B93D] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#41B93D] mb-1">Your data is secure</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                All bank account information is encrypted with 256-bit SSL encryption and stored securely.
                We never share your financial details with third parties.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}