// src/pages/admin/TspProvidersPage.tsx
import React, { useEffect, useState } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

/**
 * TSP Providers management page
 * - List providers
 * - Create provider
 * - Edit provider
 * - Delete provider
 *
 * Backend endpoints assumed:
 * GET  ${BASE_URL}/tsp/providers
 * POST ${BASE_URL}/tsp/providers
 * PUT  ${BASE_URL}/tsp/providers/{id}
 * DELETE ${BASE_URL}/tsp/providers/{id}
 */

/* ----------------------------- Types ------------------------------ */
type Direction = "payin" | "payout" | "both" | null;

export type Provider = {
  id: number;
  code?: string | null;
  name: string;
  description?: string | null;
  default_direction?: Direction;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProviderCreatePayload = {
  code?: string | null;
  name: string;
  description?: string | null;
  default_direction?: Direction;
};

export type ProviderUpdatePayload = Partial<ProviderCreatePayload>;

/* --------------------------- API helpers -------------------------- */

async function fetchProviders(): Promise<Provider[]> {
  const res = await api.get(`${API_ORIGIN}/tsp/providers`);
  const data = res.data;
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

async function createProvider(payload: ProviderCreatePayload) {
  const res = await api.post(`${API_ORIGIN}/tsp/providers`, payload);
  return res.data;
}

async function updateProvider(providerId: number, payload: ProviderUpdatePayload) {
  const res = await api.put(`${API_ORIGIN}/tsp/providers/${providerId}`, payload);
  return res.data;
}

async function deleteProvider(providerId: number) {
  const res = await api.delete(`${API_ORIGIN}/tsp/providers/${providerId}`);
  return res.data;
}

/* --------------------------- Component ---------------------------- */

export default function TspProvidersPage(): JSX.Element {
  const { toast } = useToast();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ProviderCreatePayload>({
    code: "",
    name: "",
    description: "",
    default_direction: null,
  });

  // Edit modal state
  const [editing, setEditing] = useState<Provider | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editForm, setEditForm] = useState<ProviderUpdatePayload | null>(null);

  useEffect(() => {
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProviders() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviders();
      setProviders(data);
    } catch (err: any) {
      console.error("fetch providers error", err);
      setError(err?.message ?? "Failed to load providers");
      toast({ title: "Failed to load", description: String(err?.message ?? err) });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setCreateForm({ code: "", name: "", description: "", default_direction: null });
    setCreateOpen(true);
  }
  function closeCreate() {
    setCreateOpen(false);
    setCreating(false);
  }

  async function submitCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!createForm || !createForm.name || createForm.name.trim() === "") {
      toast({ title: "Validation", description: "Name is required" });
      return;
    }
    setCreating(true);
    try {
      const payload: ProviderCreatePayload = {
        code: createForm.code ? String(createForm.code).trim() : undefined,
        name: String(createForm.name).trim(),
        description: createForm.description ? String(createForm.description).trim() : undefined,
        default_direction: createForm.default_direction ?? null,
      };
      const created = await createProvider(payload);
      // update list
      setProviders((p) => [created, ...p]);
      toast({ title: "Created", description: `${created.name} created.` });
      closeCreate();
    } catch (err: any) {
      console.error("create provider error", err);
      toast({ title: "Create failed", description: String(err?.response?.data?.message ?? err?.message ?? err) });
      setCreating(false);
    }
  }

  function openEdit(provider: Provider) {
    setEditing(provider);
    setEditForm({
      code: provider.code ?? undefined,
      name: provider.name,
      description: provider.description ?? undefined,
      default_direction: provider.default_direction ?? null,
    });
  }

  function closeEdit() {
    setEditing(null);
    setEditForm(null);
    setEditingSaving(false);
  }

  async function submitEdit() {
    if (!editing || !editForm) return;
    if (!editForm.name || String(editForm.name).trim() === "") {
      toast({ title: "Validation", description: "Name is required" });
      return;
    }
    setEditingSaving(true);
    try {
      const payload: ProviderUpdatePayload = {
        code: editForm.code ? String(editForm.code).trim() : null,
        name: String(editForm.name).trim(),
        description: editForm.description ? String(editForm.description).trim() : null,
        default_direction: editForm.default_direction ?? null,
      };
      const updated = await updateProvider(editing.id, payload);
      setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "Updated", description: `${updated.name} updated.` });
      closeEdit();
    } catch (err: any) {
      console.error("update provider error", err);
      toast({ title: "Update failed", description: String(err?.response?.data?.message ?? err?.message ?? err) });
      setEditingSaving(false);
    }
  }

  async function handleDelete(provider: Provider) {
    // confirm
    // using window.confirm for simplicity
    // replace with nicer modal if you have one
    const ok = window.confirm(`Delete provider "${provider.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteProvider(provider.id);
      setProviders((p) => p.filter((x) => x.id !== provider.id));
      toast({ title: "Deleted", description: `${provider.name} deleted.` });
    } catch (err: any) {
      console.error("delete provider error", err);
      toast({ title: "Delete failed", description: String(err?.response?.data?.message ?? err?.message ?? err) });
    }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">TSP Providers</h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Manage payment gateway providers and their configurations</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadProviders}
              className="rounded-lg border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
            <Button
              onClick={openCreate}
              className="h-8"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Provider
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Total Providers</p>
                  <p className="text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                    {loading ? '...' : providers.length}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Pay-In Providers</p>
                  <p className="text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                    {loading ? '...' : providers.filter(p => p.default_direction === 'payin').length}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Pay-Out Providers</p>
                  <p className="text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                    {loading ? '...' : providers.filter(p => p.default_direction === 'payout').length}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Payment Gateway Providers</CardTitle>
                <p className="text-gray-600 text-sm mt-1">Configure and manage all TSP (Third-Party Service) providers</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <Input
                    placeholder="Search providers..."
                    className="pl-9 w-full md:w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600"></div>
                <p className="mt-4 text-gray-600">Loading providers...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Error Loading Providers</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
                <Button onClick={loadProviders} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : providers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No providers found</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Get started by creating your first TSP provider</p>
                <Button onClick={openCreate} className="mt-4">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Provider
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {providers.map((p) => (
                  <div key={p.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900 transition-all duration-300 hover:border-blue-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</h4>
                          {p.code && (
                            <Badge className="mt-1 bg-blue-100 text-blue-800 hover:bg-blue-200">
                              {p.code}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Description</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">{p.description || "No description"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Default Direction</div>
                        <div>
                          {p.default_direction ? (
                            <Badge className={
                              p.default_direction === 'payin' ? 'bg-blue-100 text-blue-800' :
                              p.default_direction === 'payout' ? 'bg-orange-100 text-orange-800' :
                              'bg-purple-100 text-purple-800'
                            }>
                              {p.default_direction}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-500">Not specified</span>
                          )}
                        </div>
                      </div>
                      {p.created_at && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Created</div>
                          <div className="text-sm text-gray-600">
                            {new Date(p.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="text-xs text-gray-500">
                        ID: {p.id}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => openEdit(p)}
                          className="rounded-lg px-4"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(p)}
                          className="rounded-lg px-4"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create TSP Provider</h3>
                <p className="text-gray-600 text-sm mt-1">Add a new payment gateway provider</p>
              </div>
              <button onClick={closeCreate} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={submitCreate} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Code <span className="text-gray-500">(optional)</span>
                </label>
                <Input 
                  value={createForm.code ?? ""} 
                  onChange={(e) => setCreateForm(s => ({ ...s, code: e.target.value }))} 
                  placeholder="e.g., RAZORPAY, PAYTM"
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input 
                  value={createForm.name ?? ""} 
                  onChange={(e) => setCreateForm(s => ({ ...s, name: e.target.value }))} 
                  required 
                  placeholder="Enter provider name"
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <Input 
                  value={createForm.description ?? ""} 
                  onChange={(e) => setCreateForm(s => ({ ...s, description: e.target.value }))} 
                  placeholder="Provider description or notes"
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Default Direction
                </label>
                <select
                  value={createForm.default_direction ?? ""}
                  onChange={(e) => setCreateForm(s => ({ ...s, default_direction: e.target.value ? (e.target.value as Direction) : null }))}
                  className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">Select direction (optional)</option>
                  <option value="payin">Pay-In</option>
                  <option value="payout">Pay-Out</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={closeCreate}
                  className="rounded-lg px-6"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={creating}
                  className="px-4"
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : 'Create Provider'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Provider</h3>
                <p className="text-gray-600 text-sm mt-1">Update provider details</p>
              </div>
              <button onClick={closeEdit} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Code <span className="text-gray-500">(optional)</span>
                </label>
                <Input 
                  value={editForm.code ?? ""} 
                  onChange={(e) => setEditForm(s => ({ ...s!, code: e.target.value }))} 
                  placeholder="e.g., RAZORPAY, PAYTM"
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input 
                  value={editForm.name ?? ""} 
                  onChange={(e) => setEditForm(s => ({ ...s!, name: e.target.value }))} 
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <Input 
                  value={editForm.description ?? ""} 
                  onChange={(e) => setEditForm(s => ({ ...s!, description: e.target.value }))} 
                 
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Default Direction
                </label>
                <select
                  value={editForm.default_direction ?? ""}
                  onChange={(e) => setEditForm(s => ({ ...s!, default_direction: e.target.value ? (e.target.value as Direction) : null }))}
                  className="w-full h-8 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">Select direction (optional)</option>
                  <option value="payin">Pay-In</option>
                  <option value="payout">Pay-Out</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
                <Button 
                  variant="outline" 
                  onClick={closeEdit}
                  className="rounded-lg px-6"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={submitEdit} 
                  disabled={editingSaving}
                  className="rounded-lg px-6"
                >
                  {editingSaving ? (
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
        </div>
      )}
    </div>
  );
}