// TSP Provider Mapping — enable providers per merchant for pay-in / pay-out
import React, { useEffect, useMemo, useState } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Info,
  Link2,
  Loader2,
  Network,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { ActionMenu } from "@/components/admin-part/ui";
import { ProviderCode, ProviderIcon, TspStat } from "@/components/admin-part/tspShared";
import { avatarTone, cumulativeByWeek, thisMonthCount } from "@/components/admin-part/tspUtils";


/* types (kept similar to your original file) */
type MerchantShort = { id: string; username: string; email?: string; company_name?: string | null; created_at?: string | null };
type Provider = {
  id: number;
  code?: string;
  name: string;
  description?: string | null;
  default_direction?: "payin" | "payout" | "both" | null;
  status?: "active" | "inactive" | null;
  created_at?: string | null;
  // optional capabilities may exist
  capabilities?: Record<string, any>;
};
type Mapping = {
  id: number;
  merchant_id: string;
  provider_id: number;
  direction: "payin" | "payout" | "both";
  enabled: boolean;
  priority?: number | null;
  provider?: Provider;
  config?: Record<string, any> | null;
  min_amount?: number | null;
  max_amount?: number | null;
};

type Direction = "payin" | "payout" | "both";

export interface MappingCreatePayload {
  merchant_id: string;
  provider_id: number;
  direction: Direction;
  enabled?: boolean;
  priority?: number;
  config?: Record<string, any> | null;
  min_amount?: number | null;
  max_amount?: number | null;
}
export interface MappingUpdatePayload {
  direction?: Direction;
  enabled?: boolean;
  priority?: number;
  config?: Record<string, any> | null;
  min_amount?: number | null;
  max_amount?: number | null;
}

/* ---------- small api helpers (use your api wrapper) ---------- */
async function fetchMerchants(): Promise<MerchantShort[]> {
  const res = await api.get(`${BASE_URL}/admin/users-with-wallets`, { params: { role: 2, page: 1, per_page: 100 } });
  const data = res.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? data.users ?? [];
}
async function fetchProviders(): Promise<Provider[]> {
  const res = await api.get(`${API_ORIGIN}/tsp/providers?skip=0&limit=100`);
  const data = res.data;
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}
async function createMapping(payload: MappingCreatePayload) {
  const res = await api.post(`${API_ORIGIN}/tsp/mappings`, payload);
  return res.data;
}
async function updateMapping(mappingId: number, payload: MappingUpdatePayload) {
  const res = await api.put(`${API_ORIGIN}/tsp/mappings/${mappingId}`, payload);
  return res.data;
}
async function deleteMapping(mappingId: number) {
  const res = await api.delete(`${API_ORIGIN}/tsp/mappings/${mappingId}`);
  return res.data;
}
async function fetchMappingsForMerchant(merchantId: string): Promise<Mapping[]> {
  const res = await api.get(`${API_ORIGIN}/tsp/mappings`, { params: { merchant_id: merchantId } });
  const data = res.data;
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}


/* ----------------- drafts ----------------- */
type Draft = {
  payin: boolean;
  payout: boolean;
  enabled: boolean;
  isDefault: boolean;
  payIn_mid: string;
  payOut_mid: string;
  is_active_payIn: boolean;
  is_active_payOut: boolean;
  min_amount: string | number;
  max_amount: string | number;
  existing: Mapping | null;
  /** provider added on this page but not saved yet */
  added?: boolean;
  dirty?: boolean;
  saving?: boolean;
  error?: string | null;
};

/** Lower priority wins routing; the page's "Default" provider is saved with this value. */
const DEFAULT_PRIORITY = 1;
const NORMAL_PRIORITY = 100;

