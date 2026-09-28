// Merchant KYC API (backend: app/routers/kyc.py)
import api from "@/api/api";
import { BASE_URL } from "@/config";

/** Upload limit — keep in sync with MAX_DOC_BYTES in app/routers/kyc.py. */
export const KYC_MAX_MB = 10;

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

/** Self-service KYC base: partners (role 1) use /partner/kyc, merchants /merchant/kyc. */
function selfKyc() {
  try {
    const role = JSON.parse(localStorage.getItem("gurutvapay-user") || "{}")?.role;
    return `${BASE_URL}/${role === 1 ? "partner" : "merchant"}/kyc`;
  } catch {
    return `${BASE_URL}/merchant/kyc`;
  }
}

export const fetchMyKyc = async (): Promise<KycData> => (await api.get(selfKyc())).data;

export const setKycCompanyType = async (company_type: string): Promise<KycData> =>
  (await api.put(`${selfKyc()}/company-type`, { company_type })).data;

export const setKycField = async (key: string, value: string): Promise<KycData> =>
  (await api.put(`${selfKyc()}/field`, { key, value })).data;

export const uploadKycDocument = async (key: string, file: File): Promise<KycData> => {
  const form = new FormData();
  form.append("key", key);
  form.append("file", file);
  return (await api.post(`${selfKyc()}/document`, form)).data;
};

export const fetchMyFees = async (): Promise<MerchantFees> => (await api.get(`${BASE_URL}/merchant/fees`)).data;

export const fetchMerchantKyc = async (userId: string): Promise<KycData> =>
  (await api.get(`${BASE_URL}/admin/kyc/${encodeURIComponent(userId)}`)).data;

export const reviewKycItem = async (userId: string, key: string, status: "approved" | "rejected", remark?: string): Promise<KycData> =>
  (await api.patch(`${BASE_URL}/admin/kyc/${encodeURIComponent(userId)}/${key}`, { status, remark })).data;

/** Document URL for the logged-in merchant/partner themself, or for an admin when userId is given. */
const docUrl = (key: string, userId?: string) =>
  userId ? `${BASE_URL}/admin/kyc/${encodeURIComponent(userId)}/document/${key}` : `${selfKyc()}/document/${key}`;

/** Fetch a KYC document with the auth header (shown in the in-page preview dialog). */
export const fetchKycDocument = async (key: string, userId?: string): Promise<Blob> =>
  (await api.get(docUrl(key, userId), { responseType: "blob" })).data;

/** Save a blob to disk under the given name. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fetch a KYC document and save it. */
export async function downloadKycDocument(key: string, opts: { userId?: string; fileName?: string | null } = {}) {
  saveBlob(await fetchKycDocument(key, opts.userId), opts.fileName || key);
}

/** Final account-level KYC decision (gates live PayIn). */
export const setMerchantKycVerified = async (userId: string, kyc_verified: boolean) =>
  (await api.patch(`${BASE_URL}/admin/user/${encodeURIComponent(userId)}/kyc`, { kyc_verified })).data;
