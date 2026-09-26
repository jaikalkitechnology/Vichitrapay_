// Admin → Partner Management: partner accounts (role 1) — list, create, edit, KYC, delete
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CalendarPlus,
  Clock,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  User,
  Users,
  X,
  Building2,
  Hash,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorText, filterInputCls } from "@/components/admin-part/listUtils";
import Pager from "@/components/admin-part/Pager";
import { EmptyState } from "@/components/admin-part/ui";
import { createPartner, deletePartner, fetchPartners, isNewPartner, joinedAgo, setPartnerKyc, updatePartner, type Partner, type PartnerForm } from "@/api/partners";

const card = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700 disabled:opacity-60";
const outlineBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";
const AVATAR = ["from-violet-500 to-purple-700", "from-sky-400 to-cyan-600", "from-emerald-400 to-teal-600", "from-amber-400 to-orange-600", "from-pink-400 to-rose-600", "from-indigo-400 to-blue-700"];
const avatarOf = (id: string) => AVATAR[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
const nameOf = (p: Partner) => p.full_name || p.username;
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const EMPTY: PartnerForm = { full_name: "", username: "", email: "", phone_number: "", company_name: "" };

function Stat({ icon: Icon, tile, box, label, value, sub, corner }: { icon: typeof Users; tile: string; box: string; label: string; value: React.ReactNode; sub: string; corner: typeof Users }) {
  const Corner = corner;
  return (
    <div className={cn("relative flex items-center gap-4 rounded-2xl border p-5 shadow-sm", box)}>
      <span className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl", tile)}>
        <Icon className="h-8 w-8" />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-gray-700 dark:text-gray-300">{label}</div>
        <div className="text-[28px] font-bold leading-tight text-gray-900 dark:text-gray-100">{value}</div>
        <div className="text-[13px] text-gray-500">{sub}</div>
      </div>
      <Corner className="absolute right-5 top-5 h-5 w-5 opacity-70" />
    </div>
  );
}

/** Create / edit form shown in the right-hand panel. */
function PartnerPanel({ editing, onClose, onSaved }: { editing: Partner | null; onClose: () => void; onSaved: (p: Partner, created: boolean) => void }) {
  const [form, setForm] = useState<PartnerForm>(
    editing
      ? { full_name: editing.full_name ?? "", username: editing.username, email: editing.email, phone_number: (editing.phone_number ?? "").replace(/^\+91\s?/, ""), company_name: editing.company_name ?? "" }
      : EMPTY,
  );
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim() || !form.username.trim() || !form.email.trim() || !form.phone_number.trim()) return setError("Fill in every required field");
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(form.username)) return setError("Username: 3–30 letters, numbers, dot, dash or underscore");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Enter a valid email address");
    if (!/^[6-9]\d{9}$/.test(form.phone_number.replace(/\s/g, ""))) return setError("Enter a valid 10-digit mobile number");
    if (!editing && password.length < 8) return setError("Password must be at least 8 characters");
    const data = { ...form, phone_number: `+91 ${form.phone_number.replace(/\s/g, "")}`, full_name: form.full_name.trim(), username: form.username.trim(), email: form.email.trim() };
    setBusy(true);
    try {
      onSaved(editing ? await updatePartner(editing.id, data) : await createPartner({ ...data, password }), !editing);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof PartnerForm, label: string, placeholder: string, required = true, type = "text") => (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-gray-800 dark:text-gray-200">
        {label} {required && "*"}
      </span>
      <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={placeholder} className={cn(filterInputCls, "h-12 text-[14px]")} />
    </label>
  );

  return (
    <div className={cn(card, "p-5 xl:sticky xl:top-4")}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">{editing ? "Edit Partner" : "Add New Partner"}</h3>
            <p className="text-[13px] text-gray-500">{editing ? `Update ${editing.username}'s details` : "Create a new partner account with required details"}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("full_name", "Full Name", "John Doe")}
          {field("username", "Username", "john_partner")}
        </div>
        {field("email", "Email Address", "john@example.com", true, "email")}
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-gray-800 dark:text-gray-200">Phone Number *</span>
          <div className="flex gap-2">
            <span className="flex h-12 w-20 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-[14px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">+91</span>
            <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} inputMode="numeric" placeholder="9876543210" className={cn(filterInputCls, "h-12 flex-1 text-[14px]")} />
          </div>
        </label>
        {field("company_name", "Company", "Optional", false)}
        {!editing && (
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-gray-800 dark:text-gray-200">Password *</span>
            <div className="relative">
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Enter a secure password" className={cn(filterInputCls, "h-12 pr-11 text-[14px]")} />
              <button type="button" onClick={() => setShow(!show)} tabIndex={-1} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={cn(outlineBtn, "h-12 px-8")}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={cn(primaryBtn, "h-12 px-8")}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save Changes" : "Create Partner"}
          </button>
        </div>
      </form>
    </div>
  );
}

