// Replace src/pages/admin/TspMappingPage.tsx with this version
import React, { useEffect, useMemo, useState } from "react";
import api from "@/api/api";
import { API_ORIGIN, BASE_URL } from "@/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

/* types (kept similar to your original file) */
type MerchantShort = { id: string; username: string; email?: string; company_name?: string | null; };
type Provider = {
  id: number;
  code?: string;
  name: string;
  description?: string | null;
  default_direction?: "payin" | "payout" | "both" | null;
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

/* ----------------- component ----------------- */
export default function TspMappingPage(): JSX.Element {
  const { toast } = useToast();

  const [merchants, setMerchants] = useState<MerchantShort[]>([]);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantShort | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  /**
   * drafts keyed by provider_id.
   * draft shape:
   * { payin: boolean, payout: boolean, payIn_mid?: string, payOut_mid?: string,
   *   is_active_payIn?: boolean, is_active_payOut?: boolean, existing?: Mapping | null, saving?: boolean, error?: string }
   */
  const [drafts, setDrafts] = useState<Record<number, any>>({});

  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async function bootstrap() {
      setLoading(true);
      setInitialLoadError(null);
      try {
        const [mRes, pRes] = await Promise.all([fetchMerchants(), fetchProviders()]);
        setMerchants(mRes);
        setProviders(pRes);
      } catch (err: any) {
        setInitialLoadError(err?.message ?? "Failed to load merchants or providers");
        toast({ title: "Load failed", description: String(err?.message ?? err) });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedMerchantId) {
      const merchant = merchants.find(m => m.id === selectedMerchantId);
      setSelectedMerchant(merchant || null);
    } else {
      setSelectedMerchant(null);
    }
  }, [selectedMerchantId, merchants]);

  useEffect(() => {
    if (!selectedMerchantId) { setMappings([]); setDrafts({}); return; }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setInitialLoadError(null);
      try {
        const maps = await fetchMappingsForMerchant(selectedMerchantId);
        if (cancelled) return;
        setMappings(maps);
        const mapByProvider: Record<number, Mapping> = {};
        maps.forEach((m) => (mapByProvider[m.provider_id] = m));
        const initialDrafts: Record<number, any> = {};
        providers.forEach((p) => {
          const existing = mapByProvider[p.id] ?? null;
          const payin = existing ? (existing.direction === "payin" || existing.direction === "both") : false;
          const payout = existing ? (existing.direction === "payout" || existing.direction === "both") : false;
          const paying_min_amount = existing && (existing.min_amount != null) ? existing.min_amount : "";
          const paying_max_amount = existing && (existing.max_amount != null) ? existing.max_amount : "";
          const payout_min_amount = existing && (existing.min_amount != null) ? existing.min_amount : "";
          const payout_max_amount = existing && (existing.max_amount != null) ? existing.max_amount : "";
          // Prefill credential fields from existing.config if present
          const cfg = existing?.config ?? {};
          initialDrafts[p.id] = {
            payin,
            payout,
            min_amount: paying_min_amount,
            max_amount: paying_max_amount,
            payout_min_amount: payout_min_amount,
            payout_max_amount: payout_max_amount,
            payIn_mid: cfg?.payIn_mid ?? "",
            payOut_mid: cfg?.payOut_mid ?? "",
            is_active_payIn: cfg?.is_active_payIn ?? !!(cfg?.payIn_mid),
            is_active_payOut: cfg?.is_active_payOut ?? !!(cfg?.payOut_mid),
            existing,
          };
        });
        setDrafts(initialDrafts);
      } catch (err: any) {
        setInitialLoadError(err?.message ?? "Failed to load mappings");
        toast({ title: "Load failed", description: String(err?.message ?? err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMerchantId, providers.length]);

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch) return merchants;
    return merchants.filter((m) =>
      (m.username ?? "").toLowerCase().includes(merchantSearch.toLowerCase()) ||
      (m.email ?? "").toLowerCase().includes(merchantSearch.toLowerCase()) ||
      (m.company_name ?? "").toLowerCase().includes(merchantSearch.toLowerCase())
    );
  }, [merchants, merchantSearch]);

  function setDraftForProvider(providerId: number, patch: Partial<any>) {
    setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], ...patch } }));
  }

  function computeDirectionFromDraft(d: { payin: boolean; payout: boolean }) {
    if (d.payin && d.payout) return "both";
    if (d.payin) return "payin";
    if (d.payout) return "payout";
    return null;
  }

  /* Save single provider mapping.
     NOTE: we include credential fields in `config` so backend can create ProviderCredential later:
     config: { payIn_mid, payOut_mid, is_active_payIn, is_active_payOut }
  */
  async function saveProvider(providerId: number) {
    const draft = drafts[providerId];
    if (!selectedMerchantId || !draft) return;
    const dir = computeDirectionFromDraft(draft);

    setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], saving: true, error: null } }));
    try {
      if (!draft.existing) {
        if (dir === null) {
          // nothing to create
        } else {
          const payload: MappingCreatePayload = {
            merchant_id: selectedMerchantId,
            provider_id: providerId,
            direction: dir as Direction,
            enabled: true,
            priority: 100,
            min_amount: draft.min_amount ? Number(draft.min_amount) : null,
            max_amount: draft.max_amount ? Number(draft.max_amount) : null,
            config: {
              payIn_mid: draft.payIn_mid ?? undefined,
              payOut_mid: draft.payOut_mid ?? undefined,
              is_active_payIn: !!draft.is_active_payIn,
              is_active_payOut: !!draft.is_active_payOut,
            },
          };
          const created = await createMapping(payload);
          setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], existing: created, saving: false } }));
          setMappings((m) => [...m, created]);
        }
      } else {
        if (dir === null) {
          // delete mapping
          await deleteMapping(draft.existing.id);
          setDrafts((d) => ({ ...d, [providerId]: { payin: false, payout: false, existing: undefined, saving: false } }));
          setMappings((m) => m.filter((x) => x.id !== draft.existing!.id));
        } else {
          // update mapping direction/config if changed
          const updatePayload: MappingUpdatePayload = {
            direction: dir as Direction,
            min_amount: draft.min_amount ? Number(draft.min_amount) : null,
            max_amount: draft.max_amount ? Number(draft.max_amount) : null,
            enabled: true,
            priority: draft.existing.priority ?? 100,
            config: {
              payIn_mid: draft.payIn_mid ?? undefined,
              payOut_mid: draft.payOut_mid ?? undefined,
              is_active_payIn: !!draft.is_active_payIn,
              is_active_payOut: !!draft.is_active_payOut,
            },
          };
          // only send direction if changed to avoid no-op PUT
          if (dir !== draft.existing.direction || JSON.stringify(draft.existing.config ?? {}) !== JSON.stringify(updatePayload.config)) {
            const updated = await updateMapping(draft.existing.id, updatePayload);
            setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], existing: updated, saving: false } }));
            setMappings((m) => m.map((mm) => (mm.id === updated.id ? updated : mm)));
          } else {
            setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], saving: false } }));
          }
        }
      }
      toast({ title: "Saved", description: `Saved mapping for provider ${providerId}` });
    } catch (err: any) {
      const msg = err?.message ?? "Save failed";
      setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], saving: false, error: String(msg) } }));
      toast({ title: "Save failed", description: String(msg) });
    }
  }

  async function saveAll() {
    if (!selectedMerchantId) return;
    setSavingAll(true);
    try {
      for (const p of providers) {
        // eslint-disable-next-line no-await-in-loop
        await saveProvider(p.id);
      }
      toast({ title: "All saved", description: "All TSP mappings saved." });
    } catch (err: any) {
      toast({ title: "Save all failed", description: String(err?.message ?? err) });
    } finally {
      setSavingAll(false);
    }
  }

  /* ---------- Render ---------- */
  return (
    <div className="space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">TSP Provider Mapping</h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Configure payment gateway mappings for merchants</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { setSelectedMerchantId(null); setDrafts({}); setMappings([]); }}
              variant="outline"
              className="rounded-lg border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Clear Selection
            </Button>
            <Button
              onClick={saveAll}
              disabled={!selectedMerchantId || savingAll || loading}
              className="h-8"
            >
              {savingAll ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving All...
                </>
              ) : 'Save All Mappings'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Total Merchants</p>
                  <p className="text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                    {loading ? '...' : merchants.length}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">TSP Providers</p>
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
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Active Mappings</p>
                  <p className="text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                    {loading ? '...' : mappings.length}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Selected Merchant</p>
                  <p className="text-xl sm:text-2xl xl:text-[28px] font-bold leading-tight mt-1 tabular-nums text-gray-900 dark:text-gray-100 truncate">
                    {selectedMerchant ? selectedMerchant.username : 'None'}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Merchant to TSP Mapping</CardTitle>
                <div className="text-gray-600 text-sm">Select a merchant and configure their payment gateway mappings</div>
              </div>
              
              {selectedMerchant && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {selectedMerchant.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{selectedMerchant.username}</div>
                    <div className="text-sm text-gray-600">{selectedMerchant.email || selectedMerchant.company_name}</div>
                  </div>
                  <Badge className="ml-2 bg-blue-100 text-blue-800">
                    Active
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Left Column - Merchant Selection */}
              <div className="lg:col-span-1 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select Merchant</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <Input 
                      placeholder="Search merchants..." 
                      value={merchantSearch} 
                      onChange={(e) => setMerchantSearch(e.target.value)} 
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Merchants</span>
                      <span className="text-xs text-gray-500">{filteredMerchants.length} found</span>
                    </div>
                  </div>
                  
                  <div className="max-h-[50vh] overflow-y-auto">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600"></div>
                        <p className="mt-3 text-gray-600">Loading merchants...</p>
                      </div>
                    ) : initialLoadError ? (
                      <div className="p-4 text-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 mb-2">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-red-600 text-sm">{initialLoadError}</div>
                      </div>
                    ) : filteredMerchants.length === 0 ? (
                      <div className="p-8 text-center">
                        <svg className="w-12 h-8 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-gray-600 font-medium">No merchants found</p>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your search</p>
                      </div>
                    ) : (
                      filteredMerchants.map((m) => (
                        <button 
                          key={m.id} 
                          onClick={() => setSelectedMerchantId(m.id)} 
                          className={`w-full text-left p-3 border-b border-gray-200 dark:border-gray-800 last:border-b-0 transition-colors ${selectedMerchantId === m.id ? "bg-blue-50" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedMerchantId === m.id ? "bg-blue-100" : "bg-gray-100"}`}>
                              <span className={`text-sm font-medium ${selectedMerchantId === m.id ? "text-blue-700" : "text-gray-600"}`}>
                                {m.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{m.username}</div>
                              <div className="text-xs text-gray-500 truncate">{m.email || m.company_name}</div>
                            </div>
                            {selectedMerchantId === m.id && (
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Provider Mappings */}
              <div className="lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">TSP Providers Configuration</h3>
                    <div className="text-sm text-gray-600">
                      {selectedMerchant ? (
                        <span>Configure mappings for <span className="font-semibold">{selectedMerchant.username}</span></span>
                      ) : (
                        "Select a merchant to configure mappings"
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => { setSelectedMerchantId(null); setDrafts({}); setMappings([]); }}
                      variant="outline"
                      className="rounded-lg border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {!selectedMerchantId ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-900">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">No Merchant Selected</h3>
                    <p className="text-gray-600 mb-4">Select a merchant from the left panel to configure TSP mappings</p>
                    <Button 
                      variant="outline" 
                      className="rounded-lg border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      disabled={filteredMerchants.length === 0}
                      onClick={() => filteredMerchants.length > 0 && setSelectedMerchantId(filteredMerchants[0].id)}
                    >
                      Select First Merchant
                    </Button>
                  </div>
                ) : providers.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-900">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">No TSP Providers Available</h3>
                    <p className="text-gray-600">No payment gateway providers are configured in the system</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {providers.map((p) => {
                      const d = drafts[p.id] ?? {};
                      const existing = d?.existing ?? null;
                      const payin = d?.payin ?? false;
                      const payout = d?.payout ?? false;
                      const saving = d?.saving ?? false;
                      const error = d?.error ?? null;

                      // Determine which direction controls to show based on provider.default_direction
                      const showPayin = (p.default_direction === "payin" || p.default_direction === "both" || p.default_direction == null);
                      const showPayout = (p.default_direction === "payout" || p.default_direction === "both" || p.default_direction == null);

                      const directionBadge = existing?.direction ? (
                        <Badge className={`ml-2 ${
                          existing.direction === 'payin' ? 'bg-blue-100 text-blue-800' :
                          existing.direction === 'payout' ? 'bg-orange-100 text-orange-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {existing.direction}
                        </Badge>
                      ) : null;

                      return (
                        <div key={p.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            {/* Provider Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</h4>
                                    {directionBadge}
                                    {existing && (
                                      <Badge variant="outline" className="text-gray-600 border-gray-300">
                                        Mapped
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600">{p.description}</div>
                                  <div className="text-xs text-gray-500 mt-1">Code: {p.code ?? p.id} • Default: {p.default_direction ?? "—"}</div>
                                </div>
                              </div>
                            </div>

                            {/* Configuration Controls */}
                            <div className="flex flex-col gap-4 min-w-[300px]">
                              <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                                {/* Pay-In Section */}
                                {showPayin && (
                                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                                    <div className="flex items-center justify-between mb-3">
                                      <label className="flex items-center gap-2 font-medium text-sm">
                                        <input 
                                          type="checkbox" 
                                          checked={payin} 
                                          onChange={(e) => setDraftForProvider(p.id, { payin: e.target.checked })}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <span className="text-gray-700 dark:text-gray-300">Pay-In</span>
                                      </label>
                                      {payin && (
                                        <Badge className="bg-green-100 text-green-800 text-xs">
                                          Active
                                        </Badge>
                                      )}
                                    </div>

                                    {payin && (
                                      <div className="space-y-3">
                                        <Input 
                                          placeholder="Pay-In Merchant ID" 
                                          value={d.payIn_mid ?? ""} 
                                          onChange={(e) => setDraftForProvider(p.id, { payIn_mid: e.target.value })}
                                          
                                        />
                                        <label className="flex items-center gap-2 text-xs text-gray-600">
                                          <input 
                                            type="checkbox" 
                                            checked={!!d.is_active_payIn} 
                                            onChange={(e) => setDraftForProvider(p.id, { is_active_payIn: e.target.checked })}
                                            className="h-3 w-3 rounded"
                                          />
                                          Enable Pay-In service
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Pay-Out Section */}
                                {showPayout && (
                                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                                    <div className="flex items-center justify-between mb-3">
                                      <label className="flex items-center gap-2 font-medium text-sm">
                                        <input 
                                          type="checkbox" 
                                          checked={payout} 
                                          onChange={(e) => setDraftForProvider(p.id, { payout: e.target.checked })}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <span className="text-gray-700 dark:text-gray-300">Pay-Out</span>
                                      </label>
                                      {payout && (
                                        <Badge className="bg-green-100 text-green-800 text-xs">
                                          Active
                                        </Badge>
                                      )}
                                    </div>

                                    {payout && (
                                      <div className="space-y-3">
                                        <Input 
                                          placeholder="Pay-Out Merchant ID" 
                                          value={d.payOut_mid ?? ""} 
                                          onChange={(e) => setDraftForProvider(p.id, { payOut_mid: e.target.value })}
                                          
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                          <Input
                                            type="number"
                                            placeholder="Min Amount"
                                            value={d.min_amount ?? ""}
                                            onChange={(e) => setDraftForProvider(p.id, { min_amount: e.target.value })}
                                            
                                          />
                                          <Input
                                            type="number"
                                            placeholder="Max Amount"
                                            value={d.max_amount ?? ""}
                                            onChange={(e) => setDraftForProvider(p.id, { max_amount: e.target.value })}
                                            
                                          />
                                        </div>
                                        <label className="flex items-center gap-2 text-xs text-gray-600">
                                          <input 
                                            type="checkbox" 
                                            checked={!!d.is_active_payOut} 
                                            onChange={(e) => setDraftForProvider(p.id, { is_active_payOut: e.target.checked })}
                                            className="h-3 w-3 rounded"
                                          />
                                          Enable Pay-Out service
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Save Button and Status */}
                              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
                                {error && (
                                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                                    <div className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {error}
                                    </div>
                                  </div>
                                )}
                                <Button 
                                  onClick={() => saveProvider(p.id)} 
                                  disabled={saving}
                                  size="sm"
                                  className="rounded-lg ml-auto"
                                >
                                  {saving ? (
                                    <>
                                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Saving
                                    </>
                                  ) : 'Save Changes'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}