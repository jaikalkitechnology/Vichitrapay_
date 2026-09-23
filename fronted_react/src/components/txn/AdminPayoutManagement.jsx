import React, { useEffect, useState } from "react";
import { BASE_URL } from "@/config";
import api from "@/api/api";

export default function AdminPayoutManagement() {
  const [displayAccounts, setDisplayAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Display account form
  const [form, setForm] = useState({
    id: null,
    account_holder_name: "",
    beneficiary_account_number: "",
    beneficiary_ifsc: "",
    beneficiary_bank_name: "",
    is_validate: false,
  });
  const [formMode, setFormMode] = useState("create");
  const [errors, setErrors] = useState(null);

  // Topups: data + pagination + filters for pending and verified
  const [pendingTopups, setPendingTopups] = useState([]);
  const [pendingMeta, setPendingMeta] = useState({ total: 0, page: 1, per_page: 20 });
  const [pendingFilters, setPendingFilters] = useState({
    user_id: "",
    payer_name: "",
    utr_or_txn_id: "",
    instrument: "",
    min_amount: "",
    max_amount: "",
    date_from: "",
    date_to: "",
  });

  const [verifiedTopups, setVerifiedTopups] = useState([]);
  const [verifiedMeta, setVerifiedMeta] = useState({ total: 0, page: 1, per_page: 20 });
  const [verifiedFilters, setVerifiedFilters] = useState({
    user_id: "",
    payer_name: "",
    utr_or_txn_id: "",
    instrument: "",
    min_amount: "",
    max_amount: "",
    date_from: "",
    date_to: "",
  });

  // UI action state
  const [selectedTopup, setSelectedTopup] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // -- lifecycle
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refetch pending whenever its page/per_page/filters change
  useEffect(() => {
    fetchPendingTopups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMeta.page, pendingMeta.per_page, pendingFilters]);

  useEffect(() => {
    fetchVerifiedTopups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedMeta.page, verifiedMeta.per_page, verifiedFilters]);

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([fetchDisplayAccounts(), fetchPendingTopups(), fetchVerifiedTopups()]);
    } finally {
      setLoading(false);
    }
  }

  // --------- Display accounts ----------
  async function fetchDisplayAccounts() {
    try {
      const res = await api.get(`${BASE_URL}/admin/admin/display-account`);
      const data = res.data ?? res;
      setDisplayAccounts(data);
    } catch (e) {
      console.error("fetchDisplayAccounts", e);
      setDisplayAccounts([]);
    }
  }

  async function submitDisplayAccount(e) {
    e.preventDefault();
    setErrors(null);
    const payload = {
      account_holder_name: form.account_holder_name,
      beneficiary_account_number: form.beneficiary_account_number,
      beneficiary_ifsc: form.beneficiary_ifsc,
      beneficiary_bank_name: form.beneficiary_bank_name,
      is_validate: form.is_validate,
    };

    try {
      let res;
      if (formMode === "create") {
        res = await api.post(`${BASE_URL}/admin/admin/display-account`, payload);
      } else {
        res = await api.patch(`${BASE_URL}/admin/admin/display-account/${form.id}`, payload);
      }
      await fetchDisplayAccounts();
      resetForm();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.message || JSON.stringify(err);
      setErrors(msg);
    }
  }

  function resetForm() {
    setForm({ id: null, beneficiary_account_number: "", beneficiary_ifsc: "", beneficiary_bank_name: "", is_validate: false });
    setFormMode("create");
  }

  function editAccount(acct) {
    setFormMode("edit");
    setForm({
      id: acct.id,
      account_holder_name: acct.account_holder_name,
      beneficiary_account_number: acct.beneficiary_account_number || "",
      beneficiary_ifsc: acct.beneficiary_ifsc || "",
      beneficiary_bank_name: acct.beneficiary_bank_name || "",
      is_validate: !!acct.is_validate,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAccount(id) {
    if (!confirm("Delete this display account?")) return;
    try {
      await api.delete(`${BASE_URL}/admin/admin/display-account/${id}`);
      await fetchDisplayAccounts();
    } catch (e) {
      console.error(e);
      alert("Could not delete account");
    }
  }

  // --------- Helpers ----------
  function normalizeParamsFromFilters(filters) {
    // convert empty strings to undefined, convert date to ISO if present
    const p = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === null || typeof v === "undefined") return;
      // date inputs are YYYY-MM-DD; attach full ISO (server expects datetime but date-only works often)
      if ((k === "date_from" || k === "date_to") && v) {
        p[k] = v; // pass as is (backend will parse)
      } else {
        p[k] = v;
      }
    });
    return p;
  }
  const pdfurl = "https://api.neopayment.in"

  function receiptUrl(raw) {
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const trimmedBase = pdfurl.replace(/\/$/, "");
    if (raw.startsWith("/")) return trimmedBase + raw;
    return trimmedBase + "/" + raw;
  }

  // --------- Pending topups (paginated + filters) ----------
  async function fetchPendingTopups() {
    try {
      const { page, per_page } = pendingMeta;
      const params = {
        page,
        per_page,
        ...normalizeParamsFromFilters(pendingFilters),
      };
      const res = await api.get(`${BASE_URL}/admin/admin/topup/pending`, { params });
      const data = res.data ?? res;
      // backend returns { total, page, per_page, items }
      setPendingTopups(data.items ?? []);
      setPendingMeta((prev) => ({ ...prev, total: data.total ?? 0 }));
    } catch (e) {
      console.error("fetchPendingTopups", e);
      setPendingTopups([]);
      setPendingMeta((prev) => ({ ...prev, total: 0 }));
    }
  }

  // --------- Verified topups (paginated + filters) ----------
  async function fetchVerifiedTopups() {
    try {
      const { page, per_page } = verifiedMeta;
      const params = {
        page,
        per_page,
        ...normalizeParamsFromFilters(verifiedFilters),
      };
      const res = await api.get(`${BASE_URL}/admin/admin/topup/verified`, { params });
      const data = res.data ?? res;
      setVerifiedTopups(data.items ?? []);
      setVerifiedMeta((prev) => ({ ...prev, total: data.total ?? 0 }));
    } catch (e) {
      console.error("fetchVerifiedTopups", e);
      setVerifiedTopups([]);
      setVerifiedMeta((prev) => ({ ...prev, total: 0 }));
    }
  }

  // --------- Actions: approve / reject ----------
  async function approveTopup(id) {
    if (!confirm("Approve and credit this topup?")) return;
    setActionLoading(true);
    try {
      await api.post(`${BASE_URL}/admin/admin/topup/${id}/approve`);
      // refresh lists
      await Promise.all([fetchPendingTopups(), fetchVerifiedTopups(), fetchDisplayAccounts()]);
      alert("Topup approved");
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || e?.message || JSON.stringify(e);
      alert("Approve failed: " + msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectTopup(id, reason) {
    const r = reason || rejectReason || prompt("Enter reject reason");
    if (!r) return alert("Reject reason required");
    setActionLoading(true);
    try {
      const form = new FormData();
      form.append("reason", r);
      await api.post(`${BASE_URL}/admin/admin/topup/${id}/reject`, form);
      setRejectReason("");
      await Promise.all([fetchPendingTopups(), fetchVerifiedTopups()]);
      alert("Topup rejected");
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || e?.message || JSON.stringify(e);
      alert("Reject failed: " + msg);
    } finally {
      setActionLoading(false);
    }
  }

  // ---------- small pagination helpers ----------
  function setPendingPage(newPage) {
    setPendingMeta((p) => ({ ...p, page: newPage }));
  }
  function setVerifiedPage(newPage) {
    setVerifiedMeta((p) => ({ ...p, page: newPage }));
  }

  function setPendingPerPage(n) {
    setPendingMeta((p) => ({ ...p, per_page: n, page: 1 }));
  }
  function setVerifiedPerPage(n) {
    setVerifiedMeta((p) => ({ ...p, per_page: n, page: 1 }));
  }

  // ---------- small UI helpers ----------
  function renderPagination(meta, onPrev, onNext, onJumpToPage, onPerPageChange) {
    const total = meta.total ?? 0;
    const page = meta.page ?? 1;
    const per_page = meta.per_page ?? 20;
    const lastPage = Math.max(1, Math.ceil(total / per_page));
    const from = total === 0 ? 0 : (page - 1) * per_page + 1;
    const to = Math.min(total, page * per_page);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{from}–{to}</span> of <span className="font-semibold">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={per_page} 
            onChange={(e) => onPerPageChange(Number(e.target.value))} 
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button 
              disabled={page <= 1} 
              onClick={() => onPrev()} 
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">{page} / {lastPage}</span>
            <button
              disabled={page >= lastPage}
              onClick={() => onNext()}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>

            <div className="relative">
              <input
                type="number"
                min={1}
                max={lastPage}
                placeholder="Jump"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = Number(e.target.value);
                    if (v >= 1 && v <= lastPage) onJumpToPage(v);
                  }
                }}
                className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- render ----------
  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Payout Management</h1>
            <p className="text-sm text-[var(--vp-text-secondary)] mt-2">Manage display accounts and top-up approvals</p>
          </div>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-md transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #3871C2, #00ADEF)' }}
          >
            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Refreshing..." : "Refresh All"}
          </button>
        </div>

        {/* Display Account Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700 border-l-4 border-l-[#3871C2]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[22px] font-semibold" style={{ color: 'var(--vp-blue)' }}>
                {formMode === "create" ? "Add Display Account" : "Edit Display Account"}
              </h2>
              <p className="text-sm text-[var(--vp-text-secondary)] mt-1">Configure accounts for merchant display</p>
            </div>
            {formMode === "edit" && (
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {errors && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center text-red-700">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors}
              </div>
            </div>
          )}

          <form onSubmit={submitDisplayAccount} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <input 
                  value={form.account_holder_name} 
                  onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required 
                  placeholder="Enter account holder name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input 
                  value={form.beneficiary_account_number} 
                  onChange={(e) => setForm({ ...form, beneficiary_account_number: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required 
                  placeholder="Enter account number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  IFSC Code
                </label>
                <input 
                  value={form.beneficiary_ifsc} 
                  onChange={(e) => setForm({ ...form, beneficiary_ifsc: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter IFSC code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bank Name
                </label>
                <input 
                  value={form.beneficiary_bank_name} 
                  onChange={(e) => setForm({ ...form, beneficiary_bank_name: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter bank name"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <input 
                type="checkbox" 
                checked={form.is_validate} 
                onChange={(e) => setForm({ ...form, is_validate: e.target.checked })} 
                className="h-5 w-5 rounded border-gray-300"
              />
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Validated Account</label>
                <p className="text-xs text-gray-500 mt-1">Show this account to merchants for top-ups</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="submit" 
                className="px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-md transition-all duration-300"
                style={{ background: formMode === "create" ? 'linear-gradient(135deg, #3871C2, #00ADEF)' : 'linear-gradient(135deg, #41B93D, #2E8B29)' }}
              >
                {formMode === "create" ? (
                  <>
                    <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Account
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Update Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Display Accounts List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold" style={{ color: 'var(--vp-blue)' }}>Display Accounts</h2>
                <p className="text-sm text-[var(--vp-text-secondary)] mt-1">Accounts available for merchant top-ups</p>
              </div>
              <div className="text-sm text-gray-500">
                {displayAccounts.length} account{displayAccounts.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#3871C2' }}></div>
                <p className="mt-3 text-gray-600">Loading accounts...</p>
              </div>
            ) : displayAccounts.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-9 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="text-gray-600 font-medium">No display accounts found</p>
                <p className="text-gray-500 text-sm mt-1">Create your first display account above</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account Holder</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account Number</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">IFSC</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Bank</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {displayAccounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#3871C2' }}>#{a.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{a.account_holder_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{a.beneficiary_account_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{a.beneficiary_ifsc}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{a.beneficiary_bank_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          a.is_validate ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {a.is_validate ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Active
                            </>
                          ) : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => editAccount(a)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteAccount(a.id)}
                            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors text-xs font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pending Top-ups Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold" style={{ color: 'var(--vp-blue)' }}>Pending Top-ups</h2>
                <p className="text-sm text-[var(--vp-text-secondary)] mt-1">Awaiting approval from administrators</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  Total: <span className="font-semibold">{pendingMeta.total}</span>
                </span>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Page {pendingMeta.page}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input 
                placeholder="User ID" 
                value={pendingFilters.user_id} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, user_id: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Payer Name" 
                value={pendingFilters.payer_name} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, payer_name: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="UTR / Transaction ID" 
                value={pendingFilters.utr_or_txn_id} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, utr_or_txn_id: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Instrument (Bank/UPI)" 
                value={pendingFilters.instrument} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, instrument: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Min Amount" 
                type="number" 
                value={pendingFilters.min_amount} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, min_amount: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Max Amount" 
                type="number" 
                value={pendingFilters.max_amount} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, max_amount: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Date From" 
                type="date" 
                value={pendingFilters.date_from} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, date_from: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Date To" 
                type="date" 
                value={pendingFilters.date_to} 
                onChange={(e) => setPendingFilters((p) => ({ ...p, date_to: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {pendingTopups.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-9 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-gray-600 font-medium">No pending top-ups</p>
                <p className="text-gray-500 text-sm mt-1">All top-ups are processed</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Beneficiary</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">UTR/Txn</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Receipt</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {pendingTopups.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#3871C2' }}>#{t.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex flex-col">
                          <span className="font-medium">{(t.user && t.user.username) || t.user_id}</span>
                          <span className="text-xs text-gray-500">ID: {t.user_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-green-600">₹{t.amount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{t.beneficiary_account_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{t.utr_or_txn_id || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {t.receipt_url ? (
                          <button
                            onClick={() => {
                              const url = receiptUrl(t.receipt_url);
                              window.open(url, "_blank", "noopener,noreferrer");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No receipt</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveTopup(t.id)}
                            disabled={actionLoading}
                            className="px-3 h-9 rounded-lg bg-[#41B93D] text-white hover:bg-green-600 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={() => { const r = prompt("Reject reason"); if (r) rejectTopup(t.id, r); }}
                            disabled={actionLoading}
                            className="px-3 h-9 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pendingTopups.length > 0 && renderPagination(
            pendingMeta,
            () => setPendingPage(Math.max(1, pendingMeta.page - 1)),
            () => setPendingPage(pendingMeta.page + 1),
            (p) => setPendingPage(p),
            (n) => setPendingPerPage(n)
          )}
        </div>

        {/* Verified Top-ups Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold" style={{ color: 'var(--vp-blue)' }}>Verified Top-ups</h2>
                <p className="text-sm text-[var(--vp-text-secondary)] mt-1">Approved and processed transactions</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  Total: <span className="font-semibold">{verifiedMeta.total}</span>
                </span>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Page {verifiedMeta.page}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input 
                placeholder="User ID" 
                value={verifiedFilters.user_id} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, user_id: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Payer Name" 
                value={verifiedFilters.payer_name} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, payer_name: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="UTR / Transaction ID" 
                value={verifiedFilters.utr_or_txn_id} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, utr_or_txn_id: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Instrument (Bank/UPI)" 
                value={verifiedFilters.instrument} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, instrument: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Min Amount" 
                type="number" 
                value={verifiedFilters.min_amount} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, min_amount: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Max Amount" 
                type="number" 
                value={verifiedFilters.max_amount} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, max_amount: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Date From" 
                type="date" 
                value={verifiedFilters.date_from} 
                onChange={(e) => setVerifiedFilters((p) => ({ ...p, date_from: e.target.value }))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                placeholder="Date To" 
                type="date" 
                value={verifiedFilters.date_to} 
                onChange={(e) => setVerifiedFilters((p) => setVerifiedFilters((p2) => ({ ...p2, date_to: e.target.value })))} 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {verifiedTopups.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-9 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-gray-600 font-medium">No verified top-ups</p>
                <p className="text-gray-500 text-sm mt-1">No top-ups have been verified yet</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Beneficiary</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">UTR/Txn</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Receipt</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {verifiedTopups.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#3871C2' }}>#{t.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex flex-col">
                          <span className="font-medium">{(t.user && t.user.username) || t.user_id}</span>
                          <span className="text-xs text-gray-500">ID: {t.user_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-green-600">₹{t.amount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{t.beneficiary_account_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">{t.utr_or_txn_id || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {t.receipt_url ? (
                          <button
                            onClick={() => { setSelectedTopup({ ...t, receipt_url: receiptUrl(t.receipt_url) }); setShowReceiptModal(true); }}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No receipt</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          t.status === 'approved' ? 'bg-green-100 text-green-800' :
                          t.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {verifiedTopups.length > 0 && renderPagination(
            verifiedMeta,
            () => setVerifiedPage(Math.max(1, verifiedMeta.page - 1)),
            () => setVerifiedPage(verifiedMeta.page + 1),
            (p) => setVerifiedPage(p),
            (n) => setVerifiedPerPage(n)
          )}
        </div>

        {/* Receipt Modal */}
        {showReceiptModal && selectedTopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--vp-blue)' }}>Receipt — Topup #{selectedTopup.id}</h3>
                  <p className="text-sm text-[var(--vp-text-secondary)] mt-1">View transaction receipt details</p>
                </div>
                <button 
                  onClick={() => setShowReceiptModal(false)} 
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6">
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">User</div>
                    <div className="font-medium">{(selectedTopup.user && selectedTopup.user.username) || selectedTopup.user_id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Amount</div>
                    <div className="font-medium text-green-600">₹{selectedTopup.amount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">UTR/Txn ID</div>
                    <div className="font-medium font-mono">{selectedTopup.utr_or_txn_id || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Submitted</div>
                    <div className="font-medium">{selectedTopup.created_at ? new Date(selectedTopup.created_at).toLocaleString() : "-"}</div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Receipt Preview</div>
                  <div className="flex justify-center items-center min-h-[300px] bg-white dark:bg-gray-800 rounded border">
                    {selectedTopup.receipt_url ? (
                      selectedTopup.receipt_url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img 
                          src={selectedTopup.receipt_url} 
                          alt="receipt" 
                          className="max-w-full max-h-[400px] object-contain"
                        />
                      ) : (
                        <div className="p-6 text-center">
                          <svg className="w-12 h-9 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-600 mb-2">Receipt document available</p>
                          <a 
                            href={selectedTopup.receipt_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center px-4 py-2 rounded-lg text-white"
                            style={{ background: 'linear-gradient(135deg, #3871C2, #00ADEF)' }}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Receipt
                          </a>
                        </div>
                      )
                    ) : (
                      <div className="p-6 text-center">
                        <svg className="w-12 h-9 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-600">No receipt attached</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}