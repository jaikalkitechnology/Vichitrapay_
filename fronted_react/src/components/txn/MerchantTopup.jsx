// MerchantTopup.jsx
import React, { useEffect, useState } from "react";
import { BASE_URL } from "@/config";
import api from "@/api/api";
import { StatusBadge } from "@/components/admin-part/ui";

/**
 * - Uses existing endpoints:
 *    GET  `${BASE_URL}/merchant/display-accounts`
 *    POST `${BASE_URL}/merchant/topup_submit`
 *    GET  `${BASE_URL}/merchant/topups-list` (paginated)
 */

export default function MerchantTopup() {
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState([]); // items
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state (full form)
  const [amount, setAmount] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // quick-transfer modal state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickUtr, setQuickUtr] = useState("");
  const [quickReceipt, setQuickReceipt] = useState(null);
  const [quickPreview, setQuickPreview] = useState(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // pagination & filters for history
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(""); // "", "pending", "verified", ...

  useEffect(() => {
    refreshAll();
    return () => {
      if (receiptPreview && typeof URL !== "undefined") URL.revokeObjectURL(receiptPreview);
      if (quickPreview && typeof URL !== "undefined") URL.revokeObjectURL(quickPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refetch when page/perPage/status changes
  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, statusFilter]);

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([fetchAccounts(), fetchHistory()]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch display accounts
  async function fetchAccounts() {
    try {
      const res = await api.get(`${BASE_URL}/merchant/display-accounts`);
      const data = res?.data ?? res;
      setAccounts(Array.isArray(data) ? data : []);
      // keep current selectedAccount if present, else pick first
      if (!selectedAccount && Array.isArray(data) && data.length) {
        setSelectedAccount(data[0]);
      } else if (selectedAccount) {
        // refresh selectedAccount object with latest data
        const found = (data || []).find((a) => a.id === selectedAccount.id);
        if (found) setSelectedAccount(found);
      }
    } catch (e) {
      console.error("fetchAccounts", e);
      setAccounts([]);
    }
  }

  // fetch history (paginated)
  async function fetchHistory() {
    try {
      const params = {
        page,
        per_page: perPage,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get(`${BASE_URL}/merchant/topups-list`, { params });
      const data = res?.data ?? res;

      // backend returns { total, page, per_page, items }
      if (data && typeof data === "object" && Array.isArray(data.items)) {
        setHistory(data.items);
        setTotal(Number(data.total) || 0);
        if (data.page) setPage(Number(data.page));
        if (data.per_page) setPerPage(Number(data.per_page));
      } else if (Array.isArray(data)) {
        setHistory(data);
        setTotal(data.length);
      } else {
        setHistory([]);
        setTotal(0);
      }
    } catch (e) {
      console.error("fetchHistory", e);
      setHistory([]);
      setTotal(0);
    }
  }

  // ---- full form handlers (existing) ----
  function onReceiptChange(e) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setReceiptFile(null);
      setReceiptPreview(null);
      return;
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    const maxBytes = 10 * 1024 * 1024;
    if (!allowed.includes(f.type)) {
      setError("Receipt must be jpg/png/pdf");
      return;
    }
    if (f.size > maxBytes) {
      setError("Receipt must be <= 10 MB");
      return;
    }
    setError(null);
    setReceiptFile(f);
    if (f.type.startsWith("image/") && typeof URL !== "undefined") {
      const url = URL.createObjectURL(f);
      setReceiptPreview(url);
    } else {
      setReceiptPreview(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!beneficiaryId) {
      setError("Select beneficiary account");
      return;
    }

    const form = new FormData();
    form.append("amount", amount);
    form.append("beneficiary_account_id", beneficiaryId);
    if (payerAccount) form.append("payer_account_number", payerAccount);
    if (payerName) form.append("payer_name", payerName);
    if (utr) form.append("utr_or_txn_id", utr);
    if (note) form.append("reference_note", note);
    if (receiptFile) form.append("receipt", receiptFile);

    setSubmitting(true);
    try {
      const res = await api.post(`${BASE_URL}/merchant/topup_submit`, form);
      const data = res?.data ?? res;
      const returned = data?.data ?? data;
      setSuccessMsg(`Top-up submitted (ID: ${returned?.id ?? "unknown"}). Status: ${returned?.status ?? "pending"}`);

      // reset form
      setAmount("");
      setBeneficiaryId("");
      setPayerAccount("");
      setPayerName("");
      setUtr("");
      setNote("");
      setReceiptFile(null);
      if (receiptPreview && typeof URL !== "undefined") {
        URL.revokeObjectURL(receiptPreview);
        setReceiptPreview(null);
      }

      setPage(1);
      await fetchHistory();
    } catch (err) {
      console.error("submit error", err);
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || "Submit failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- quick transfer modal handlers ----
  function openQuickForAccount(account) {
    setSelectedAccount(account);
    setQuickAmount("");
    setQuickUtr("");
    setQuickReceipt(null);
    setQuickPreview(null);
    setQuickOpen(true);
  }

  function onQuickReceiptChange(e) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setQuickReceipt(null);
      setQuickPreview(null);
      return;
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    const maxBytes = 10 * 1024 * 1024;
    if (!allowed.includes(f.type)) {
      alert("Quick receipt must be jpg/png/pdf");
      return;
    }
    if (f.size > maxBytes) {
      alert("Quick receipt must be <= 10 MB");
      return;
    }
    setQuickReceipt(f);
    if (f.type.startsWith("image/") && typeof URL !== "undefined") {
      const url = URL.createObjectURL(f);
      setQuickPreview(url);
    } else {
      setQuickPreview(null);
    }
  }

  async function handleQuickSubmit(e) {
    e.preventDefault();
    if (!selectedAccount) return alert("No beneficiary selected");
    if (!quickAmount || parseFloat(quickAmount) <= 0) return alert("Enter valid amount");
    setQuickSubmitting(true);
    try {
      const form = new FormData();
      form.append("amount", quickAmount);
      form.append("beneficiary_account_id", selectedAccount.id);
      if (quickUtr) form.append("utr_or_txn_id", quickUtr);
      if (quickReceipt) form.append("receipt", quickReceipt);

      const res = await api.post(`${BASE_URL}/merchant/topup_submit`, form);
      const data = res?.data ?? res;
      const returned = data?.data ?? data;
      alert(`Top-up submitted (ID: ${returned?.id ?? "unknown"})`);
      setQuickOpen(false);
      setQuickAmount("");
      setQuickUtr("");
      if (quickPreview && typeof URL !== "undefined") URL.revokeObjectURL(quickPreview);
      setQuickPreview(null);
      await Promise.all([fetchAccounts(), fetchHistory()]);
    } catch (err) {
      console.error("quick submit error", err);
      const msg = err?.response?.data?.detail || err?.response?.data || err?.message || "Submit failed";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setQuickSubmitting(false);
    }
  }

  const pdfurl = "https://api.neopayment.in"
  // ---- utility helpers ----
  function normalizeReceiptUrl(raw) {
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const trimmedBase = pdfurl.replace(/\/$/, "");
    if (raw.startsWith("/")) return trimmedBase + raw;
    return trimmedBase + "/" + raw;
  }

  function copyToClipboard(text) {
    if (!navigator?.clipboard) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      alert("Copied");
      return;
    }
    navigator.clipboard.writeText(text).then(() => alert("Copied"), () => alert("Copy failed"));
  }

  // pagination helpers
  const lastPage = Math.max(1, Math.ceil((total || 0) / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="space-y-5 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Add Funds to Payout Wallet</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Transfer money to your beneficiary accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshAll()}
            className="px-4 h-8 border rounded-md bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 transition-colors text-[13px] border-gray-300 dark:border-gray-700"
           
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Beneficiary Accounts Section */}
     <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
  <div className="mb-6">
    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Beneficiary Accounts</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select an account to copy details or initiate quick transfer</p>
  </div>

  <div className="space-y-4">
    {accounts.map((acct) => {
      const isSelected = selectedAccount && selectedAccount.id === acct.id;
      return (
        <div
          key={acct.id}
          className={`rounded-lg p-4 transition-all duration-200 cursor-pointer ${isSelected ? "border-2" : "border"}`}
          style={{
            borderColor: isSelected ? "#F59E0B" : "#E5E7EB",
            backgroundColor: isSelected ? "#FEF6EC" : "white",
            boxShadow: isSelected ? "0 4px 12px rgba(246,135,19,0.1)" : "none",
          }}
          onClick={() => setSelectedAccount(acct)}
        >
          
          {/* --- RESPONSIVE TOP ROW --- */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 w-full">

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              <div>
                <p className="text-sm font-medium text-gray-500">Account Holder</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {acct.account_holder_name || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Bank Name</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {acct.beneficiary_bank_name || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Account Number</p>
                <p className="font-semibold font-mono text-cyan-600 dark:text-cyan-400">
                  {acct.beneficiary_account_number}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">IFSC Code</p>
                <p className="font-semibold font-mono text-cyan-600 dark:text-cyan-400">
                  {acct.beneficiary_ifsc}
                </p>
              </div>
            </div>

            {/* Status + ID */}
            <div className="flex flex-col items-start lg:items-end gap-2">
              <div
                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                  acct.is_validate ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {acct.is_validate ? "Verified" : "Not Verified"}
              </div>
              <p className="text-xs text-gray-500 whitespace-nowrap">ID: {acct.id}</p>
            </div>
          </div>

          {/* --- RESPONSIVE BUTTON GROUP --- */}
          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-2">

            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(acct.account_holder_name); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-8 text-[13px] border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors whitespace-nowrap border-gray-300 dark:border-gray-700"
             
            >
              Copy Holder Name
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(acct.beneficiary_account_number); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-8 text-[13px] border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors whitespace-nowrap border-gray-300 dark:border-gray-700"
             
            >
              Copy Account No.
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(acct.beneficiary_ifsc); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-8 text-[13px] border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors whitespace-nowrap border-gray-300 dark:border-gray-700"
             
            >
              Copy IFSC
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(acct.beneficiary_bank_name); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-8 text-[13px] border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors whitespace-nowrap border-gray-300 dark:border-gray-700"
             
            >
              Copy Bank Name
            </button>

            {/* Quick Transfer → auto aligned right on big screens, below on mobile */}
            <div className="ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); openQuickForAccount(acct); }}
                className="px-4 h-8 rounded-md text-white font-medium flex items-center gap-2 transition-all whitespace-nowrap text-[13px]"
                style={{ background: "#16A34A" }}
              >
                Quick Transfer
              </button>
            </div>
          </div>
        </div>
      );
    })}

    {/* Empty State */}
    {accounts.length === 0 && (
      <div
        className="text-center py-8 border-2 border-dashed rounded-lg border-gray-300 dark:border-gray-700"
       
      >
        <p className="mt-3 text-gray-600 dark:text-gray-400 font-medium">No beneficiary accounts available</p>
        <p className="text-gray-500 text-sm mt-1">Contact support to add beneficiary accounts</p>
      </div>
    )}
  </div>
</div>


      {/* Full Top-up Form */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Manual Top-up Form</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill all details for manual fund transfer</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center text-red-600 dark:text-red-400">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-center text-green-600 dark:text-green-400">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {successMsg}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amount Field */}
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Amount *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500">₹</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Beneficiary Select */}
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Beneficiary Account *</label>
              <select
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
                className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                required
              >
                <option value="">Select beneficiary account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.beneficiary_bank_name} - {a.beneficiary_account_number} ({a.beneficiary_ifsc})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Payer Name (Optional)</label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Enter payer name"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Payer Account/UPI (Optional)</label>
              <input
                type="text"
                value={payerAccount}
                onChange={(e) => setPayerAccount(e.target.value)}
                className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Enter account or UPI number"
              />
            </div>
          </div>

          {/* UTR and Note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">UTR/Transaction ID (Optional)</label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Enter UTR or transaction ID"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Reference Note (Optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Add reference note"
              />
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Payment Receipt (Optional)</label>
            <div className="border-2 border-dashed rounded-lg p-4 transition hover:border-blue-400 border-gray-300 dark:border-gray-700"
                >
              <div className="flex flex-col items-center justify-center">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="#06B6D4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Upload receipt (JPG, PNG, PDF, max 10MB)</p>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={onReceiptChange}
                  className="mt-2 text-sm"
                />
                {receiptFile && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    ✓ {receiptFile.name} ({(receiptFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              {receiptPreview && (
                <div className="mt-4">
                  <img src={receiptPreview} alt="Receipt preview" className="max-h-40 rounded-lg border" />
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 h-8 text-white font-medium rounded-md transition-all disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white"
             
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Submit Top-up Request"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
  {/* Header */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div className="text-center sm:text-left">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Top-up History
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your fund transfer requests</p>
    </div>

    {/* Filter Group */}
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <label className="text-[13px] font-medium whitespace-nowrap text-gray-700 dark:text-gray-300">
          Filter by Status:
        </label>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  </div>

  {/* Results summary */}
  <div className="mb-4 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-900">
    <p className="text-sm text-gray-700 dark:text-gray-300">
      Showing <span className="font-semibold">{from}–{to}</span> of{" "}
      <span className="font-semibold">{total}</span> records
    </p>
  </div>

  {/* Loading / Empty / Table */}
  {loading ? (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600 mx-auto"></div>
      <p className="mt-3 text-gray-600 dark:text-gray-400">Loading history...</p>
    </div>
  ) : history.length === 0 ? (
    <div
      className="text-center py-8 border-2 border-dashed rounded-lg border-gray-300 dark:border-gray-700"
     
    >
      <svg className="w-12 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="mt-3 text-gray-600 dark:text-gray-400 font-medium">No top-up records found</p>
    </div>
  ) : (
    <>
      {/* Responsive Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-[900px] w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {["ID", "Amount", "UTR", "Beneficiary", "Receipt", "Status", "Submitted"].map(
                (label) => (
                  <th
                    key={label}
                    className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-gray-500 dark:text-gray-400"
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-[13px] font-medium text-gray-900 dark:text-gray-100">#{t.id}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                  ₹{t.amount}
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-500">
                  {t.utr_or_txn_id || <span className="italic text-gray-400">Not provided</span>}
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-500">
                  {t.beneficiary_account_number}
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap text-[13px]">
                  {t.receipt_url ? (
                    <a
                      href={normalizeReceiptUrl(t.receipt_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center hover:underline text-cyan-600 dark:text-cyan-400"
                     
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </a>
                  ) : (
                    <span className="italic text-gray-400">No receipt</span>
                  )}
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap">
                  <StatusBadge status={t.status} />
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-500">
                  {t.created_at ? new Date(t.created_at).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination (Fully Responsive) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
        <div className="text-sm text-center sm:text-left text-gray-900 dark:text-gray-100">
          Page <strong>{page}</strong> of <strong>{lastPage}</strong>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-2 w-full sm:w-auto">
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>

          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-8 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-[13px]"
          >
            Previous
          </button>

          <button
            onClick={() => setPage(Math.min(lastPage, page + 1))}
            disabled={page >= lastPage}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-8 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-[13px]"
          >
            Next
          </button>

          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[13px] text-gray-500 dark:text-gray-400">Go to:</span>

            <input
              type="number"
              min={1}
              max={lastPage}
              placeholder="Page"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= lastPage) setPage(v);
                }
              }}
              className="w-20 h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>
    </>
  )}
</div>


      {/* Quick Transfer Modal */}
      {quickOpen && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quick Transfer</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Complete transfer in one step</p>
              </div>
              <button
                onClick={() => setQuickOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Selected Account Info */}
            <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <p className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Selected Account:</p>
              <div className="space-y-1">
                <p className="text-sm text-cyan-600 dark:text-cyan-400">
                  <span className="font-medium">Bank:</span> {selectedAccount.beneficiary_bank_name}
                </p>
                <p className="text-sm text-cyan-600 dark:text-cyan-400">
                  <span className="font-medium">Account:</span> {selectedAccount.beneficiary_account_number}
                </p>
                <p className="text-sm text-cyan-600 dark:text-cyan-400">
                  <span className="font-medium">IFSC:</span> {selectedAccount.beneficiary_ifsc}
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Amount *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">₹</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    className="pl-8 w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    placeholder="Enter amount"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">UTR/Transaction ID (Optional)</label>
                <input
                  type="text"
                  value={quickUtr}
                  onChange={(e) => setQuickUtr(e.target.value)}
                  className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="Enter UTR if available"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-gray-700 dark:text-gray-300">Receipt (Optional)</label>
                <div className="border-2 border-dashed rounded-lg p-4 transition border-gray-300 dark:border-gray-700"
                    >
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="#06B6D4" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Click to upload receipt</p>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={onQuickReceiptChange}
                      className="mt-2 text-sm w-full"
                    />
                    {quickPreview && (
                      <img src={quickPreview} className="mt-2 max-h-20 rounded border" alt="Preview" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setQuickOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 h-8 border text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-[13px] border-gray-300 dark:border-gray-700"
                 
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 px-4 h-8 text-white font-medium rounded-md transition-all disabled:opacity-70 text-[13px]"
                  style={{ background: '#16A34A' }}
                >
                  {quickSubmitting ? "Processing..." : "Submit Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}