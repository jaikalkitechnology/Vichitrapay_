// Admin → Merchants → merchant details page (/admin/merchants/:id/:tab)
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CircleDollarSign, Copy, FileText, Home, Link2, Loader2, Lock, Mail, ReceiptText, Settings2, Wallet, FileBadge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { UserWithWallets } from "@/api/apiHelper";
import { fetchMerchantKyc, type KycData } from "@/api/kyc";
import { fetchMerchant, fetchMerchantSettings, fetchMerchantSummary, fetchProviderCredentials, type MerchantSettingsFull, type MerchantSummary, type ProviderCredentialRow } from "@/api/merchantAdmin";
import { errorText } from "@/components/admin-part/listUtils";
import { mdCard } from "@/components/txn/merchantDetails/mdStyles";
import { fmtDateTime, type MdCtx, type MdTab } from "@/components/txn/merchantDetails/mdTypes";
import OverviewTab from "@/components/txn/merchantDetails/OverviewTab";
import KycTab from "@/components/txn/merchantDetails/KycTab";
import { ChargesTab, PayoutChargesTab } from "@/components/txn/merchantDetails/ChargesTabs";
import CredentialsTab from "@/components/txn/merchantDetails/CredentialsTab";
import TransactionsTab from "@/components/txn/merchantDetails/TransactionsTab";
import BalanceTab from "@/components/txn/merchantDetails/BalanceTab";
import PasswordTab from "@/components/txn/merchantDetails/PasswordTab";

const TABS: { id: MdTab; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "kyc", label: "KYC Setting", icon: FileText },
  { id: "charges", label: "Charges Setting", icon: Settings2 },
  { id: "credentials", label: "Credential Setting", icon: Link2 },
  { id: "transactions", label: "Transaction", icon: ReceiptText },
  { id: "payoutCharges", label: "PayOut Charges", icon: CircleDollarSign },
  { id: "balance", label: "Add Balance PayOut", icon: Wallet },
  { id: "password", label: "Set Password", icon: Lock },
];

export default function MerchantDetails({ userId, tab }: { userId: string; tab: MdTab }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserWithWallets | null | undefined>(undefined);
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [summary, setSummary] = useState<MerchantSummary | null>(null);
  const [settings, setSettings] = useState<MerchantSettingsFull | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [creds, setCreds] = useState<ProviderCredentialRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetchMerchant(userId)
      .then(setUser)
      .catch((e) => setError(errorText(e, "Failed to load merchant")));
    fetchMerchantSummary(userId).then(setSummary).catch(() => setSummary(null));
  }, [userId]);

  useEffect(() => {
    setUser(undefined);
    setError(null);
    reload();
    fetchMerchantKyc(userId).then(setKyc).catch(() => setKyc(null));
    fetchMerchantSettings(userId)
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setSettingsLoaded(true));
    fetchProviderCredentials(userId).then(setCreds).catch(() => setCreds([]));
  }, [userId, reload]);

  const goTab = (t: MdTab) => navigate(`/admin/merchants/${encodeURIComponent(userId)}/${t}`);
  const back = (
    <button type="button" onClick={() => navigate("/admin/merchants")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-600 hover:text-indigo-600 dark:text-gray-400">
      <ArrowLeft className="h-4 w-4" /> Back to merchants
    </button>
  );

  if (error || user === null)
    return (
      <div className="space-y-4">
        {back}
        <div className={cn(mdCard, "p-6 text-[14px] text-red-600")}>{error ?? `Merchant ${userId} was not found.`}</div>
      </div>
    );
  if (user === undefined)
    return (
      <div className="space-y-4">
        {back}
        <div className="flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading merchant…</div>
      </div>
    );

  const ctx: MdCtx = { user, kyc, setKyc, summary, settings, setSettings, creds, reload, goTab };
  const name = user.full_name || user.company_name || user.username;
  const pending = kyc ? [...kyc.sections.company, ...kyc.sections.basic, ...kyc.sections.documents].filter((i) => i.status === "pending").length : 0;
  const copyId = () => navigator.clipboard.writeText(user.id).then(() => toast({ title: "Merchant ID copied" }));

  return (
    <div className="space-y-4">
      {back}
      <div className={cn(mdCard, "p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-[26px] font-bold text-white shadow-lg shadow-purple-600/25">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-bold text-gray-900 dark:text-gray-100">{name}</h1>
              <div className="flex items-center gap-1.5 text-[14px] text-gray-600 dark:text-gray-400"><Mail className="h-4 w-4" /> {user.email}</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium", user.kyc_verified ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400")}>
                  {user.kyc_verified ? "KYC Verified" : "KYC Pending"}
                </span>
                {pending > 0 && (
                  <button type="button" onClick={() => goTab("kyc")} className="rounded-md bg-gray-100 px-2 py-0.5 text-[12px] font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">
                    Needs Approval · {pending}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid shrink-0 gap-3 rounded-xl border border-gray-200/80 px-4 py-3 dark:border-gray-800 sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40"><FileBadge className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-gray-500">Merchant ID</div>
                <div className="font-mono text-[14px] font-bold text-gray-900 dark:text-gray-100">{user.id}</div>
              </div>
              <button type="button" onClick={copyId} aria-label="Copy merchant ID" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800"><Copy className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800"><CalendarDays className="h-4 w-4" /></span>
              <div>
                <div className="text-[11px] text-gray-500">Registered On</div>
                <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{fmtDateTime(user.created_at)}</div>
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto rounded-xl lg:flex-wrap lg:overflow-visible border border-gray-200/80 bg-gray-50/70 p-1 dark:border-gray-800 dark:bg-gray-800/40" aria-label="Merchant sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition",
                tab === t.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" && <OverviewTab ctx={ctx} />}
      {tab === "kyc" && <KycTab ctx={ctx} />}
      {tab === "transactions" && <TransactionsTab ctx={ctx} />}
      {tab === "balance" && <BalanceTab ctx={ctx} />}
      {tab === "password" && <PasswordTab ctx={ctx} />}
      {["charges", "payoutCharges", "credentials"].includes(tab) &&
        (!settingsLoaded ? (
          <div className="flex items-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>
        ) : tab === "charges" ? (
          <ChargesTab key={String(settings?.payInCharges)} ctx={ctx} />
        ) : tab === "payoutCharges" ? (
          <PayoutChargesTab key={`${settings?.payOutChargesFlat}-${settings?.payOutCharges}`} ctx={ctx} />
        ) : (
          <CredentialsTab key={`${settings?.ip}-${settings?.webhook}-${settings?.webhook_payout}`} ctx={ctx} />
        ))}
    </div>
  );
}
