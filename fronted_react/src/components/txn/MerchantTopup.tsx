// Merchant Top Up — add funds to the payout wallet by bank transfer to a Vichitrapay display account
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import { API_ORIGIN, BASE_URL } from "@/config";
import api from "@/api/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Clock, CloudUpload, Copy, Eye, FileText, List, Loader2, PlusCircle, RefreshCw, Send, UserRound, X, XCircle } from "lucide-react";
import { ActionMenu, EmptyState } from "@/components/admin-part/ui";
import Pager from "@/components/admin-part/Pager";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";

type DisplayAccount = {
  id: number;
  account_holder_name?: string | null;
  beneficiary_account_number?: string | null;
  beneficiary_ifsc?: string | null;
  beneficiary_bank_name?: string | null;
  is_validate?: boolean;
};

type Topup = {
  id: number;
  amount: number;
  payer_name?: string | null;
  payer_account_number?: string | null;
  beneficiary_account_number?: string | null;
  beneficiary_ifsc?: string | null;
  beneficiary_bank_name?: string | null;
  instrument?: string | null;
  utr_or_txn_id?: string | null;
  reference_note?: string | null;
  receipt_url?: string | null;
  status: string;
  admin_notes?: string | null;
  verified_at?: string | null;
  created_at?: string | null;
};

const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

