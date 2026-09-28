// Partner panel → Dashboard: stats for a day (default last 24 hours), quick actions, KYC status
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CalendarDays, CheckCircle2, ChevronRight, Clock, CreditCard, FileText, Landmark, RefreshCw, Shield, TrendingUp, Users, Wallet, X, XCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorText } from "@/components/admin-part/listUtils";
import { fetchMyKyc, type KycData } from "@/api/kyc";
import { fetchMyMerchants, fetchMyMerchantTxns, fetchPartnerMe, type PartnerMe, type PartnerTxnPage } from "@/api/partnerPanel";
import { KycStatusBadge } from "@/components/txn/kycBits";
import { groupState, type GroupState } from "@/components/txn/merchantDetails/mdTypes";
import { GradientStat } from "@/components/admin-part/partnerDetails/partnerBits";
import { pCard } from "@/components/admin-part/partnerDetails/partnerTabs";

const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const badgeOf = (s: GroupState) => (s === "incomplete" ? "not_submitted" : s);

export default function PanelHome() {
  const navigate = useNavigate();
  const [day, setDay] = useState("");
  const [summary, setSummary] = useState<PartnerTxnPage["summary"] | null>(null);
  const [merchants, setMerchants] = useState<number | null>(null);
  const [me, setMe] = useState<PartnerMe | null>(null);
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [t, m, p, k] = await Promise.all([
        fetchMyMerchantTxns(day ? { from_date: day, to_date: day, page: 1, per_page: 1 } : { last_hours: 24, page: 1, per_page: 1 }),
        fetchMyMerchants(),
        fetchPartnerMe(),
        fetchMyKyc(),
      ]);
      setSummary(t.summary);
      setMerchants(m.length);
      setMe(p);
      setKyc(k);
    } catch (e) {
      setError(errorText(e, "Failed to load dashboard"));
    } finally {
      setRefreshing(false);
    }
  }, [day]);
  useEffect(() => {
    load();
  }, [load]);

  const go = (tab: string) => navigate(`/partner/${tab}`);
  const s = summary;
  const txns = (n: number) => `${n} txn${n === 1 ? "" : "s"}`;

  const docs = kyc?.sections.documents.filter((d) => d.key !== "bank_proof_doc") ?? [];
  const kycRows: { label: string; icon: typeof Users; state: GroupState }[] = kyc
    ? [
        { label: "Company Type", icon: Building2, state: groupState(kyc.sections.company) },
        { label: "Basic Details", icon: FileText, state: groupState(kyc.sections.basic) },
        { label: "Full KYC Documents", icon: Shield, state: docs.length ? groupState(docs) : "incomplete" },
        { label: "Bank Account", icon: CreditCard, state: kyc.bank.verified ? "approved" : kyc.bank.total ? "pending" : "incomplete" },
        { label: "Final Approval", icon: CheckCircle2, state: me?.kyc_verified ? "approved" : "incomplete" },
      ]
    : [];
  const pct = me?.kyc_verified ? 100 : kyc?.progress.percent ?? 0;

  const actions = [
    { title: "Manage Merchants", sub: "View, onboard, and manage merchants", icon: Users, tone: "bg-violet-100 text-violet-600 dark:bg-violet-900/40", onClick: () => go("merchants") },
    { title: "View Transactions", sub: "Track all merchant transactions", icon: CreditCard, tone: "bg-blue-100 text-blue-600 dark:bg-blue-900/40", onClick: () => go("transactions") },
    { title: "Update Profile & KYC", sub: "Complete your KYC verification", icon: FileText, tone: "bg-green-100 text-green-600 dark:bg-green-900/40", onClick: () => go("profile") },
    { title: "Refresh Dashboard", sub: "Get latest stats and data", icon: RefreshCw, tone: "bg-orange-100 text-orange-500 dark:bg-orange-900/40", onClick: load },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-gray-900 dark:text-gray-100">Partner Dashboard</h1>
          <p className="text-[15px] text-gray-600 dark:text-gray-400">Manage your merchants, track transactions, and grow your business</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <CalendarDays className="h-5 w-5 text-gray-500" />
            <input type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDay(e.target.value)} aria-label="Stats date" className="bg-transparent text-[14px] text-gray-900 focus:outline-none dark:text-gray-100 dark:[color-scheme:dark]" />
            {day && <button type="button" onClick={() => setDay("")} aria-label="Back to last 24 hours" className="rounded p-0.5 text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>}
          </label>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-0.5 text-[12px] font-semibold text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300">
            {day ? new Date(`${day}T00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Last 24 Hours"}
          </span>
        </div>
      </div>

      {error && <div className={cn(pCard, "p-4 text-[14px] text-red-600")}>{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <GradientStat tone="violet" icon={Users} badge="Total" label="Merchants" value={merchants ?? "…"} sub="All time" />
        <GradientStat tone="blue" icon={Wallet} badge="Success" label="Total Success" value={s ? inr(s.success.amount) : "…"} sub={s && <><ArrowUpRight className="h-4 w-4" /> {txns(s.success.count)}</>} />
        <GradientStat tone="orange" icon={Clock} badge="Pending" label="Total Pending" value={s ? inr(s.pending.amount) : "…"} sub={s && <><Clock className="h-4 w-4" /> {txns(s.pending.count)}</>} />
        <GradientStat tone="red" icon={XCircle} badge="Failed" label="Total Failed" value={s ? inr(s.failed.amount) : "…"} sub={s && <><XCircle className="h-4 w-4" /> {txns(s.failed.count)}</>} />
        <GradientStat tone="green" icon={Landmark} badge="Charges" label="Total Charges" value={s ? inr(s.charges) : "…"} sub={<><TrendingUp className="h-4 w-4" /> Includes GST</>} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={cn(pCard, "h-fit p-5")}>
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Quick Actions</h2>
          <p className="mb-4 text-[14px] text-gray-500">Manage your partner account and business operations</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {actions.map((a) => (
              <button key={a.title} type="button" onClick={a.onClick} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-900">
                <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", a.tone)}>
                  <a.icon className={cn("h-7 w-7", a.title === "Refresh Dashboard" && refreshing && "animate-spin")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-gray-900 dark:text-gray-100">{a.title}</span>
                  <span className="block text-[13px] text-gray-500">{a.sub}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        <div className={cn(pCard, "p-5")}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">KYC Status</h2>
              <p className="text-[14px] text-gray-500">Verification Progress</p>
            </div>
            <div className="text-right">
              <Shield className="ml-auto h-7 w-7 text-blue-600" />
              <div className="text-[14px] font-bold text-blue-600">{pct}%</div>
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {kycRows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3 text-[14px] font-medium text-gray-800 dark:text-gray-200">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800"><r.icon className="h-5 w-5" /></span>
                  {r.label}
                </span>
                <KycStatusBadge status={badgeOf(r.state)} />
              </li>
            ))}
            {!kyc && !error && <li className="py-4 text-[13px] text-gray-500">Loading…</li>}
          </ul>
          <button type="button" onClick={() => go("profile")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 py-3 text-[15px] font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
            {me?.kyc_verified ? "View KYC Details" : "Complete KYC Setup"} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
