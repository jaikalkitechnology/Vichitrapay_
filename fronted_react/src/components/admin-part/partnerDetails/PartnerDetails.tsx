// Admin → Partners → partner details (/admin/partners/:id/:tab)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AtSign, CalendarDays, Loader2, Lock, Mail, Phone, Store, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorText } from "@/components/admin-part/listUtils";
import { fetchMerchantKyc, type KycData } from "@/api/kyc";
import { fetchPartner, joinedAgo, type Partner } from "@/api/partners";
import { mdCard, outlineBtn } from "@/components/txn/merchantDetails/mdStyles";
import { SetPasswordPanel } from "@/components/txn/merchantDetails/PasswordTab";
import PartnerKycTab from "@/components/admin-part/partnerDetails/PartnerKycTab";
import PartnerMerchantsTab from "@/components/admin-part/partnerDetails/PartnerMerchantsTab";
import type { PartnerTab } from "@/components/admin-part/partnerDetails/partnerTabs";

const TABS: { id: PartnerTab; label: string; icon: typeof Users }[] = [
  { id: "kyc", label: "KYC & Approval", icon: Users },
  { id: "merchants", label: "Merchants", icon: Store },
  { id: "password", label: "Set Password", icon: Lock },
];

export default function PartnerDetails({ partnerId, tab }: { partnerId: string; tab: PartnerTab }) {
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPartner(undefined);
    setError(null);
    fetchPartner(partnerId)
      .then(setPartner)
      .catch((e) => setError(errorText(e, "Failed to load partner")));
    fetchMerchantKyc(partnerId).then(setKyc).catch(() => setKyc(null));
  }, [partnerId]);

  const back = (
    <button type="button" onClick={() => navigate("/admin/partners")} className={cn(outlineBtn, "shrink-0")}>
      <ArrowLeft className="h-4 w-4" /> Back to Partners
    </button>
  );

  if (error || partner === null)
    return (
      <div className="space-y-4">
        {back}
        <div className={cn(mdCard, "p-6 text-[14px] text-red-600")}>{error ?? `Partner ${partnerId} was not found.`}</div>
      </div>
    );
  if (partner === undefined)
    return <div className="flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading partner…</div>;

  const name = partner.full_name || partner.username;
  const fully = partner.kyc_verified && kyc?.progress.percent === 100;

  return (
    <div className="space-y-4">
      <div className={cn(mdCard, "flex flex-col gap-4 bg-gradient-to-r from-white via-white to-violet-50/60 p-5 dark:from-gray-900 dark:via-gray-900 dark:to-violet-950/20 sm:flex-row sm:items-start sm:justify-between")}>
        <div className="flex min-w-0 items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-[30px] font-bold text-white shadow-lg shadow-violet-600/25">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-[24px] font-bold text-gray-900 dark:text-gray-100">{name}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><AtSign className="h-4 w-4" /> {partner.username}</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Joined {joinedAgo(partner.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {partner.phone_number || "—"}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {partner.email}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium", partner.kyc_verified ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400")}>
                {partner.kyc_verified ? "KYC Approved" : "KYC Pending"}
              </span>
              {fully && <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">Fully Approved</span>}
              <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[12px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">{partner.id}</span>
            </div>
          </div>
        </div>
        {back}
      </div>

      <nav className="grid grid-cols-3 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900" aria-label="Partner sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`/admin/partners/${encodeURIComponent(partnerId)}/${t.id}`)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 border-b-2 py-3.5 text-[14px] font-medium transition",
              tab === t.id ? "border-violet-600 bg-white text-violet-700 dark:bg-gray-800 dark:text-violet-300" : "border-transparent text-gray-600 hover:bg-white/60 dark:text-gray-400 dark:hover:bg-gray-800/60",
            )}
          >
            <t.icon className="h-4 w-4" /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === "kyc" && <PartnerKycTab partner={partner} kyc={kyc} setKyc={setKyc} onPartner={setPartner} />}
      {tab === "merchants" && <PartnerMerchantsTab partner={partner} />}
      {tab === "password" && <SetPasswordPanel userId={partner.id} username={partner.username} kind="partner" />}
    </div>
  );
}