const STATUS: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  pending: { label: "Pending", icon: Clock, cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400" },
  verified: { label: "Approved", icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400" },
  failed: { label: "Rejected", icon: XCircle, cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400" },
  cancelled: { label: "Cancelled", icon: X, cls: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

function StatusPill({ status: raw }: { status: string }) {
  const status = raw === "approved" ? "verified" : raw === "rejected" ? "failed" : raw;
  const s = STATUS[status] ?? STATUS.cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${s.cls}`}>
      <s.icon className="h-3.5 w-3.5" /> {STATUS[status]?.label ?? status}
    </span>
  );
}

const inr = (v: number) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).replace("Sept", "Sep") : "—";
const receiptUrl = (raw?: string | null) => {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const base = API_ORIGIN.replace(/\/$/, "");
  return raw.startsWith("/") ? base + raw : `${base}/${raw}`;
};
const last4 = (n?: string | null) => (n ? `•••• ${n.slice(-4)}` : "");

/** Validates a receipt file; returns an error message or null. */
const checkReceipt = (f: File) => (!ALLOWED.includes(f.type) ? "Receipt must be a JPG, PNG or PDF" : f.size > MAX_BYTES ? "Receipt must be 10 MB or smaller" : null);

function ReceiptDrop({ file, onFile, error }: { file: File | null; onFile: (f: File | null) => void; error?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (f?: File | null) => onFile(f ?? null);
  return (
    <div>
      <div
        onDragOver={(e: DragEvent) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          over ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30" : "border-gray-200 bg-slate-50/50 dark:border-gray-700 dark:bg-gray-800/30"
        }`}
      >
        <CloudUpload className="h-7 w-7 text-indigo-500" />
        <p className="text-[13px] text-gray-600 dark:text-gray-400">Drop a receipt here or choose a file (JPG, PNG, PDF, max 10MB)</p>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>Choose File</Button>
          <span className="max-w-[220px] truncate text-[13px] text-gray-500">{file ? file.name : "No file chosen"}</span>
          {file && (
            <button type="button" onClick={() => { onFile(null); if (input.current) input.current.value = ""; }} className="text-gray-400 hover:text-red-600" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <input ref={input} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0])} />
      </div>
      {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

export default function MerchantTopup() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<DisplayAccount[] | null>(null);
  const [activeAcc, setActiveAcc] = useState<number | null>(null);

  // manual form
  const [amount, setAmount] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptErr, setReceiptErr] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // quick transfer
  const [quickOpen, setQuickOpen] = useState(false);
  const [qAmount, setQAmount] = useState("");
  const [qUtr, setQUtr] = useState("");
  const [qReceipt, setQReceipt] = useState<File | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [qBusy, setQBusy] = useState(false);

  // history
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [history, setHistory] = useState<Topup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<Topup | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get(`${BASE_URL}/merchant/display-accounts`);
      const list: DisplayAccount[] = Array.isArray(res.data) ? res.data : [];
      setAccounts(list);
      setActiveAcc((cur) => (cur && list.some((a) => a.id === cur) ? cur : list[0]?.id ?? null));
    } catch {
      setAccounts([]);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistory(null);
    try {
      const res = await api.get(`${BASE_URL}/merchant/topups-list`, { params: { page, per_page: perPage, ...(status ? { status } : {}) } });
      setHistory(Array.isArray(res.data?.items) ? res.data.items : []);
      setTotal(Number(res.data?.total) || 0);
    } catch (e) {
      toast({ title: "Could not load top-ups", description: errorText(e), variant: "destructive" });
      setHistory([]);
      setTotal(0);
    }
  }, [page, perPage, status, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const copy = async (text: string | null | undefined, what: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${what} copied` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available", variant: "destructive" });
    }
  };

  const submitTopup = async (fields: { amount: string; beneficiary: string | number; utr?: string; payerName?: string; payerAccount?: string; note?: string; receipt?: File | null }) => {
    const form = new FormData();
    form.append("amount", fields.amount);
    form.append("beneficiary_account_id", String(fields.beneficiary));
    if (fields.payerAccount) form.append("payer_account_number", fields.payerAccount);
    if (fields.payerName) form.append("payer_name", fields.payerName);
    if (fields.utr) form.append("utr_or_txn_id", fields.utr);
    if (fields.note) form.append("reference_note", fields.note);
    if (fields.receipt) form.append("receipt", fields.receipt);
    const res = await api.post(`${BASE_URL}/merchant/topup_submit`, form);
    return res.data?.data ?? res.data;
  };

  const onManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!amount || Number(amount) <= 0) return setFormError("Enter a valid amount");
    if (!beneficiaryId) return setFormError("Select the beneficiary account you paid into");
    setSubmitting(true);
    try {
      const r = await submitTopup({ amount, beneficiary: beneficiaryId, utr: utr.trim(), payerName: payerName.trim(), payerAccount: payerAccount.trim(), note: note.trim(), receipt });
      toast({ title: "Top-up submitted", description: `Request #${r?.id ?? ""} is pending admin approval` });
      setAmount("");
      setBeneficiaryId("");
      setPayerName("");
      setPayerAccount("");
      setUtr("");
      setNote("");
      setReceipt(null);
      setPage(1);
      fetchHistory();
    } catch (err) {
      setFormError(errorText(err, "Submit failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const onQuickSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setQErr(null);
    if (!activeAcc) return;
    if (!qAmount || Number(qAmount) <= 0) return setQErr("Enter a valid amount");
    setQBusy(true);
    try {
      const r = await submitTopup({ amount: qAmount, beneficiary: activeAcc, utr: qUtr.trim(), receipt: qReceipt });
      toast({ title: "Top-up submitted", description: `Request #${r?.id ?? ""} is pending admin approval` });
      setQuickOpen(false);
      setQAmount("");
      setQUtr("");
      setQReceipt(null);
      setPage(1);
      fetchHistory();
    } catch (err) {
      setQErr(errorText(err, "Submit failed"));
    } finally {
      setQBusy(false);
    }
  };

  const acc = (accounts ?? []).find((a) => a.id === activeAcc) ?? null;
  const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
  const label = "mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300";
  const copyBtn =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white px-3 text-[12.5px] font-medium text-gray-700 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Add Funds to Payout Wallet</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Transfer money to the account below, then submit the payment details for approval</p>
        </div>
        <Button variant="outline" onClick={() => { fetchAccounts(); fetchHistory(); }} className="h-11 rounded-xl px-4">
          <RefreshCw /> Refresh
        </Button>
      </div>

      {/* Beneficiary account */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/10">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Beneficiary Account</h2>
              <p className="text-[13px] text-gray-600 dark:text-gray-400">Pay into this account, then submit the transfer details</p>
            </div>
          </div>
          {accounts && accounts.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Beneficiary accounts">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  role="tab"
                  aria-selected={a.id === activeAcc}
                  onClick={() => setActiveAcc(a.id)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${
                    a.id === activeAcc ? "bg-white text-amber-800 shadow-sm dark:bg-gray-900 dark:text-amber-300" : "text-gray-600 hover:bg-white/60 dark:text-gray-400"
                  }`}
                >
                  {a.beneficiary_bank_name || "Account"} {last4(a.beneficiary_account_number)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          {accounts === null ? (
            <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600" /></div>
          ) : !acc ? (
            <p className="rounded-xl border border-amber-200 bg-white px-4 py-4 text-[13px] text-gray-600 dark:border-amber-900/50 dark:bg-gray-900 dark:text-gray-400">
              No beneficiary account is available right now. Please contact support before sending money.
            </p>
          ) : (
            <div className="rounded-xl border border-amber-200/80 bg-white/80 p-4 dark:border-amber-900/50 dark:bg-gray-900/70">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                {[
                  ["Account Holder", acc.account_holder_name],
                  ["Bank Name", acc.beneficiary_bank_name],
                  ["Account Number", acc.beneficiary_account_number],
                  ["IFSC Code", acc.beneficiary_ifsc],
                ].map(([k, v]) => (
                  <div key={k as string} className="min-w-0">
                    <div className="text-[12px] text-gray-500">{k}</div>
                    <div className="mt-0.5 break-all text-[15px] font-bold text-gray-900 dark:text-gray-100">{v || "—"}</div>
                  </div>
                ))}
                <div className="col-span-2 flex items-start lg:col-span-1 lg:justify-end">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={copyBtn} onClick={() => copy(acc.account_holder_name, "Holder name")}><Copy className="h-3.5 w-3.5" /> Copy Holder Name</button>
                  <button type="button" className={copyBtn} onClick={() => copy(acc.beneficiary_account_number, "Account number")}><Copy className="h-3.5 w-3.5" /> Copy Account No.</button>
                  <button type="button" className={copyBtn} onClick={() => copy(acc.beneficiary_ifsc, "IFSC")}><Copy className="h-3.5 w-3.5" /> Copy IFSC</button>
                  <button type="button" className={copyBtn} onClick={() => copy(acc.beneficiary_bank_name, "Bank name")}><Copy className="h-3.5 w-3.5" /> Copy Bank Name</button>
                </div>
                <Button onClick={() => { setQErr(null); setQuickOpen(true); }} className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25">
                  <Send /> Quick Transfer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual form */}
      <form onSubmit={onManualSubmit} className={card}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <PlusCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Manual Top-up Form</h2>
            <p className="text-[13px] text-gray-500">Fill all details for a manual fund transfer</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <label className="block">
            <span className={label}>Amount (₹) *</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">₹</span>
              <input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`${filterInputCls} pl-8`} />
            </div>
          </label>
          <label className="block">
            <span className={label}>Beneficiary Account *</span>
            <select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} className={filterInputCls}>
              <option value="">Select beneficiary account</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.beneficiary_bank_name || "Bank"} {last4(a.beneficiary_account_number)} — {a.account_holder_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Payer Name (Optional)</span>
            <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Enter payer name" className={filterInputCls} />
          </label>
          <label className="block">
            <span className={label}>Payer Account/UPI (Optional)</span>
            <input value={payerAccount} onChange={(e) => setPayerAccount(e.target.value)} placeholder="Enter account number or UPI ID" className={filterInputCls} />
          </label>
          <label className="block">
            <span className={label}>UTR/Transaction ID (Optional)</span>
            <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter UTR or transaction ID" className={filterInputCls} />
          </label>
          <label className="block">
            <span className={label}>Reference Note (Optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add reference note" className={filterInputCls} />
          </label>
          <div className="md:col-span-2">
            <span className={label}>Payment Receipt (Optional)</span>
            <ReceiptDrop
              file={receipt}
              error={receiptErr}
              onFile={(f) => {
                const err = f ? checkReceipt(f) : null;
                setReceiptErr(err);
                setReceipt(err ? null : f);
              }}
            />
          </div>
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 md:col-span-2">
              <AlertCircle className="h-4 w-4" /> {formError}
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting} className="h-11 rounded-xl px-6 shadow-lg shadow-indigo-600/25">
              {submitting ? <Loader2 className="animate-spin" /> : <Send />} Submit Top-up Request
            </Button>
          </div>
        </div>
      </form>

      {/* History */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <List className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-gray-100">Top-up History</h2>
              <p className="text-[13px] text-gray-500">Track your fund transfer requests</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
            Filter by Status:
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${filterInputCls.replace("w-full", "w-auto")} sm:w-44`}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Approved</option>
              <option value="failed">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className={`${filterInputCls.replace("w-full", "w-auto")}`} aria-label="Rows per page">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="border-y border-gray-100 bg-slate-50/80 dark:border-gray-800 dark:bg-gray-800/40">
              <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-3 pl-5 pr-3">#</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3">UTR / Transaction ID</th>
                <th className="px-3 py-3">Beneficiary</th>
                <th className="px-3 py-3">Receipt</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Submitted On</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history === null ? (
                <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" /></td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={FileText} title={status ? "No top-ups with this status" : "No top-ups yet"} description="Submitted top-up requests appear here" /></td></tr>
              ) : (
                history.map((t, i) => {
                  const url = receiptUrl(t.receipt_url);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 pl-5 pr-3 text-gray-500">{(page - 1) * perPage + i + 1}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{inr(t.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[12.5px] text-gray-700 dark:text-gray-300">{t.utr_or_txn_id || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-700 dark:text-gray-300">{t.beneficiary_bank_name || "—"} {last4(t.beneficiary_account_number)}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            <FileText className="h-3.5 w-3.5" /> View Receipt
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><StatusPill status={t.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">{when(t.created_at)}</td>
                      <td className="py-2 pl-3 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setView(t)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 text-[12.5px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          <ActionMenu
                            label={`More for top-up ${t.id}`}
                            items={[
                              ...(t.utr_or_txn_id ? [{ label: "Copy UTR", icon: Copy, onClick: () => copy(t.utr_or_txn_id, "UTR") }] : []),
                              ...(url ? [{ label: "Open receipt", icon: FileText, onClick: () => window.open(url, "_blank", "noopener") }] : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && <Pager page={page} perPage={perPage} total={total} noun="records" onPage={setPage} />}
      </div>

      {/* Quick transfer */}
      <Dialog open={quickOpen} onOpenChange={(o) => !qBusy && setQuickOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Transfer</DialogTitle>
            <DialogDescription>
              Already paid into {acc?.beneficiary_bank_name} {last4(acc?.beneficiary_account_number)}? Enter the amount and UTR to request the top-up.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onQuickSubmit} className="space-y-4">
            <label className="block">
              <span className={label}>Amount (₹) *</span>
              <input type="number" step="0.01" min="1" value={qAmount} onChange={(e) => setQAmount(e.target.value)} placeholder="0.00" className={filterInputCls} autoFocus />
            </label>
            <label className="block">
              <span className={label}>UTR/Transaction ID</span>
              <input value={qUtr} onChange={(e) => setQUtr(e.target.value)} placeholder="Helps the admin match your payment" className={filterInputCls} />
            </label>
            <div>
              <span className={label}>Receipt (Optional)</span>
              <ReceiptDrop
                file={qReceipt}
                onFile={(f) => {
                  const err = f ? checkReceipt(f) : null;
                  setQErr(err);
                  setQReceipt(err ? null : f);
                }}
              />
            </div>
            {qErr && <p className="text-[13px] text-red-600">{qErr}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setQuickOpen(false)} disabled={qBusy}>Cancel</Button>
              <Button type="submit" disabled={qBusy}>{qBusy ? <Loader2 className="animate-spin" /> : <Send />} Submit</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Top-up #{view?.id}</DialogTitle>
            <DialogDescription>Submitted {when(view?.created_at)}</DialogDescription>
          </DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {([
                ["Amount", inr(view.amount)],
                ["Status", <StatusPill key="s" status={view.status} />],
                ["Beneficiary", `${view.beneficiary_bank_name ?? "—"} ${last4(view.beneficiary_account_number)}`],
                ["UTR", view.utr_or_txn_id || "—"],
                ["Payer", view.payer_name || "—"],
                ["Payer Account/UPI", view.payer_account_number || "—"],
                ["Reference Note", view.reference_note || "—"],
                ["Processed On", when(view.verified_at)],
                ...(view.admin_notes ? [["Admin Note", view.admin_notes] as [string, ReactNode]] : []),
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className={k === "Admin Note" || k === "Reference Note" ? "col-span-2" : "min-w-0"}>
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
