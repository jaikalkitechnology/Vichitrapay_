// Partner panel → Merchants: merchants under this partner + onboarding
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import Pager from "@/components/admin-part/Pager";
import { fetchMyMerchants, onboardMerchant, type OnboardForm } from "@/api/partnerPanel";
import type { PartnerMerchant } from "@/api/partners";
import { GradientStat } from "@/components/admin-part/partnerDetails/partnerBits";
import { pCard, pOutline, pPrimary } from "@/components/admin-part/partnerDetails/partnerTabs";

const PER_PAGE = 12;
const nameOf = (m: PartnerMerchant) => m.full_name || m.company_name || m.username;
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const EMPTY: OnboardForm = { full_name: "", username: "", email: "", phone_number: "", company_name: "", password: "" };

function OnboardDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (m: PartnerMerchant) => void }) {
  const [f, setF] = useState<OnboardForm>(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phone = f.phone_number.replace(/\s/g, "");
    if (!f.full_name.trim() || !f.username.trim() || !f.email.trim() || !phone || !f.password) return setError("Fill in every required field");
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(f.username)) return setError("Username: 3–30 letters, numbers, dot, dash or underscore");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return setError("Enter a valid email address");
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Enter a valid 10-digit mobile number");
    if (f.password.length < 8) return setError("Password must be at least 8 characters");
    setBusy(true);
    try {
      onDone(await onboardMerchant({ ...f, phone_number: phone, full_name: f.full_name.trim(), username: f.username.trim(), email: f.email.trim() }));
      setF(EMPTY);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof OnboardForm, label: string, placeholder: string, required = true, type = "text") => (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-gray-800 dark:text-gray-200">{label} {required && <span className="text-red-500">*</span>}</span>
      <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} className={cn(filterInputCls, "h-11")} />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Onboard Merchant</DialogTitle>
          <DialogDescription>Create a merchant account under your partnership. The merchant can log in with these details and complete KYC.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("full_name", "Full Name", "Merchant or business name")}
            {field("username", "Username", "e.g. quickmart")}
          </div>
          {field("email", "Email", "merchant@example.com", true, "email")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("phone_number", "Mobile Number", "9876543210")}
            {field("company_name", "Company", "Optional", false)}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-gray-800 dark:text-gray-200">Password <span className="text-red-500">*</span></span>
            <div className="relative">
              <input type={show ? "text" : "password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" placeholder="At least 8 characters" className={cn(filterInputCls, "h-11 pr-11")} />
              <button type="button" onClick={() => setShow(!show)} tabIndex={-1} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={pOutline}>Cancel</button>
            <button type="submit" disabled={busy} className={pPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Onboard Merchant</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PanelMerchants() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PartnerMerchant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [onboarding, setOnboarding] = useState(false);
  const [viewing, setViewing] = useState<PartnerMerchant | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchMyMerchants()
      .then(setRows)
      .catch((e) => setError(errorText(e, "Failed to load merchants")));
  }, []);
  useEffect(load, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? all.filter((m) => [m.full_name, m.username, m.email, m.id, m.company_name, m.phone_number].some((v) => (v ?? "").toLowerCase().includes(q))) : all;
  }, [all, search]);
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const verified = all.filter((m) => m.kyc_verified).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-gray-900 dark:text-gray-100">Merchants</h1>
          <p className="text-[15px] text-gray-600 dark:text-gray-400">Manage and onboard merchants under your partnership</p>
        </div>
        <button type="button" onClick={() => setOnboarding(true)} className={cn(pPrimary, "h-12 px-6 text-[15px]")}><Plus className="h-5 w-5" /> Onboard Merchant</button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GradientStat tone="violet" icon={Users} label="Total Merchants" value={rows ? all.length : "…"} />
        <GradientStat tone="green" icon={ShieldCheck} label="KYC Approved" value={rows ? verified : "…"} />
        <GradientStat tone="orange" icon={Clock} label="Pending KYC" value={rows ? all.length - verified : "…"} />
      </div>

      <div className={cn(pCard, "flex gap-3 p-3")}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, username, or ID…" className={cn(filterInputCls, "h-12 pl-12 text-[14px]")} />
        </div>
        <button type="button" onClick={load} className={cn(pOutline, "h-12")}><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <div className={cn(pCard, "overflow-hidden")}>
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Merchant List</h2>
          <span className="rounded-full bg-violet-600 px-3 py-1 text-[12px] font-semibold text-white">{filtered.length} merchant{filtered.length === 1 ? "" : "s"}</span>
        </div>
        {error ? (
          <p className="border-t border-gray-100 p-6 text-[14px] text-red-600 dark:border-gray-800">{error}</p>
        ) : (
          <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
            <table className="w-full min-w-[860px]">
              <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                <tr className="text-left text-[13px] font-semibold text-gray-700 dark:text-gray-300 [&>th]:px-5 [&>th]:py-3.5">
                  <th>#</th><th>Merchant Name</th><th>Contact</th><th>Company</th><th>KYC Status</th><th>Joined</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800 [&>tr>td]:px-5 [&>tr>td]:py-3.5">
                {!rows ? (
                  <tr><td colSpan={7} className="py-10 text-center text-gray-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</td></tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center py-10 text-center">
                        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40"><Users className="h-9 w-9" /></span>
                        <div className="mt-3 text-[18px] font-bold text-gray-900 dark:text-gray-100">{all.length ? "No merchants match" : "No merchants found"}</div>
                        <div className="text-[14px] text-gray-500">{all.length ? "Try a different search." : "Start by onboarding your first merchant."}</div>
                        {!all.length && <button type="button" onClick={() => setOnboarding(true)} className={cn(pPrimary, "mt-4 h-12 px-6")}><Plus className="h-5 w-5" /> Onboard Merchant</button>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  shown.map((m, i) => (
                    <tr key={m.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                      <td className="text-gray-500">{(page - 1) * PER_PAGE + i + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{nameOf(m).charAt(0).toUpperCase()}</span>
                          <div><div className="font-medium text-gray-900 dark:text-gray-100">{nameOf(m)}</div><div className="font-mono text-[11px] text-gray-500">{m.id}</div></div>
                        </div>
                      </td>
                      <td><div className="text-gray-900 dark:text-gray-100">{m.email}</div><div className="text-[12px] text-gray-500">{m.phone_number || "—"}</div></td>
                      <td className="text-gray-800 dark:text-gray-200">{m.company_name || "—"}</td>
                      <td>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium", m.kyc_verified ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-400" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400")}>
                          {m.kyc_verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />} {m.kyc_verified ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td className="text-gray-800 dark:text-gray-200">{fmtDate(m.created_at)}</td>
                      <td className="text-right"><button type="button" onClick={() => setViewing(m)} className={cn(pOutline, "whitespace-nowrap px-3 py-2 text-[13px]")}><Eye className="h-4 w-4" /> View</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > PER_PAGE && <Pager page={page} perPage={PER_PAGE} total={filtered.length} noun="merchants" onPage={setPage} />}
      </div>

      <OnboardDialog
        open={onboarding}
        onClose={() => setOnboarding(false)}
        onDone={(m) => {
          setRows((r) => [m, ...(r ?? [])]);
          setOnboarding(false);
          toast({ title: "Merchant onboarded", description: `${nameOf(m)} (${m.id}) can now log in and complete KYC.` });
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{nameOf(viewing)}</DialogTitle>
                <DialogDescription className="font-mono">{viewing.id}</DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
                {([["Username", viewing.username], ["Email", viewing.email], ["Phone", viewing.phone_number || "—"], ["Company", viewing.company_name || "—"], ["KYC", viewing.kyc_verified ? "Approved" : "Pending"], ["Joined", fmtDate(viewing.created_at)], ["Under you since", fmtDate(viewing.mapped_at)]] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[130px_1fr] gap-3 py-2.5"><dt className="text-gray-500">{k}</dt><dd className="break-words font-medium text-gray-900 dark:text-gray-100">{v}</dd></div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