function KycTile({ p }: { p: Partner }) {
  return p.kyc_verified ? (
    <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 dark:bg-green-950/30">
      <BadgeCheck className="h-5 w-5 shrink-0 text-green-600" />
      <div>
        <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">KYC Done</div>
        <div className="text-[12px] text-gray-500">Verified</div>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-950/30">
      <Clock className="h-5 w-5 shrink-0 text-amber-500" />
      <div>
        <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">KYC Pending</div>
        <div className="text-[12px] text-gray-500">Not verified</div>
      </div>
    </div>
  );
}

export default function PartnerManagement() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kyc, setKyc] = useState<"all" | "verified" | "pending">("all");
  const [perPage, setPerPage] = useState(12);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [panel, setPanel] = useState<{ editing: Partner | null } | null>(null);
  const [viewing, setViewing] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState<Partner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchPartners()
      .then(setPartners)
      .catch((e) => setError(errorText(e, "Failed to load partners")));
  }, []);
  useEffect(load, [load]);

  const all = useMemo(() => partners ?? [], [partners]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (p) =>
        (kyc === "all" || (kyc === "verified") === p.kyc_verified) &&
        (!q || [p.full_name, p.username, p.email, p.phone_number, p.id, p.company_name].some((v) => (v ?? "").toLowerCase().includes(q))),
    );
  }, [all, search, kyc]);
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  const verified = all.filter((p) => p.kyc_verified).length;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = all.filter((p) => p.created_at && new Date(p.created_at).getTime() >= monthStart).length;
  const pct = (n: number) => (all.length ? Math.round((n * 100) / all.length) : 0);

  const replace = (p: Partner) => setPartners((list) => (list ?? []).map((x) => (x.id === p.id ? { ...x, ...p } : x)));

  const toggleKyc = async (p: Partner) => {
    setBusyId(p.id);
    try {
      const u = await setPartnerKyc(p.id, !p.kyc_verified);
      replace(u);
      if (viewing?.id === p.id) setViewing({ ...p, ...u });
      toast({ title: u.kyc_verified ? "KYC marked verified" : "KYC verification removed", description: nameOf(p) });
    } catch (e) {
      toast({ title: "Update failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deletePartner(deleting.id);
      setPartners((list) => (list ?? []).filter((x) => x.id !== deleting.id));
      toast({ title: "Partner deleted", description: nameOf(deleting) });
      setDeleting(null);
    } catch (e) {
      toast({ title: "Delete failed", description: errorText(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    const head = ["Partner ID", "Full Name", "Username", "Email", "Phone", "Company", "KYC", "Joined"];
    const lines = filtered.map((p) => [p.id, p.full_name, p.username, p.email, p.phone_number, p.company_name, p.kyc_verified ? "Verified" : "Pending", p.created_at].map(csvCell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = "partners.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const menu = (p: Partner) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`More actions for ${p.username}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => setViewing(p)}><Eye /> View profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPanel({ editing: p })}><Pencil /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleKyc(p)}><ShieldCheck /> {p.kyc_verified ? "Remove KYC verification" : "Mark KYC verified"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDeleting(p)} className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/40"><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const actions = (p: Partner, compact = false) => (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setViewing(p)} className={cn(outlineBtn, compact ? "px-3 py-1.5 text-[13px]" : "h-11")}>
        <Eye className="h-4 w-4" /> View Profile
      </button>
      <span className="flex-1" />
      <button type="button" onClick={() => setPanel({ editing: p })} aria-label={`Edit ${p.username}`} className={cn(outlineBtn, compact ? "p-2" : "h-11 w-11 p-0")}>
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setDeleting(p)} aria-label={`Delete ${p.username}`} className={cn("inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30", compact ? "p-2" : "h-11 w-11")}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
            <Users className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-gray-100">Partner Management</h1>
            <p className="text-[14px] text-gray-600 dark:text-gray-400">Manage, review, and monitor all partner accounts in one place.</p>
          </div>
        </div>
        <button type="button" onClick={() => setPanel({ editing: null })} className={cn(primaryBtn, "h-12 px-6 text-[15px]")}>
          <Plus className="h-5 w-5" /> Add Partner
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} corner={Users} tile="bg-blue-100 text-blue-600 dark:bg-blue-900/40" box="border-blue-100 bg-blue-50/40 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/20" label="Total Partners" value={partners ? all.length : "…"} sub="All registered partners" />
        <Stat icon={CalendarPlus} corner={CalendarDays} tile="bg-green-100 text-green-600 dark:bg-green-900/40" box="border-green-100 bg-green-50/40 text-green-600 dark:border-green-900/40 dark:bg-green-950/20" label="Joined This Month" value={partners ? thisMonth : "…"} sub={`${pct(thisMonth)}% of total`} />
        <Stat icon={ShieldCheck} corner={BadgeCheck} tile="bg-violet-100 text-violet-600 dark:bg-violet-900/40" box="border-violet-100 bg-violet-50/40 text-violet-600 dark:border-violet-900/40 dark:bg-violet-950/20" label="KYC Approved" value={partners ? verified : "…"} sub={`${pct(verified)}% completion`} />
        <Stat icon={Clock} corner={Clock} tile="bg-amber-100 text-amber-500 dark:bg-amber-900/40" box="border-amber-100 bg-amber-50/40 text-amber-500 dark:border-amber-900/40 dark:bg-amber-950/20" label="KYC Pending" value={partners ? all.length - verified : "…"} sub="Awaiting verification" />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative xl:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, phone…" className={cn(filterInputCls, "h-12 pl-11 text-[14px]")} />
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={kyc} onChange={(e) => { setKyc(e.target.value as typeof kyc); setPage(1); }} className={cn(filterInputCls, "h-12 w-auto text-[14px]")}>
            <option value="all">All KYC</option>
            <option value="verified">KYC Verified</option>
            <option value="pending">KYC Pending</option>
          </select>
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className={cn(filterInputCls, "h-12 w-auto text-[14px]")}>
            {[12, 24, 48].map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </div>
        <span className="hidden flex-1 xl:block" />
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
            {([["cards", LayoutGrid, "Cards"], ["table", Table2, "Table"]] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={cn("inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-medium", view === v ? "bg-violet-600 text-white" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800")}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className={cn(outlineBtn, "h-12")}><RefreshCw className="h-4 w-4" /> Refresh</button>
          <button type="button" onClick={exportCsv} disabled={!filtered.length} className={cn(outlineBtn, "h-12")}><Download className="h-4 w-4" /> Export</button>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-5", panel && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-gray-100">All Partners</h2>
            <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[12px] font-semibold text-white">{filtered.length} Partner{filtered.length === 1 ? "" : "s"}</span>
          </div>

          {error ? (
            <div className={cn(card, "flex items-center justify-between p-5 text-[14px] text-red-600")}>
              {error}
              <button type="button" onClick={load} className="font-medium text-violet-600 hover:underline">Retry</button>
            </div>
          ) : !partners ? (
            <div className="flex items-center gap-2 text-[14px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading partners…</div>
          ) : filtered.length === 0 ? (
            <div className={cn(card, "p-8")}>
              <EmptyState icon={Users} title={all.length ? "No partners match" : "No partners yet"} description={all.length ? "Try a different search or filter." : "Click Add Partner to create the first partner account."} />
            </div>
          ) : view === "cards" ? (
            <div className={cn("grid grid-cols-1 gap-5 md:grid-cols-2", !panel && "2xl:grid-cols-3")}>
              {shown.map((p) => (
                <div key={p.id} className={cn(card, "relative flex flex-col overflow-hidden")}>
                  {isNewPartner(p.created_at) && (
                    <span className="absolute -right-8 top-4 rotate-45 bg-amber-500 px-8 py-0.5 text-[11px] font-bold tracking-wide text-white shadow">NEW</span>
                  )}
                  <div className="flex items-start gap-4 p-5 pb-4">
                    <span className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-[26px] font-bold text-white shadow-md", avatarOf(p.id))}>
                      {nameOf(p).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[18px] font-bold text-gray-900 dark:text-gray-100">{nameOf(p)}</h3>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-400"><User className="h-3.5 w-3.5" /> @{p.username}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-500"><CalendarDays className="h-3.5 w-3.5" /> Joined {joinedAgo(p.created_at)}</div>
                    </div>
                    <div className="mr-4">{menu(p)}</div>
                  </div>
                  <div className="space-y-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                    {[
                      { icon: Mail, tone: "bg-blue-50 text-blue-600 dark:bg-blue-950/40", label: "Email", value: p.email },
                      { icon: Phone, tone: "bg-green-50 text-green-600 dark:bg-green-950/40", label: "Phone", value: p.phone_number || "—" },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center gap-3">
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", r.tone)}><r.icon className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{r.label}</div>
                          <div className="truncate text-[13px] text-gray-600 dark:text-gray-400">{r.value}</div>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <KycTile p={p} />
                      <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 dark:bg-violet-950/30">
                        <Hash className="h-5 w-5 shrink-0 text-violet-600" />
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[12px] font-semibold text-gray-900 dark:text-gray-100">{p.id}</div>
                          <div className="text-[12px] text-gray-500">Partner ID</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-[13px] dark:border-gray-800 dark:bg-gray-800/30">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="truncate text-gray-700 dark:text-gray-300">{p.company_name || <span className="text-gray-400">No company</span>}</span>
                  </div>
                  <div className="border-t border-gray-100 p-4 dark:border-gray-800">{actions(p)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn(card, "overflow-hidden")}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 [&>th]:px-4 [&>th]:py-3">
                      <th>Partner</th><th>Contact</th><th>KYC</th><th>Joined</th><th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800 [&>tr>td]:px-4 [&>tr>td]:py-3">
                    {shown.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td>
                          <div className="flex items-center gap-3">
                            <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white", avatarOf(p.id))}>{nameOf(p).charAt(0).toUpperCase()}</span>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{nameOf(p)}</div>
                              <div className="text-[12px] text-gray-500">@{p.username} · <span className="font-mono">{p.id}</span></div>
                            </div>
                          </div>
                        </td>
                        <td><div className="text-gray-900 dark:text-gray-100">{p.email}</div><div className="text-[12px] text-gray-500">{p.phone_number || "—"}</div></td>
                        <td>
                          <span className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium", p.kyc_verified ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400")}>{p.kyc_verified ? "Verified" : "Pending"}</span>
                        </td>
                        <td><div className="text-gray-900 dark:text-gray-100">{fmtDate(p.created_at)}</div><div className="text-[12px] text-gray-500">{joinedAgo(p.created_at)}</div></td>
                        <td><div className="flex justify-end">{actions(p, true)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filtered.length > perPage && (
            <div className={card}>
              <Pager page={page} perPage={perPage} total={filtered.length} noun="partners" onPage={setPage} />
            </div>
          )}
        </div>

        {panel && (
          <PartnerPanel
            key={panel.editing?.id ?? "new"}
            editing={panel.editing}
            onClose={() => setPanel(null)}
            onSaved={(p, created) => {
              if (created) setPartners((list) => [p, ...(list ?? [])]);
              else replace(p);
              toast({ title: created ? "Partner created" : "Partner updated", description: `${nameOf(p)} (${p.id})` });
              setPanel(null);
            }}
          />
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>Partner profile</DialogTitle>
                <DialogDescription>{viewing.id}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-4">
                <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-[22px] font-bold text-white", avatarOf(viewing.id))}>{nameOf(viewing).charAt(0).toUpperCase()}</span>
                <div>
                  <div className="text-[17px] font-bold text-gray-900 dark:text-gray-100">{nameOf(viewing)}</div>
                  <div className="text-[13px] text-gray-500">@{viewing.username}</div>
                </div>
              </div>
              <dl className="divide-y divide-gray-100 text-[13px] dark:divide-gray-800">
                {([
                  ["Email", viewing.email],
                  ["Phone", viewing.phone_number || "—"],
                  ["Company", viewing.company_name || "—"],
                  ["KYC", viewing.kyc_verified ? "Verified" : "Pending"],
                  ["Joined", `${fmtDate(viewing.created_at)} (${joinedAgo(viewing.created_at)})`],
                ] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-2.5">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="break-words font-medium text-gray-900 dark:text-gray-100">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => toggleKyc(viewing)} disabled={busyId === viewing.id} className={outlineBtn}>
                  {busyId === viewing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {viewing.kyc_verified ? "Remove KYC verification" : "Mark KYC verified"}
                </button>
                <button type="button" onClick={() => { setPanel({ editing: viewing }); setViewing(null); }} className={primaryBtn}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete partner?</DialogTitle>
            <DialogDescription>
              {deleting && `${nameOf(deleting)} (${deleting.id}) will be removed permanently and can no longer log in. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className={outlineBtn}>Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busyId === deleting?.id} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {busyId === deleting?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