function draftFromMapping(existing: Mapping | null, isDefault: boolean): Draft {
  const cfg = existing?.config ?? {};
  return {
    payin: !!existing && (existing.direction === "payin" || existing.direction === "both"),
    payout: !!existing && (existing.direction === "payout" || existing.direction === "both"),
    enabled: existing ? existing.enabled !== false : true,
    isDefault,
    payIn_mid: cfg?.payIn_mid ?? "",
    payOut_mid: cfg?.payOut_mid ?? "",
    is_active_payIn: cfg?.is_active_payIn ?? !!cfg?.payIn_mid,
    is_active_payOut: cfg?.is_active_payOut ?? !!cfg?.payOut_mid,
    min_amount: existing?.min_amount ?? "",
    max_amount: existing?.max_amount ?? "",
    existing,
  };
}

function directionOf(d: { payin: boolean; payout: boolean }): Direction | null {
  if (d.payin && d.payout) return "both";
  if (d.payin) return "payin";
  if (d.payout) return "payout";
  return null;
}

const errMsg = (err: any) =>
  String(err?.response?.data?.detail ?? err?.response?.data?.message ?? err?.message ?? err);

/* ----------------- component ----------------- */
export default function TspMappingPage(): JSX.Element {
  const { toast } = useToast();

  const [merchants, setMerchants] = useState<MerchantShort[]>([]);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  const [bootLoading, setBootLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [configId, setConfigId] = useState<number | null>(null);
  const [newProv, setNewProv] = useState<string>("");
  const [newPayin, setNewPayin] = useState(false);
  const [newPayout, setNewPayout] = useState(false);
  const [newDefault, setNewDefault] = useState(false);
  const [adding, setAdding] = useState(false);

  const bootstrap = async () => {
    setBootLoading(true);
    setLoadError(null);
    try {
      const [mRes, pRes] = await Promise.all([fetchMerchants(), fetchProviders()]);
      setMerchants(mRes);
      setProviders(pRes);
    } catch (err: any) {
      setLoadError(err?.message ?? "Failed to load merchants or providers");
      toast({ title: "Load failed", description: errMsg(err) });
    } finally {
      setBootLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMerchant = useMemo(
    () => merchants.find((m) => m.id === selectedMerchantId) ?? null,
    [merchants, selectedMerchantId]
  );

  const loadMappings = async (merchantId: string) => {
    setMapLoading(true);
    try {
      const maps = await fetchMappingsForMerchant(merchantId);
      const byProvider: Record<number, Mapping> = {};
      maps.forEach((m) => (byProvider[m.provider_id] = m));
      // the single lowest-priority mapping is the merchant's default route
      const minPri = Math.min(...maps.map((m) => m.priority ?? NORMAL_PRIORITY));
      const defaults = maps.filter((m) => (m.priority ?? NORMAL_PRIORITY) === minPri);
      const defaultId = defaults.length === 1 ? defaults[0].provider_id : null;
      const next: Record<number, Draft> = {};
      providers.forEach((p) => {
        next[p.id] = draftFromMapping(byProvider[p.id] ?? null, p.id === defaultId);
      });
      setDrafts(next);
    } catch (err: any) {
      toast({ title: "Load failed", description: errMsg(err) });
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedMerchantId) {
      setDrafts({});
      return;
    }
    loadMappings(selectedMerchantId);
    setNewProv("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMerchantId, providers.length]);

  const filteredMerchants = useMemo(() => {
    const q = merchantSearch.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter((m) =>
      [m.username, m.email, m.company_name].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [merchants, merchantSearch]);

  const patchDraft = (providerId: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], ...patch, dirty: true } }));

  const setDefault = (providerId: number) =>
    setDrafts((d) => {
      const next = { ...d };
      Object.keys(next).forEach((k) => {
        const id = Number(k);
        const want = id === providerId;
        if (next[id].isDefault !== want && (next[id].existing || next[id].added)) {
          next[id] = { ...next[id], isDefault: want, dirty: true };
        }
      });
      return next;
    });

  /** Create / update / delete the mapping for one provider. Returns false on error. */
  async function saveProvider(providerId: number, override?: Draft): Promise<boolean> {
    const draft = override ?? drafts[providerId];
    if (!selectedMerchantId || !draft) return true;
    const dir = directionOf(draft);
    const priority = draft.isDefault
      ? DEFAULT_PRIORITY
      : draft.existing?.priority && draft.existing.priority !== DEFAULT_PRIORITY
        ? draft.existing.priority
        : NORMAL_PRIORITY;
    const body = {
      direction: dir as Direction,
      enabled: draft.enabled,
      priority,
      min_amount: draft.min_amount !== "" ? Number(draft.min_amount) : null,
      max_amount: draft.max_amount !== "" ? Number(draft.max_amount) : null,
      config: {
        payIn_mid: draft.payIn_mid || undefined,
        payOut_mid: draft.payOut_mid || undefined,
        is_active_payIn: !!draft.is_active_payIn,
        is_active_payOut: !!draft.is_active_payOut,
      },
    };

    setDrafts((d) => ({ ...d, [providerId]: { ...draft, saving: true, error: null } }));
    try {
      if (!draft.existing) {
        if (dir === null) {
          setDrafts((d) => ({ ...d, [providerId]: draftFromMapping(null, false) }));
          return true;
        }
        const created = await createMapping({ merchant_id: selectedMerchantId, provider_id: providerId, ...body });
        setDrafts((d) => ({ ...d, [providerId]: draftFromMapping(created, draft.isDefault) }));
      } else if (dir === null) {
        await deleteMapping(draft.existing.id);
        setDrafts((d) => ({ ...d, [providerId]: draftFromMapping(null, false) }));
      } else {
        const updated = await updateMapping(draft.existing.id, body);
        setDrafts((d) => ({ ...d, [providerId]: draftFromMapping(updated, draft.isDefault) }));
      }
      return true;
    } catch (err: any) {
      const msg = errMsg(err);
      setDrafts((d) => ({ ...d, [providerId]: { ...draft, saving: false, error: msg } }));
      toast({ title: "Save failed", description: msg });
      return false;
    }
  }

  const rows = providers
    .map((p, i) => ({ p, i, d: drafts[p.id] }))
    .filter((r) => r.d && (r.d.existing || r.d.added));
  const dirtyRows = rows.filter((r) => r.d.dirty);
  const unmapped = providers.filter((p) => drafts[p.id] && !drafts[p.id].existing && !drafts[p.id].added);
  const activeMappings = rows.filter((r) => r.d.existing && r.d.existing.enabled !== false).length;

  async function saveAll() {
    if (!selectedMerchantId || dirtyRows.length === 0) return;
    setSavingAll(true);
    let ok = 0;
    for (const r of dirtyRows) {
      // sequential keeps default-priority changes ordered
      if (await saveProvider(r.p.id)) ok += 1;
    }
    setSavingAll(false);
    if (ok === dirtyRows.length) toast({ title: "Mappings saved", description: `${ok} change${ok === 1 ? "" : "s"} saved.` });
  }

  async function removeMapping(providerId: number) {
    const d = drafts[providerId];
    if (!d) return;
    if (!d.existing) {
      setDrafts((all) => ({ ...all, [providerId]: draftFromMapping(null, false) }));
      return;
    }
    if (await saveProvider(providerId, { ...d, payin: false, payout: false })) {
      toast({ title: "Mapping removed" });
    }
  }

  async function addMapping() {
    const pid = Number(newProv);
    if (!pid || !(newPayin || newPayout)) return;
    setAdding(true);
    const draft: Draft = { ...draftFromMapping(null, newDefault), payin: newPayin, payout: newPayout, added: true, dirty: true };
    // demote the previous default first so only one provider carries the default priority
    if (newDefault) {
      for (const r of rows.filter((x) => x.d.isDefault && x.d.existing)) {
        await saveProvider(r.p.id, { ...r.d, isDefault: false });
      }
    }
    const ok = await saveProvider(pid, draft);
    setAdding(false);
    if (ok) {
      toast({ title: "Mapping added" });
      setNewProv("");
      setNewPayin(false);
      setNewPayout(false);
      setNewDefault(false);
    }
  }

  const clearSelection = () => {
    setSelectedMerchantId(null);
    setDrafts({});
  };

  const merchantsAdded = thisMonthCount(merchants);
  const providersAdded = thisMonthCount(providers);
  const configDraft = configId != null ? drafts[configId] : null;
  const configProvider = providers.find((p) => p.id === configId);
  const newProvider = providers.find((p) => String(p.id) === newProv);
  const allowPayin = (p?: Provider) => !p || p.default_direction !== "payout";
  const allowPayout = (p?: Provider) => !p || p.default_direction !== "payin";

  /* ---------- Render ---------- */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">TSP Provider Mapping</h1>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">Configure payment gateway mappings for merchants</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={clearSelection} disabled={!selectedMerchantId} className="h-11 rounded-xl px-4 text-indigo-600 dark:text-indigo-400">
            <RefreshCw /> Clear Selection
          </Button>
          <Button
            onClick={saveAll}
            disabled={!selectedMerchantId || savingAll || mapLoading || dirtyRows.length === 0}
            className="h-11 rounded-xl px-5 shadow-lg shadow-indigo-600/25"
          >
            {savingAll ? <Loader2 className="animate-spin" /> : <Save />}
            Save All Mappings{dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ""}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <TspStat
          label="Total Merchants"
          value={bootLoading ? "…" : merchants.length}
          icon={Users}
          tile="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          hint={merchantsAdded > 0 ? `+${merchantsAdded} this month` : "No new this month"}
          hintUp={merchantsAdded > 0}
          trend={cumulativeByWeek(merchants)}
          color="#3B6BF6"
        />
        <TspStat
          label="TSP Providers"
          value={bootLoading ? "…" : providers.length}
          icon={Network}
          tile="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          hint={providersAdded > 0 ? `+${providersAdded} this month` : "No new this month"}
          hintUp={providersAdded > 0}
          trend={cumulativeByWeek(providers)}
          color="#8B5CF6"
        />
        <TspStat
          label="Active Mappings"
          value={selectedMerchantId ? activeMappings : "—"}
          icon={Link2}
          tile="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          hint={!selectedMerchantId ? "Select a merchant" : dirtyRows.length ? `${dirtyRows.length} unsaved change${dirtyRows.length === 1 ? "" : "s"}` : "No changes"}
        />
        <TspStat
          label="Selected Merchant"
          value={selectedMerchant ? selectedMerchant.username : "None"}
          icon={UserRound}
          compact
          tile="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          hint={selectedMerchant ? selectedMerchant.company_name || selectedMerchant.email : "Select a merchant to configure"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,0.75fr)_2.25fr]">
        {/* Merchant picker */}
        <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Select Merchant</h2>
          <p className="mt-0.5 text-[14px] text-gray-500">Choose a merchant to configure TSP mappings</p>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search merchants..."
              value={merchantSearch}
              onChange={(e) => setMerchantSearch(e.target.value)}
              className="h-11 rounded-xl pl-10"
              aria-label="Search merchants"
            />
          </div>

          <div className="mt-4 max-h-[560px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800">
            {bootLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="mt-3 text-[13px] text-gray-500">Loading merchants...</p>
              </div>
            ) : loadError ? (
              <div className="p-5 text-center text-[13px] text-red-600">
                <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                {loadError}
                <div><Button variant="outline" size="sm" className="mt-3" onClick={bootstrap}>Retry</Button></div>
              </div>
            ) : filteredMerchants.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-gray-500">No merchants found</div>
            ) : (
              filteredMerchants.map((m, i) => {
                const active = selectedMerchantId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMerchantId(m.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 dark:border-gray-800 ${
                      active
                        ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300 dark:bg-indigo-950/40 dark:ring-indigo-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    }`}
                  >
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${avatarTone(i)}`}>
                      {m.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">{m.username}</span>
                      <span className="block truncate text-[13px] text-gray-500">{m.email || m.company_name}</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Configuration */}
        <div className="min-w-0 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">TSP Providers Configuration</h2>
              <p className="mt-0.5 text-[14px] text-gray-500">Configure payment gateway mappings for the selected merchant</p>
            </div>
            {selectedMerchant && (
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-slate-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[15px] font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                  {selectedMerchant.username.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-500">Selected Merchant</div>
                  <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{selectedMerchant.username}</div>
                  <div className="truncate text-[12px] text-gray-500">
                    {[selectedMerchant.email, selectedMerchant.company_name].filter(Boolean).join(" | ")}
                  </div>
                </div>
              </div>
            )}
          </div>

          {!selectedMerchantId ? (
            <div className="mt-5 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-800">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                <Link2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No Merchant Selected</h3>
              <p className="mt-1 text-[13px] text-gray-500">Select a merchant from the left panel to configure TSP mappings</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="mt-5 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-[13px] text-gray-500 dark:border-gray-800">
              No payment gateway providers are configured yet. Create one on the TSP Providers page.
            </div>
          ) : mapLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <>
              {/* Mapped providers */}
              <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr className="whitespace-nowrap bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/40">
                      <th className="px-4 py-3">TSP Provider</th>
                      <th className="px-3 py-3 text-center">Pay-in</th>
                      <th className="px-3 py-3 text-center">Pay-out</th>
                      <th className="px-3 py-3 text-center">Default</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                          No providers mapped to this merchant yet — add one below.
                        </td>
                      </tr>
                    ) : (
                      rows.map(({ p, i, d }) => {
                        const removing = !directionOf(d);
                        const on = d.enabled && !removing;
                        return (
                          <tr key={p.id} className={d.dirty ? "bg-amber-50/40 dark:bg-amber-950/10" : undefined}>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <ProviderIcon index={i} />
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</div>
                                  {p.code && <div className="mt-0.5"><ProviderCode index={i} code={p.code} /></div>}
                                  <div className="mt-0.5 max-w-[240px] truncate text-[12px] text-gray-500" title={p.description ?? undefined}>
                                    {d.error ? <span className="text-red-600">{d.error}</span> : removing ? <span className="text-amber-600">Will be removed on save</span> : p.description}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-4 text-center">
                              <Switch
                                checked={d.payin}
                                disabled={!allowPayin(p) && !d.payin}
                                onCheckedChange={(v) => patchDraft(p.id, { payin: v })}
                                aria-label={`Pay-in for ${p.name}`}
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              <Switch
                                checked={d.payout}
                                disabled={!allowPayout(p) && !d.payout}
                                onCheckedChange={(v) => patchDraft(p.id, { payout: v })}
                                aria-label={`Pay-out for ${p.name}`}
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              <input
                                type="radio"
                                name="tsp-default"
                                checked={d.isDefault}
                                onChange={() => setDefault(p.id)}
                                className="h-5 w-5 cursor-pointer accent-indigo-600"
                                aria-label={`Make ${p.name} the default provider`}
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              {d.saving ? (
                                <Loader2 className="mx-auto h-4 w-4 animate-spin text-indigo-600" />
                              ) : on ? (
                                <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
                                  <Check className="h-3.5 w-3.5" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                                  <Clock className="h-3.5 w-3.5" /> Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end">
                                <ActionMenu
                                  label={`Actions for ${p.name}`}
                                  items={[
                                    { label: "Configure MIDs & limits", icon: Settings2, onClick: () => setConfigId(p.id) },
                                    { label: d.enabled ? "Disable mapping" : "Enable mapping", icon: Power, onClick: () => patchDraft(p.id, { enabled: !d.enabled }) },
                                    { label: "Save this mapping", icon: Save, disabled: !d.dirty, onClick: () => saveProvider(p.id) },
                                    { label: "Remove mapping", icon: Trash2, destructive: true, onClick: () => removeMapping(p.id) },
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

              {/* Add new mapping */}
              <div className="mt-5 rounded-xl border-2 border-dashed border-gray-200 p-5 dark:border-gray-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">Add New Mapping</h3>
                    <p className="text-[13px] text-gray-500">Configure a new TSP mapping for this merchant</p>
                  </div>
                  <Button
                    onClick={addMapping}
                    disabled={!newProv || !(newPayin || newPayout) || adding}
                    className="h-10 rounded-xl px-5"
                  >
                    {adding ? <Loader2 className="animate-spin" /> : <Plus />} Add Mapping
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-50/70 px-4 py-2.5 text-[13px] text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
                  <Info className="h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                  {unmapped.length === 0
                    ? "Every provider is already mapped to this merchant."
                    : "Select a TSP provider and turn on pay-in and/or pay-out. Merchant IDs and limits can be set afterwards from the row menu."}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:items-end">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                      TSP Provider <span className="text-red-500">*</span>
                    </span>
                    <Select
                      value={newProv}
                      onValueChange={(v) => {
                        const p = providers.find((x) => String(x.id) === v);
                        setNewProv(v);
                        setNewPayin(allowPayin(p) && newPayin);
                        setNewPayout(allowPayout(p) && newPayout);
                      }}
                      disabled={unmapped.length === 0}
                    >
                      <SelectTrigger className="h-11 rounded-xl" aria-label="TSP provider">
                        <SelectValue placeholder="Select TSP provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {unmapped.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}{p.code ? ` (${p.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div>
                    <span className="mb-2.5 block text-[13px] text-gray-600 dark:text-gray-400">Pay-in Enabled</span>
                    <Switch checked={newPayin} disabled={!allowPayin(newProvider)} onCheckedChange={setNewPayin} aria-label="Pay-in enabled" />
                  </div>
                  <div>
                    <span className="mb-2.5 block text-[13px] text-gray-600 dark:text-gray-400">Pay-out Enabled</span>
                    <Switch checked={newPayout} disabled={!allowPayout(newProvider)} onCheckedChange={setNewPayout} aria-label="Pay-out enabled" />
                  </div>
                  <label className="block">
                    <span className="mb-2.5 block text-[13px] text-gray-600 dark:text-gray-400">Set as Default</span>
                    <input type="checkbox" checked={newDefault} onChange={(e) => setNewDefault(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Configure MIDs & limits */}
      <Dialog open={configId != null} onOpenChange={(o) => !o && setConfigId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure {configProvider?.name}</DialogTitle>
            <DialogDescription>Merchant IDs and amount limits for {selectedMerchant?.username}. Changes save with “Save All Mappings”.</DialogDescription>
          </DialogHeader>
          {configDraft && configId != null && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Pay-in</span>
                  <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400">
                    Service enabled
                    <Switch checked={configDraft.is_active_payIn} onCheckedChange={(v) => patchDraft(configId, { is_active_payIn: v })} />
                  </label>
                </div>
                <Input placeholder="Pay-in Merchant ID" value={configDraft.payIn_mid} onChange={(e) => patchDraft(configId, { payIn_mid: e.target.value })} />
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Pay-out</span>
                  <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400">
                    Service enabled
                    <Switch checked={configDraft.is_active_payOut} onCheckedChange={(v) => patchDraft(configId, { is_active_payOut: v })} />
                  </label>
                </div>
                <Input placeholder="Pay-out Merchant ID" value={configDraft.payOut_mid} onChange={(e) => patchDraft(configId, { payOut_mid: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Min Amount</span>
                  <Input type="number" value={configDraft.min_amount} onChange={(e) => patchDraft(configId, { min_amount: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">Max Amount</span>
                  <Input type="number" value={configDraft.max_amount} onChange={(e) => patchDraft(configId, { max_amount: e.target.value })} />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfigId(null)}>Done</Button>
                <Button
                  onClick={async () => {
                    if (await saveProvider(configId)) {
                      toast({ title: "Saved", description: `${configProvider?.name} mapping saved.` });
                      setConfigId(null);
                    }
                  }}
                  disabled={!configDraft.dirty || configDraft.saving}
                >
                  {configDraft.saving ? <Loader2 className="animate-spin" /> : <Save />} Save now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
