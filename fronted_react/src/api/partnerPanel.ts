// Logged-in partner's own panel (backend: app/routers/partner_panel.py)
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { PartnerMerchant } from "@/api/partners";

const P = `${BASE_URL}/partner`;

export type PartnerMe = {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  company_name: string | null;
  kyc_verified: boolean;
  created_at: string | null;
};

export type PartnerTxn = {
  id: number;
  merchant_id: string;
  merchant_name: string | null;
  txn_id: string | null;
  order_id: string | null;
  type: string;
  amount: number;
  charges: number;
  status: string | null;
  utr: string | null;
  instrument_mode: string | null;
  created_at: string | null;
};

export type Bucket = { count: number; amount: number };
export type PartnerTxnPage = {
  summary: { success: Bucket; pending: Bucket; failed: Bucket; charges: number };
  items: PartnerTxn[];
  total: number;
  page: number;
  per_page: number;
};

export type PartnerBankAccount = {
  id: number;
  account_holder_name: string;
  account_mask: string | null;
  ifsc_code: string;
  bank_name: string | null;
  account_type: string | null;
  is_validate: boolean;
};

export type OnboardForm = { full_name: string; username: string; email: string; phone_number: string; company_name: string; password: string };

export const fetchPartnerMe = async (): Promise<PartnerMe> => (await api.get(`${P}/me`)).data;

export const fetchMyMerchants = async (): Promise<PartnerMerchant[]> => (await api.get(`${P}/merchants`)).data;

export const onboardMerchant = async (f: OnboardForm): Promise<PartnerMerchant> =>
  (await api.post(`${P}/merchants`, { ...f, company_name: f.company_name || undefined })).data;

export const fetchMyMerchantTxns = async (params: { merchant_id?: string; from_date?: string; to_date?: string; page: number; per_page: number }): Promise<PartnerTxnPage> =>
  (await api.get(`${P}/transactions`, { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) })).data;

export const fetchMyBankAccounts = async (): Promise<PartnerBankAccount[]> => (await api.get(`${P}/bank-accounts`)).data;

export const addMyBankAccount = async (a: { account_holder_name: string; account_number: string; ifsc_code: string; bank_name: string; account_type: string }): Promise<PartnerBankAccount> =>
  (await api.post(`${P}/bank-accounts`, a)).data;

export const changePartnerPassword = async (old_password: string, new_password: string) =>
  (await api.post(`${P}/change-password`, { old_password, new_password })).data;
