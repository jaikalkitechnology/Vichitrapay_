import React, { useEffect, useMemo, useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { AxiosResponse } from "axios";
import { Plus, RefreshCw, Search, Banknote, Shield, CheckCircle, XCircle, Building, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, inputCls } from "@/components/admin-part/ui";

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
  const [showForm, setShowForm] = useState(false);

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

  const verified = items.filter((it) => it.is_validate).length;
  const mask = (n: string) => `•••• ${String(n || "").slice(-4)}`;
  const fieldErr = (k: string) =>
    formErrors[k] ? <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{formErrors[k]}</p> : null;
  const label = "mb-1.5 block text-[12px] text-gray-600 dark:text-gray-400";
  const formOpen = showForm || (!loadingList && total === 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payout Accounts"
        description="Bank accounts you can withdraw your payout balance to"
        actions={
          <>
            <Button variant="outline" onClick={() => fetchList()}>
              <RefreshCw className={loadingList ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus /> Add Account
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total" value={total} icon={Banknote} />
        <StatCard label="Verified" value={verified} icon={Shield} />
        <StatCard label="Pending" value={Math.max(0, items.length - verified)} icon={Clock} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <Panel
        title="Your Accounts"
        meta={`${total} total`}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts..." className={`${inputCls} w-56 pl-8`} />
          </div>
        }
      >
        <div className="flex flex-col gap-2 p-4">
          {loadingList ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Banknote} title={q ? "No matching accounts" : "No payout accounts yet"} description={q ? "Try a different search" : "Add a bank account to start withdrawing"} />
          ) : (
            filtered.map((it) => (
              <div
                key={it.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <Building className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{it.bank_name || "Bank"}</span>
                      <span className="font-mono text-gray-600 dark:text-gray-400">{mask(it.account_number)}</span>
                    </div>
                    <div className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                      {it.account_holder_name} · <span className="font-mono">{it.ifsc_code}</span>
                      {it.bank_branch ? ` · ${it.bank_branch}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  {it.account_type && <span className="text-[12px] capitalize text-gray-500">{it.account_type.toLowerCase()}</span>}
                  <StatusBadge status={it.is_validate ? "verified" : "pending"}>
                    {it.is_validate ? <><CheckCircle className="mr-1 h-3 w-3" />Verified</> : "Pending"}
                  </StatusBadge>
                </div>
              </div>
            ))
          )}
        </div>
        {total > limit && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-[13px] text-gray-500 dark:border-gray-800">
            <span>
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={prevPage} disabled={offset === 0}>Previous</Button>
              <Button variant="outline" onClick={nextPage} disabled={offset + limit >= total}>Next</Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Add Account — collapsible inline form */}
      <Panel
        title="Add Account"
        actions={
          <Button variant="ghost" size="icon" onClick={() => setShowForm((v) => !v)} aria-label={formOpen ? "Collapse" : "Expand"}>
            {formOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
        }
      >
        {formOpen && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <label className="block">
              <span className={label}>Account Holder Name *</span>
              <input value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Full name as per bank records" className={`${inputCls} w-full`} />
              {fieldErr("account_holder_name")}
            </label>
            <label className="block">
              <span className={label}>IFSC Code *</span>
              <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="SBIN0000001" className={`${inputCls} w-full font-mono`} />
              {fieldErr("ifsc_code")}
            </label>
            <label className="block">
              <span className={label}>Account Number *</span>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567890" className={`${inputCls} w-full font-mono`} />
              {fieldErr("account_number")}
            </label>
            <label className="block">
              <span className={label}>Bank Name</span>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="State Bank of India" className={`${inputCls} w-full`} />
            </label>
            <label className="block">
              <span className={label}>Bank Branch</span>
              <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="Main Branch" className={`${inputCls} w-full`} />
            </label>
            <label className="block">
              <span className={label}>Account Type</span>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">Select type</option>
                <option value="SAVINGS">Savings</option>
                <option value="CURRENT">Current</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className={label}>Bank Address</span>
              <textarea
                value={bankAddress}
                onChange={(e) => setBankAddress(e.target.value)}
                placeholder="Complete bank address (optional)"
                rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAccountHolderName(""); setAccountNumber(""); setIfscCode(""); setBankName("");
                  setBankBranch(""); setAccountType(""); setBankAddress(""); setFormErrors({});
                }}
              >
                Clear
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <RefreshCw className="animate-spin" /> : <Plus />} Add Account
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
