import React, { useMemo, useState } from "react";
import usePayoutAccounts from "@/components/txn/usePayoutAccounts";
import {createPayoutBankAccount} from "@/api/apiHelper"
function validateIFSC(ifsc: string) {
  if (!ifsc) return false;
  return /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim().toUpperCase());
}
function normalizeAccountNumber(ac: string) {
  return ac.replace(/[\s-]/g, "");
}

export default function PayoutAccountsPage() {
  const {
    items,
    total,
    limit,
    offset,
    loading,
    error,
    setPage,
    create,
    refresh,
  } = usePayoutAccounts(10);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // form state
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountType, setAccountType] = useState("");
  const [bankAddress, setBankAddress] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / limit)), [total, limit]);
  const pageIndex = Math.floor(offset / limit);

  const resetForm = () => {
    setHolderName("");
    setAccountNumber("");
    setIfsc("");
    setBankName("");
    setBankBranch("");
    setAccountType("");
    setBankAddress("");
    setFormError(null);
  };

  const openModal = () => { resetForm(); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSubmitting(false); setFormError(null); };

async function handleSubmit(e?: React.FormEvent) {
  if (e) e.preventDefault();
  setFormError(null);

  const acNum = normalizeAccountNumber(accountNumber || "");
  const ifscVal = (ifsc || "").trim().toUpperCase();
  const holder = (holderName || "").trim();

  if (!holder || holder.length < 2) {
    setFormError("Account holder name is required (min 2 chars).");
    return;
  }
  if (!acNum || acNum.length < 6 || acNum.length > 30) {
    setFormError("Account number must be 6-30 characters (no spaces).");
    return;
  }
  if (!validateIFSC(ifscVal)) {
    setFormError("Invalid IFSC code format.");
    return;
  }

  setSubmitting(true);
  setFormError(null);

  const payload = {
    account_holder_name: holder,
    account_number: acNum,
    ifsc_code: ifscVal,
    bank_name: bankName || undefined,
    bank_branch: bankBranch || undefined,
    account_type: accountType || undefined,
    bank_address: bankAddress || undefined,
  };

  // helper to normalize error objects into { message: string, fieldErrors?: Record }
  function normalizeError(err: any): { message: string; fieldErrors?: Record<string, string[]> } {
    try {
      if (!err) return { message: "Unknown error" };

      // If the helper already provides a friendly string
      if (typeof err === "string") return { message: err };

      // If it's a Fetch / Error with message
      if (err instanceof Error && typeof err.message === "string") {
        return { message: err.message };
      }

      // Common: we have err.payload like FastAPI 422
      const payload = err.payload ?? err.response?.data ?? err.data ?? null;

      if (payload) {
        // FastAPI 422 detail array -> join messages and build field map
        if (Array.isArray(payload.detail)) {
          const msgs = payload.detail
            .map((d: any) => (d && typeof d.msg === "string" ? d.msg : JSON.stringify(d)))
            .filter(Boolean);
          const message = msgs.length ? msgs.join("; ") : JSON.stringify(payload.detail);
          const map: Record<string, string[]> = {};
          for (const it of payload.detail) {
            try {
              const loc = Array.isArray(it.loc) ? it.loc.slice(1).join(".") : String(it.loc);
              const m = typeof it.msg === "string" ? it.msg : JSON.stringify(it);
              if (!map[loc]) map[loc] = [];
              map[loc].push(m);
            } catch {}
          }
          return { message, fieldErrors: Object.keys(map).length ? map : undefined };
        }

        // payload.detail string
        if (typeof payload.detail === "string") return { message: payload.detail };

        // payload.message or payload.msg
        if (typeof payload.message === "string") return { message: payload.message };
        if (typeof payload.msg === "string") return { message: payload.msg };

        // fallback stringify payload
        return { message: typeof payload === "string" ? payload : JSON.stringify(payload) };
      }

      // err.fieldErrors pattern (custom)
      if (err.fieldErrors && typeof err.fieldErrors === "object") {
        const firstField = Object.keys(err.fieldErrors)[0];
        const firstMsg = err.fieldErrors[firstField]?.[0];
        return { message: firstMsg ?? "Validation error", fieldErrors: err.fieldErrors };
      }

      // final fallback: stringify err
      return { message: JSON.stringify(err) };
    } catch (normalizeErr) {
      // if normalization itself fails, return a safe string
      return { message: "Failed to parse error" };
    }
  }

  try {
    await createPayoutBankAccount(payload);

    closeModal();
    refresh();
  } catch (err: any) {
    console.error("create payout error (raw):", err);
    const normalized = normalizeError(err);
    // Ensure it's a plain string before setting state or passing to any UI component.
    const safeMessage = typeof normalized.message === "string" ? normalized.message : String(normalized.message);
    // If you use any toast that lowercases messages, pass only the string.
    setFormError(safeMessage);
    // If you want to keep field-level errors later: setFieldErrors?.(normalized.fieldErrors)
  } finally {
    setSubmitting(false);
  }
}



  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h1 className="text-xl sm:text-2xl font-semibold">Payout Bank Accounts</h1>
          <div className="flex gap-2 self-end sm:self-auto">
            <button onClick={() => refresh()} className="px-3 py-2 bg-gray-200 rounded">Refresh</button>
            <button onClick={openModal} className="px-3 py-2 bg-green-600 text-white rounded">Add Account</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded shadow">
          {loading && <div className="p-4 text-sm text-gray-500">Loading...</div>}
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          {!loading && items.length === 0 && <div className="p-4 text-sm text-gray-500">No payout accounts found.</div>}

          {!loading && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Holder</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account No</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IFSC</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Validated</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.id}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.account_holder_name}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.account_number}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.ifsc_code}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.bank_name ?? "-"}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.is_validate ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t">
            <div className="text-sm text-gray-600 mb-2 sm:mb-0">
              Total: <strong>{total}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(0, pageIndex - 1))} className="px-3 py-1 border rounded text-sm" disabled={pageIndex === 0}>Prev</button>
              <div className="px-3 py-1 border rounded text-sm bg-gray-100">Page {pageIndex + 1} / {totalPages}</div>
              <button onClick={() => setPage(Math.min(totalPages - 1, pageIndex + 1))} className="px-3 py-1 border rounded text-sm" disabled={pageIndex + 1 >= totalPages}>Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 !m-0" onClick={closeModal}>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full p-6 z-10" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Payout Bank Account</h2>

            {formError && <div className="mb-3 p-3 text-sm text-red-700 bg-red-100 rounded">{formError}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account holder name</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account number</label>
                  <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IFSC</label>
                  <input value={ifsc} onChange={(e) => setIfsc(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank name</label>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank branch</label>
                  <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account type</label>
                <input value={accountType} onChange={(e) => setAccountType(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., savings, current" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank address</label>
                <input value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}