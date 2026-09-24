// src/pages/admin/TspProvidersPage.tsx
import React, { useEffect, useState } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Blocks,
  CalendarDays,
  FileText,
  Info,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { ProviderCode, ProviderIcon, TspStat } from "@/components/admin-part/tspShared";
import { DIRECTION_LABEL, cumulativeByWeek, fmtDate, thisMonthCount } from "@/components/admin-part/tspUtils";

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
type ProviderStatus = "active" | "inactive";

export type Provider = {
  id: number;
  code?: string | null;
  name: string;
  description?: string | null;
  default_direction?: Direction;
  status?: ProviderStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProviderCreatePayload = {
  code?: string | null;
  name: string;
  description?: string | null;
  default_direction?: Direction;
};

export type ProviderUpdatePayload = Partial<ProviderCreatePayload> & { status?: ProviderStatus };

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

type ProviderForm = {
  code: string;
  name: string;
  description: string;
  default_direction: Direction;
  status: ProviderStatus;
};

const EMPTY_FORM: ProviderForm = { code: "", name: "", description: "", default_direction: "both", status: "active" };

const errMsg = (err: any) =>
  String(err?.response?.data?.detail ?? err?.response?.data?.message ?? err?.message ?? err);

const fieldCls =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-[13px] text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export default function TspProvidersPage(): JSX.Element {
  const { toast } = useToast();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "payin" | "payout" | "both">("all");

  // Create / edit share one form dialog; `editing` null = create
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProviders() {
    setLoading(true);
    setError(null);
    try {
      setProviders(await fetchProviders());
    } catch (err: any) {
      console.error("fetch providers error", err);
      setError(err?.message ?? "Failed to load providers");
      toast({ title: "Failed to load", description: errMsg(err) });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: Provider) {
    setEditing(p);
    setForm({
      code: p.code ?? "",
      name: p.name,
      description: p.description ?? "",
      default_direction: p.default_direction ?? "both",
      status: p.status ?? "active",
    });
    setFormOpen(true);
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: "Validation", description: "Name and code are required" });
      return;
    }
    setSaving(true);
    try {
      const base = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        default_direction: form.default_direction ?? "both",
      };
      if (editing) {
        const updated = await updateProvider(editing.id, { ...base, status: form.status });
        setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        toast({ title: "Updated", description: `${updated.name} updated.` });
      } else {
        const created = await createProvider(base);
        setProviders((p) => [created, ...p]);
        toast({ title: "Created", description: `${created.name} created.` });
      }
      setFormOpen(false);
    } catch (err: any) {
      console.error("save provider error", err);
      toast({ title: editing ? "Update failed" : "Create failed", description: errMsg(err) });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteProvider(deleting.id);
      setProviders((p) => p.filter((x) => x.id !== deleting.id));
      toast({ title: "Deleted", description: `${deleting.name} deleted.` });
      setDeleting(null);
    } catch (err: any) {
      console.error("delete provider error", err);
      toast({ title: "Delete failed", description: errMsg(err) });
    } finally {
      setDeleteBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = providers
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => typeFilter === "all" || (p.default_direction ?? "both") === typeFilter)
    .filter(({ p }) => !q || [p.name, p.code, p.description].some((v) => (v ?? "").toLowerCase().includes(q)));

  const handlesPayin = providers.filter((p) => p.default_direction !== "payout").length;
  const handlesPayout = providers.filter((p) => p.default_direction !== "payin").length;
  const active = providers.filter((p) => (p.status ?? "active") === "active").length;
  const inactive = providers.length - active;
  const added = thisMonthCount(providers);
  const trend = cumulativeByWeek(providers);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">TSP Providers</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Manage payment gateway providers and their configurations</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadProviders} className="h-11 rounded-xl px-4">
            <RefreshCw /> Refresh
          </Button>
          <Button onClick={openCreate} className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25">
            <Plus /> Create Provider
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Total Providers"
          value={loading ? "…" : providers.length}
          icon={Blocks}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={added > 0 ? `+${added} this month` : "No new this month"}
          hintUp={added > 0}
          trend={trend}
          color="#3B6BF6"
        />
        <TspStat
          label="Pay-in Providers"
          value={loading ? "…" : handlesPayin}
          icon={ArrowDownLeft}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint="Handle collections"
        />
        <TspStat
          label="Pay-out Providers"
          value={loading ? "…" : handlesPayout}
          icon={ArrowUpRight}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          hint="Handle payouts"
        />
        <TspStat
          label="Active Providers"
          value={loading ? "…" : active}
          icon={PieChart}
          tile="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          hint={providers.length === 0 ? "No providers yet" : inactive === 0 ? "All providers active" : `${inactive} inactive`}
        />
      </div>

      {/* Providers */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Payment Gateway Providers</h2>
            <p className="mt-0.5 text-[14px] text-gray-500">Configure and manage all TSP (Third-Party Service) providers</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search providers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl pl-10 sm:w-72"
                aria-label="Search providers"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="h-11 w-full rounded-xl sm:w-40" aria-label="Provider type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="payin">Pay-in</SelectItem>
                <SelectItem value="payout">Pay-out</SelectItem>
                <SelectItem value="both">Pay-in &amp; Pay-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <p className="mt-4 text-[13px] text-gray-500">Loading providers...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Error Loading Providers</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
            <Button onClick={loadProviders} className="mt-4">Try Again</Button>
          </div>
        ) : providers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
              <Blocks className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No providers found</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Get started by creating your first TSP provider</p>
            <Button onClick={openCreate} className="mt-4"><Plus /> Create First Provider</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-[14px] text-gray-500">No providers match your search or filter.</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ p, i }) => {
              const isActive = (p.status ?? "active") === "active";
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-gray-200/80 bg-white p-5 transition hover:border-indigo-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-900">
                  <div className="flex items-start gap-4">
                    <ProviderIcon index={i} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[17px] font-semibold text-gray-900 dark:text-gray-100">{p.name}</h3>
                      {p.code && <div className="mt-1"><ProviderCode index={i} code={p.code} /></div>}
                    </div>
                    <span
                      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${
                        isActive
                          ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-amber-500"}`} />
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <dl className="mt-5 flex-1 space-y-3 border-t border-gray-100 pt-4 text-[13px] dark:border-gray-800">
                    {[
                      { icon: Settings2, k: "Provider Type", v: DIRECTION_LABEL[p.default_direction ?? "both"] },
                      { icon: CalendarDays, k: "Created Date", v: fmtDate(p.created_at) },
                      { icon: FileText, k: "Description", v: p.description || "—" },
                    ].map((row) => (
                      <div key={row.k} className="grid grid-cols-[20px_110px_1fr] items-start gap-2">
                        <row.icon className="mt-0.5 h-4 w-4 text-gray-400" />
                        <dt className="text-gray-500">{row.k}</dt>
                        <dd className="min-w-0 break-words font-medium text-gray-800 dark:text-gray-200">{row.v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                    <span className="text-[13px] text-gray-500">ID: {p.id}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 text-[13px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleting(p)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 text-[13px] font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mx-5 mb-5 flex items-start gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <Info className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Provider Configuration Guide</h3>
            <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-400">
              Providers listed here become available on the TSP Mappings page, where you enable them per merchant for pay-in and
              pay-out, choose the default route, and set merchant IDs and amount limits. Inactive providers stay listed but should
              not be used for new routing.
            </p>
          </div>
        </div>
      </div>

      {/* Create / Edit */}
      <Dialog open={formOpen} onOpenChange={(o) => !saving && setFormOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Provider" : "Create TSP Provider"}</DialogTitle>
            <DialogDescription>{editing ? "Update provider details" : "Add a new payment gateway provider"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Name <span className="text-red-500">*</span></span>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Templamart" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Code <span className="text-red-500">*</span></span>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. TEMPLAMART" required />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Description</span>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this provider is used for" />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Provider Type</span>
                <select
                  value={form.default_direction ?? "both"}
                  onChange={(e) => setForm((f) => ({ ...f, default_direction: e.target.value as Direction }))}
                  className={fieldCls}
                >
                  <option value="payin">Pay-in</option>
                  <option value="payout">Pay-out</option>
                  <option value="both">Pay-in &amp; Pay-out</option>
                </select>
              </label>
              {editing && (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProviderStatus }))}
                    className={fieldCls}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              <Button variant="outline" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {editing ? "Save Changes" : "Create Provider"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete provider?</DialogTitle>
            <DialogDescription>
              "{deleting?.name}" and all of its merchant mappings will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              <X /> Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
