export const PARTNER_TABS = ["kyc", "merchants", "password"] as const;
export type PartnerTab = (typeof PARTNER_TABS)[number];
export const isPartnerTab = (t?: string): t is PartnerTab => !!t && (PARTNER_TABS as readonly string[]).includes(t);

/** Partner panel (/partner/:tab) pages */
export const PANEL_TABS = ["dashboard", "merchants", "transactions", "profile"] as const;
export type PanelTab = (typeof PANEL_TABS)[number];
export const isPanelTab = (t?: string): t is PanelTab => !!t && (PANEL_TABS as readonly string[]).includes(t);

export const pCard = "rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
export const pPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-violet-600/25 transition hover:brightness-110 disabled:opacity-60";
export const pOutline =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";
