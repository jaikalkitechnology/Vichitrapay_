import type { UserWithWallets } from "@/api/apiHelper";
import type { KycData, KycItem } from "@/api/kyc";
import type { MerchantSettingsFull, MerchantSummary, ProviderCredentialRow } from "@/api/merchantAdmin";

export const MD_TABS = ["overview", "kyc", "charges", "credentials", "transactions", "payoutCharges", "balance", "password", "email"] as const;
export type MdTab = (typeof MD_TABS)[number];
export const isMdTab = (t?: string): t is MdTab => !!t && (MD_TABS as readonly string[]).includes(t);

/** Data the merchant-details page loads once and hands to every tab. */
export type MdCtx = {
  user: UserWithWallets;
  kyc: KycData | null;
  setKyc: (d: KycData) => void;
  summary: MerchantSummary | null;
  settings: MerchantSettingsFull | null;
  setSettings: (s: MerchantSettingsFull) => void;
  creds: ProviderCredentialRow[] | null;
  /** re-fetch the merchant (wallet balances, KYC flag…) and summary */
  reload: () => void;
  goTab: (t: MdTab) => void;
};

export type GroupState = "approved" | "rejected" | "pending" | "incomplete";

export function groupState(items: KycItem[]): GroupState {
  if (items.length && items.every((i) => i.status === "approved")) return "approved";
  if (items.some((i) => i.status === "rejected")) return "rejected";
  if (items.length && items.every((i) => i.status === "approved" || i.status === "pending")) return "pending";
  return "incomplete";
}

export const inr = (v: number | null | undefined) => `₹${Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso)
        .toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
        .replace("Sept", "Sep")
        .replace(" am", " AM")
        .replace(" pm", " PM")
    : "—";

export const companyTypeLabel = (kyc: KycData | null) => kyc?.company_types.find((t) => t.value === kyc.company_type)?.label ?? null;

export const businessAddress = (kyc: KycData | null) => kyc?.sections.basic.find((i) => i.key === "business_address")?.value ?? null;
