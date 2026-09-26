// Admin → single merchant: data for the merchant details page
import api from "@/api/api";
import { BASE_URL } from "@/config";
import type { UserWithWallets, WalletTransactionOut } from "@/api/apiHelper";

export type SummaryWindow = { txns: number; success: number; failed: number; pending: number; volume: number; success_rate: number };
export type MerchantSummary = {
  user_id: string;
  today: SummaryWindow;
  yesterday: SummaryWindow;
  month: SummaryWindow;
  overall: SummaryWindow;
  payout: SummaryWindow;
};

export type MerchantSettingsFull = {
  id: string;
  payInCharges: number | null;
  payOutCharges: number | null;
  payOutChargesFlat: number | null;
  webhook: string | null;
  webhook_payout: string | null;
  ip: string | null;
};

export type ProviderCredentialRow = {
  provider_id: number;
  provider_name: string;
  direction: "payin" | "payout";
  client_id: string | null;
  secret_key: string | null;
  salt_key1: string | null;
  salt_key2: string | null;
  salt_key3: string | null;
  mid: string | null;
  is_active: boolean;
};

export type WalletTxnPage = {
  items: WalletTransactionOut[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
};

/** The merchant with wallet balances (users-with-wallets searches by id). */
export async function fetchMerchant(userId: string): Promise<UserWithWallets | null> {
  const { data } = await api.get(`${BASE_URL}/admin/users-with-wallets`, { params: { search: userId, per_page: 20, page: 1 } });
  return (data.items as UserWithWallets[]).find((u) => u.id === userId) ?? null;
}

export const fetchMerchantSummary = async (userId: string): Promise<MerchantSummary> =>
  (await api.get(`${BASE_URL}/admin/merchant-summary/${encodeURIComponent(userId)}`)).data;

/** null when the merchant has no settings row yet. */
export async function fetchMerchantSettings(userId: string): Promise<MerchantSettingsFull | null> {
  try {
    return (await api.get(`${BASE_URL}/admin/settings/${encodeURIComponent(userId)}`)).data;
  } catch (e) {
    if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
    throw e;
  }
}

/** PUT creates the row when missing (unset charges default to 0). */
export const saveMerchantSettings = async (userId: string, data: Partial<Omit<MerchantSettingsFull, "id">>): Promise<MerchantSettingsFull> =>
  (await api.put(`${BASE_URL}/admin/settings/${encodeURIComponent(userId)}`, data)).data;

export const fetchProviderCredentials = async (userId: string): Promise<ProviderCredentialRow[]> =>
  (await api.get(`${BASE_URL}/admin/credentials`, { params: { merchant_id: userId } })).data.credentials ?? [];

export const fetchMerchantTxns = async (params: Record<string, string | number | undefined>): Promise<WalletTxnPage> =>
  (await api.get(`${BASE_URL}/admin/wallet-transactions`, { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) })).data;

export const setMerchantPassword = async (userId: string, new_password: string) =>
  (await api.patch(`${BASE_URL}/admin/user/${encodeURIComponent(userId)}/password`, { new_password })).data;

export type BalanceResult = { wallet_balance: number; payout_wallet_balance: number; message: string };

/** Move money between the merchant's PayIn wallet and payout wallet; amount omitted = full balance. */
export const transferBalance = async (user_id: string, direction: "to_payout" | "to_wallet", amount?: number): Promise<BalanceResult> =>
  (await api.post(`${BASE_URL}/admin/transfer`, { user_id, direction, ...(amount ? { amount } : {}) })).data;

export const adjustBalance = async (user_id: string, wallet_type: "wallet" | "payout", action: "increase" | "decrease", amount: number): Promise<BalanceResult> =>
  (await api.post(`${BASE_URL}/admin/wallet-adjust`, { user_id, wallet_type, action, amount })).data;

/** Same rule as calculate_payout_charges() in app/crud/gateway/live_payout.py. */
export function payoutFee(amount: number, flat: number, percent: number) {
  const charges = Math.round((amount <= 1000 ? flat : (amount * percent) / 100) * 100) / 100;
  const gst = Math.round(charges * 0.18 * 100) / 100;
  return { charges, gst, total: Math.round((amount + charges + gst) * 100) / 100 };
}

/** Same rule as the live PayIn webhook: fee = amount × % · GST 18% of fee. */
export function payinFee(amount: number, percent: number) {
  const charges = Math.round(((amount * percent) / 100) * 100) / 100;
  const gst = Math.round(charges * 0.18 * 100) / 100;
  return { charges, gst, net: Math.round((amount - charges - gst) * 100) / 100 };
}

/** Random password with letters, digits and symbols (crypto-backed). */
export function generatePassword(length = 12) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "@#$%&*!?"];
  const all = sets.join("");
  const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < length) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type EmailValidationSetting = { user_id: string; enabled: boolean; updated_at: string | null; updated_by: string | null };
export type EmailTestResult = { email: string; valid: boolean; reason: string | null; checks: { format: boolean; vowel: boolean } };

export const fetchEmailValidation = async (userId: string): Promise<EmailValidationSetting> =>
  (await api.get(`${BASE_URL}/admin/email-validation/${encodeURIComponent(userId)}`)).data;

export const setEmailValidation = async (userId: string, enabled: boolean): Promise<EmailValidationSetting> =>
  (await api.put(`${BASE_URL}/admin/email-validation/${encodeURIComponent(userId)}`, { enabled })).data;

/** Runs the same check PayIn initiation uses (app/utils/email_validation.py). */
export const testCustomerEmail = async (email: string): Promise<EmailTestResult> =>
  (await api.post(`${BASE_URL}/admin/email-validation/test`, { email })).data;
