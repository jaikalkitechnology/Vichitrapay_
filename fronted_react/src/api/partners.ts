// Admin → partner accounts (users with role 1)
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { UserWithWallets } from "@/api/apiHelper";

export const PARTNER_ROLE = 1;

export type Partner = UserWithWallets;

/** All partners (partner counts are small, so the page filters and pages them locally). */
export async function fetchPartners(): Promise<Partner[]> {
  const { data } = await api.get(`${BASE_URL}/admin/users-with-wallets`, {
    params: { role: PARTNER_ROLE, page: 1, per_page: 500, sort_by: "created_at", sort_desc: true },
  });
  return data.items ?? [];
}

export type PartnerForm = { full_name: string; username: string; email: string; phone_number: string; company_name: string };

export const createPartner = async (f: PartnerForm & { password: string }): Promise<Partner> =>
  (await api.post(`${BASE_URL}/admin/`, { ...f, company_name: f.company_name || undefined, role: PARTNER_ROLE })).data;

export const updatePartner = async (id: string, f: Partial<PartnerForm>): Promise<Partner> =>
  (await api.put(`${BASE_URL}/admin/user/${encodeURIComponent(id)}`, f)).data;

export const deletePartner = async (id: string) => api.delete(`${BASE_URL}/admin/user/${encodeURIComponent(id)}`);

export const setPartnerKyc = async (id: string, kyc_verified: boolean): Promise<Partner> =>
  (await api.patch(`${BASE_URL}/admin/user/${encodeURIComponent(id)}/kyc`, { kyc_verified })).data;

/** "3 days ago", "11 months ago" */
export function joinedAgo(iso?: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export const isNewPartner = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 7 * 86400000;
