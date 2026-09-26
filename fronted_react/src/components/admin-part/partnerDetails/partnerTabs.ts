export const PARTNER_TABS = ["kyc", "merchants", "password"] as const;
export type PartnerTab = (typeof PARTNER_TABS)[number];
export const isPartnerTab = (t?: string): t is PartnerTab => !!t && (PARTNER_TABS as readonly string[]).includes(t);
