// Merchant KYC API (backend: app/routers/kyc.py)
import api from "@/api/api";
import { BASE_URL } from "@/config";

export type KycStatus = "not_submitted" | "pending" | "approved" | "rejected";

export type KycItem = {
  key: string;
  label: string;
  kind: "text" | "file" | "select";
  hint: string | null;
  value: string | null;
  has_file: boolean;
  file_name: string | null;
  status: KycStatus;
  remark: string | null;
  updated_at: string | null;
};

export type KycData = {
  merchant_id: string;
  kyc_verified: boolean;
  company_type: string | null;
  company_types: { value: string; label: string }[];
  sections: { company: KycItem[]; basic: KycItem[]; documents: KycItem[] };
  bank: { total: number; verified: number };
  progress: { approved: number; total: number; percent: number };
};

export type MerchantFees =
  | { configured: false }
  | {
      configured: true;
      gst_percent: number;
      payin: { percent: number; examples: { amount: number; charges: number; gst: number; net: number }[] };
      payout: {
        flat: number;
        percent: number;
        flat_up_to: number;
        examples: { amount: number; charges: number; gst: number; total_debit: number }[];
      };
    };

export const fetchMyKyc = async (): Promise<KycData> => (await api.get(`${BASE_URL}/merchant/kyc`)).data;

export const setKycCompanyType = async (company_type: string): Promise<KycData> =>
  (await api.put(`${BASE_URL}/merchant/kyc/company-type`, { company_type })).data;

export const setKycField = async (key: string, value: string): Promise<KycData> =>
  (await api.put(`${BASE_URL}/merchant/kyc/field`, { key, value })).data;

export const uploadKycDocument = async (key: string, file: File): Promise<KycData> => {
  const form = new FormData();
  form.append("key", key);
  form.append("file", file);
  return (await api.post(`${BASE_URL}/merchant/kyc/document`, form)).data;
};

export const fetchMyFees = async (): Promise<MerchantFees> => (await api.get(`${BASE_URL}/merchant/fees`)).data;

export const fetchMerchantKyc = async (userId: string): Promise<KycData> =>
  (await api.get(`${BASE_URL}/admin/kyc/${encodeURIComponent(userId)}`)).data;

export const reviewKycItem = async (userId: string, key: string, status: "approved" | "rejected", remark?: string): Promise<KycData> =>
  (await api.patch(`${BASE_URL}/admin/kyc/${encodeURIComponent(userId)}/${key}`, { status, remark })).data;

/** Document URL for the merchant themself, or for an admin when userId is given. */
const docUrl = (key: string, userId?: string) =>
  userId ? `${BASE_URL}/admin/kyc/${encodeURIComponent(userId)}/document/${key}` : `${BASE_URL}/merchant/kyc/document/${key}`;

/** Fetch a KYC document with the auth header, then open it in a new tab or save it. */
export async function openKycDocument(key: string, opts: { userId?: string; download?: boolean; fileName?: string | null } = {}) {
  // open the tab synchronously so pop-up blockers allow it
  const tab = opts.download ? null : window.open("", "_blank");
  try {
    const res = await api.get(docUrl(key, opts.userId), { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = opts.fileName || key;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

/** Final account-level KYC decision (gates live PayIn). */
export const setMerchantKycVerified = async (userId: string, kyc_verified: boolean) =>
  (await api.patch(`${BASE_URL}/admin/user/${encodeURIComponent(userId)}/kyc`, { kyc_verified })).data;
