// Partner details → Merchants mapped under this partner
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarPlus, Clock, Download, Eye, Loader2, MoreVertical, Plus, Search, Store, Unlink, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import Pager from "@/components/admin-part/Pager";
import { EmptyState } from "@/components/admin-part/ui";
import { fetchUsersWithWallets, type UserWithWallets } from "@/api/apiHelper";
import { fetchPartnerMerchants, mapMerchantToPartner, unmapMerchantFromPartner, type Partner, type PartnerMerchant } from "@/api/partners";
import { mdCard, outlineBtn } from "@/components/txn/merchantDetails/mdStyles";

const violetBtn = "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-700 disabled:opacity-60";
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const nameOf = (m: { full_name?: string | null; company_name?: string | null; username: string }) => m.full_name || m.company_name || m.username;

function AddMerchantDialog({ partner, open, onClose, mappedIds, onMapped }: { partner: Partner; open: boolean; onClose: () => void; mappedIds: Set<string>; onMapped: (m: PartnerMerchant) => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserWithWallets[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetchUsersWithWallets({ search: q.trim() || undefined, per_page: 10, page: 1 })
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const map = async (u: UserWithWallets) => {
    setBusy(u.id);
    try {
      onMapped(await mapMerchantToPartner(partner.id, u.id));
      toast({ title: "Merchant mapped", description: `${nameOf(u)} is now under ${partner.full_name || partner.username}` });
    } catch (e) {
      toast({ title: "Could not map merchant", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add merchant to {partner.full_name || partner.username}</DialogTitle>
          <DialogDescription>Search existing merchants and map them under this partner. A merchant can belong to one partner.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone or merchant ID…" className={cn(filterInputCls, "pl-9")} />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {results === null ? (
            <div className="flex items-center gap-2 p-3 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
          ) : results.length === 0 ? (
            <p className="p-3 text-[13px] text-gray-500">No merchants found.</p>
          ) : (
            results.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-gray-200/80 px-3 py-2.5 dark:border-gray-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-[13px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{nameOf(u).charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{nameOf(u)}</div>
                  <div className="truncate text-[12px] text-gray-500">{u.id} · {u.email}</div>
                </div>
                {mappedIds.has(u.id) ? (
                  <span className="text-[12px] font-medium text-green-600">Mapped</span>
                ) : (
                  <button type="button" disabled={busy === u.id} onClick={() => map(u)} className={cn(violetBtn, "px-3 py-1.5 text-[13px]")}>
                    {busy === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Map
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PartnerMerchantsTab({ partner }: { partner: Partner }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PartnerMerchant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kyc, setKyc] = useState<"all" | "verified" | "pending">("all");
  const [perPage, setPerPage] = useState(12);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [unmapping, setUnmapping] = useState<PartnerMerchant | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchPartnerMerchants(partner.id)
      .then(setRows)
      .catch((e) => setError(errorText(e, "Failed to load merchants")));
  }, [partner.id]);
  useEffect(load, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((m) => (kyc === "all" || (kyc === "verified") === m.kyc_verified) && (!s || [m.full_name, m.username, m.email, m.phone_number, m.company_name, m.id].some((v) => (v ?? "").toLowerCase().includes(s))));
  }, [all, search, kyc]);
  const shown = filtered.slice((page - 1) * perPage, page * perPage);
  const verified = all.filter((m) => m.kyc_verified).length;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const newThisMonth = all.filter((m) => m.mapped_at && new Date(m.mapped_at).getTime() >= monthStart).length;

  const exportCsv = () => {
    const head = ["Merchant ID", "Name", "Username", "Email", "Phone", "Company", "KYC", "Joined", "Mapped On"];
    const lines = filtered.map((m) => [m.id, m.full_name, m.username, m.email, m.phone_number, m.company_name, m.kyc_verified ? "Approved" : "Pending", m.created_at, m.mapped_at].map(csvCell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `partner-${partner.id}-merchants.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const unmap = async () => {
    if (!unmapping) return;
    setBusy(true);
    try {
      await unmapMerchantFromPartner(partner.id, unmapping.id);
      setRows((r) => (r ?? []).filter((x) => x.id !== unmapping.id));
      toast({ title: "Merchant unmapped", description: nameOf(unmapping) });
      setUnmapping(null);
    } catch (e) {
      toast({ title: "Unmap failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    { label: "Total Merchants", value: all.length, icon: Store, corner: Users, box: "border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20", tile: "bg-blue-100 text-blue-600 dark:bg-blue-900/40", c: "text-blue-600" },
    { label: "KYC Approved", value: verified, icon: BadgeCheck, corner: BadgeCheck, box: "border-green-100 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20", tile: "bg-green-100 text-green-600 dark:bg-green-900/40", c: "text-green-600" },
    { label: "KYC Pending", value: all.length - verified, icon: Clock, corner: Clock, box: "border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20", tile: "bg-violet-100 text-violet-600 dark:bg-violet-900/40", c: "text-violet-600" },
    { label: "Added This Month", value: newThisMonth, icon: CalendarPlus, corner: CalendarPlus, box: "border-amber-100 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20", tile: "bg-amber-100 text-amber-500 dark:bg-amber-900/40", c: "text-amber-500" },
  ];

  return (
    <div className="space-y-4">
      <div className={cn(mdCard, "p-5")}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Store className="h-6 w-6" /></span>
          <div>
            <h3 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Merchants</h3>
            <p className="text-[13px] text-gray-500">All merchants mapped under this partner</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={cn("relative flex items-center gap-4 rounded-2xl border p-4", s.box)}>
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-xl", s.tile)}><s.icon className="h-7 w-7" /></span>
              <div>
                <div className="text-[26px] font-bold text-gray-900 dark:text-gray-100">{rows ? s.value : "…"}</div>
                <div className="text-[13px] text-gray-600 dark:text-gray-400">{s.label}</div>
              </div>
              <s.corner className={cn("absolute right-4 top-4 h-5 w-5 opacity-70", s.c)} />
            </div>
          ))}
        </div>
      </div>

      <div className={cn(mdCard, "overflow-hidden")}>
        <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search merchants by name, email, phone, or company…" className={cn(filterInputCls, "h-12 pl-11 text-[14px]")} />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={kyc} onChange={(e) => { setKyc(e.target.value as typeof kyc); setPage(1); }} className={cn(filterInputCls, "h-12 w-auto text-[14px]")}>
              <option value="all">All KYC</option>
              <option value="verified">KYC Approved</option>
              <option value="pending">KYC Pending</option>
            </select>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className={cn(filterInputCls, "h-12 w-auto text-[14px]")}>
              {[12, 24, 48].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <button type="button" onClick={exportCsv} disabled={!filtered.length} className={cn(outlineBtn, "h-12")}><Download className="h-4 w-4" /> Export</button>
            <button type="button" onClick={() => setAdding(true)} className={cn(violetBtn, "h-12")}><Plus className="h-5 w-5" /> Add Merchant</button>
          </div>
        </div>

        {error ? (
          <p className="p-5 text-[13px] text-red-600">{error}</p>
        ) : !rows ? (
          <div className="flex items-center gap-2 p-5 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState icon={Store} title={all.length ? "No merchants match" : "No merchants mapped yet"} description={all.length ? "Try a different search or filter." : "Click Add Merchant to map a merchant under this partner."} /></div>
        ) : (
          <>
            <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                  <tr className="text-left text-[13px] font-semibold text-gray-700 dark:text-gray-300 [&>th]:px-4 [&>th]:py-3.5">
                    <th>#</th><th>Merchant</th><th>Contact</th><th>Company</th><th>KYC Status</th><th>Joined</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800 [&>tr>td]:px-4 [&>tr>td]:py-3.5">
                  {shown.map((m, i) => (
                    <tr key={m.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                      <td className="text-gray-500">{(page - 1) * perPage + i + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{nameOf(m).charAt(0).toUpperCase()}</span>
                          <div><div className="font-medium text-gray-900 dark:text-gray-100">{nameOf(m)}</div><div className="text-[12px] text-gray-500">{m.username}</div></div>
                        </div>
                      </td>
                      <td><div className="text-gray-900 dark:text-gray-100">{m.email}</div><div className="text-[12px] text-gray-500">{m.phone_number || "—"}</div></td>
                      <td className="text-gray-800 dark:text-gray-200">{m.company_name || "—"}</td>
                      <td>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium", m.kyc_verified ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-400" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400")}>
                          {m.kyc_verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />} {m.kyc_verified ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td><div className="text-gray-900 dark:text-gray-100">{fmtDate(m.created_at)}</div><div className="text-[11px] text-gray-500">mapped {fmtDate(m.mapped_at)}</div></td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => navigate(`/admin/merchants/${encodeURIComponent(m.id)}/overview`)} className={cn(outlineBtn, "whitespace-nowrap px-3 py-2")}><Eye className="h-4 w-4" /> View Profile</button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`More actions for ${m.username}`} className={cn(outlineBtn, "px-2.5 py-2")}><MoreVertical className="h-4 w-4" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setUnmapping(m)} className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/40"><Unlink /> Unmap from partner</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} perPage={perPage} total={filtered.length} noun="merchants" onPage={setPage} />
          </>
        )}
      </div>

      <AddMerchantDialog partner={partner} open={adding} onClose={() => setAdding(false)} mappedIds={new Set(all.map((m) => m.id))} onMapped={(m) => setRows((r) => [m, ...(r ?? [])])} />

      <Dialog open={!!unmapping} onOpenChange={(o) => !o && setUnmapping(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unmap merchant?</DialogTitle>
            <DialogDescription>{unmapping && `${nameOf(unmapping)} (${unmapping.id}) will no longer be under this partner. The merchant account itself is not changed.`}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setUnmapping(null)} className={outlineBtn}>Cancel</button>
            <button type="button" onClick={unmap} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Unmap
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
