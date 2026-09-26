// apiHelpers.ts
//import  { Merchant } from "@/components/dashboard/MerchantCard";
import api from './api';
import { BASE_URL } from '@/config';

// src/api/apiHelper.ts




export type Wallet = {
  id: number;
  user_id: string;
  balance: number;
  last_updated: string;
};

export type Merchant = {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  company_name?: string;
  role?: number;
  kyc_verified?: boolean;
  created_at?: string;
  wallet?: Wallet | null;
  payout_wallet?: Wallet | null;
};

export class APIError extends Error {
  status: number;
  payload?: any;
  constructor(message: string, status = 500, payload?: any) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.payload = payload;
  }
}

export type MetricWindow = {
  total_volume: number;   // returned as string to preserve precision
  total_txns: number;
  total_charges: number;
};

export type MetricsShape = {
  payin: {
    today: MetricWindow;
    yesterday: MetricWindow;
    "30_days": MetricWindow;
  };
  payout: {
    today: MetricWindow;
    yesterday: MetricWindow;
    "30_days": MetricWindow;
  };
};

export type MerchantMetricsResponse = {
  merchant_id: string | null;
  metrics: MetricsShape;
};


export type TransactionType = "payin" | "payout" | "refund" | string;
export type CreditDebitType = "credit" | "debit" | string;

export type WalletTransactionOut = {
  id: number;
  user_id: string;
  transaction_type: TransactionType;
  credit_debit: CreditDebitType;
  order_id?: string | null;
  status?: string | null;
  amount: number;
  settle_amount?: number | null;
  balance_amount?: number | null;
  charges?: number | null;
  gst?: number | null;
  reference_id?: string | null;
  txn_id?: string | null;
  utr?: string | null;
  description?: string | null;
  instrument_mode?: string | null;
  api_name?: string | null;
  created_at?: string | null; // ISO string
};

export type PaginatedWalletTransactions = {
  total: number;
  page: number;
  per_page: number;
  items: WalletTransactionOut[];
};


/* ---------- API calls ---------- */

export async function getSelfProfile(): Promise<Merchant> {
  const { data } = await api.get<Merchant>(`${BASE_URL}/merchant`);
  return data;
}


export async function getMerchantMetric(): Promise<MerchantMetricsResponse> {
  const { data } = await api.get<MerchantMetricsResponse>(`${BASE_URL}/merchant/merchant/metrics`);
  return data;
}

type GetTransactionsOpts = {
 
  // All possible filters:
  transaction_type?: string | null;
  credit_debit?: string | null;
  status?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  date_from?: string | null; // ISO or YYYY-MM-DD
  date_to?: string | null;
  search?: string | null;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_desc?: boolean;
  signal?: AbortSignal | null;
};

export async function getTransactions(opts: GetTransactionsOpts = {}): Promise<PaginatedWalletTransactions> {
  const {
    transaction_type,
    credit_debit,
    status,
    min_amount,
    max_amount,
    date_from,
    date_to,
    search,
    page = 1,
    per_page = 20,
    sort_by = "created_at",
    sort_desc = true,
    signal = null,
  } = opts;


  const url = new URL(`${BASE_URL}/merchant/transactions`);
  const params: Record<string, string> = {
    page: String(page),
    per_page: String(per_page),
    sort_by,
    sort_desc: String(sort_desc),
  };

  if (transaction_type) params.transaction_type = transaction_type;
  if (credit_debit) params.credit_debit = credit_debit;
  if (status) params.status = status;
  if (typeof min_amount === "number") params.min_amount = String(min_amount);
  if (typeof max_amount === "number") params.max_amount = String(max_amount);
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  if (search) params.search = search;

  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = api.get(url.toString(), {
    signal: signal ?? undefined,
  });

  const text = (await res).data;
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!(await res).data) {
    throw new APIError(payload?.detail || (await res).status || "Failed to fetch transactions", (await res).status, payload);
  }

  return payload as PaginatedWalletTransactions;
}


// src/lib/payoutApi.ts
export type PayoutBankAccountOut = {
  id: number;
  user_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string | null;
  bank_branch?: string | null;
  account_type?: string | null;
  bank_address?: string | null;
  is_validate: boolean;
};

export type PayoutBankAccountList = {
  total: number;
  items: PayoutBankAccountOut[];
};


export async function createPayoutBankAccount(
  payload: {
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string | null;
  bank_branch?: string | null;
  account_type?: string | null;
  bank_address?: string | null;
}
): Promise<PayoutBankAccountOut> {
  const { data } = await api.post<PayoutBankAccountOut>(`${BASE_URL}/merchant/payout-bank-accounts`,
    {
       body: payload,
    }
  );
  return data;
}


/** List payout bank accounts for current merchant */
export async function listPayoutBankAccounts(params?: {
  limit?: number;
  offset?: number;
  is_validate?: boolean | null;

}): Promise<PayoutBankAccountList> {
  
  const url = new URL(`${BASE_URL}/merchant/payout-bank-accounts`);
  if (params?.limit != null) url.searchParams.set("limit", String(params.limit));
  if (params?.offset != null) url.searchParams.set("offset", String(params.offset));
  if (params?.is_validate != null) url.searchParams.set("is_validate", String(params.is_validate));

  const res = await api.get(url.toString());

  const text = await res.data;
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.data) {
    throw new APIError(data?.detail || res.statusText || "Failed to list payout accounts", res.status, data);
  }
  return data as PayoutBankAccountList;
}

/** Get single payout bank account by id (merchant side) */
export async function getPayoutBankAccount(accountId: number, opts?: { token?: string; baseUrl?: string }): Promise<PayoutBankAccountOut> {
 
  const url = `${BASE_URL}/merchant/payout-bank-accounts/${accountId}`;
  const res = await api.get(url);

  const text = await res.data();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.data) {
    throw new APIError(data?.detail || res.statusText || "Failed to fetch payout account", res.status, data);
  }
  return data as PayoutBankAccountOut;
}

export type TxnStatusBreakdown = {
  success: number;
  failed: number;
  pending: number;
  total: number;
  volume: number;
};

export type PeriodMetrics = {
  volume: number;
  txn: number;
  charges: number;
  success_count: number;
  success_volume: number;
  payin?: TxnStatusBreakdown;
  payout?: TxnStatusBreakdown;
};

export type AdminSummaryOut = {
  total_merchants: number;
  today: PeriodMetrics;
  yesterday: PeriodMetrics;
  last_30_days: PeriodMetrics;
  merchant_kyc_pending: number;
  total_settle_pending: number;
  pending_bank_approvals: number;
};


export async function getAdminSummary(): Promise<AdminSummaryOut> {
  const { data } = await api.get<AdminSummaryOut>(`${BASE_URL}/admin/summary`);
  return data;
}


// src/types/admin.ts

/** Generic wallet shape used for both wallet & payout_wallet in the sample */




export interface UserWithWallets {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  phone_number?: string | null;
  company_name?: string | null;
  role?: number | null;
  kyc_verified: boolean;
  view_password?: string | null;
  created_at?: string | null;
  wallet?: Wallet | null;
  payout_wallet?: Wallet | null;
}

export interface PaginatedUsersWithWallets {
  total: number;
  page: number;
  per_page: number;
  items: UserWithWallets[];
}

/** Create / Update shapes */
export interface UserCreatePayload {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  phone_number?: string;
  company_name?: string;
  role?: number;
}

export interface UserUpdatePayload {
  username?: string;
  email?: string;
  full_name?: string;
  phone_number?: string;
  company_name?: string;
  role?: number;
  kyc_verified?: boolean;
}

export type UsersWithWalletsParams = {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_desc?: boolean;
  search?: string;
  role?: number;
  kyc_verified?: boolean;
};


export async function fetchUsersWithWallets(
  params: UsersWithWalletsParams = {},
): Promise<PaginatedUsersWithWallets> {
 
  const url = `${BASE_URL}/admin/users-with-wallets`;

  // build query params with defaults
  const qp: Record<string, any> = {
    page: params.page ?? 1,
    per_page: params.per_page ?? 20,
    sort_by: params.sort_by ?? "created_at",
    sort_desc: params.sort_desc ?? true,
    // optional filters
    ...(params.search !== undefined ? { search: params.search } : {}),
    ...(params.role !== undefined ? { role: params.role } : {}),
    ...(params.kyc_verified !== undefined ? { kyc_verified: params.kyc_verified } : {}),
  };

  // remove null/undefined values (defensive)
  Object.keys(qp).forEach((k) => {
    if (qp[k] === undefined || qp[k] === null) delete qp[k];
  });

  try {
    const response = await api.get<PaginatedUsersWithWallets>(url, {
      params: qp, 
    });
    return response.data;
  } catch (err: any) {
    // normalize axios / fetch errors into a thrown Error with useful message
  
    throw err;
  }
}

export async function createUser(
  payload: UserCreatePayload,
): Promise<UserCreatePayload> {
 
  const url = `${BASE_URL}/admin`;


  try {
    const response = await api.post(url, {
       body: payload, 
    });
    return response.data;
  } catch (err: any) {
    // normalize axios / fetch errors into a thrown Error with useful message
  
    throw err;
  }
}

export const addMerchant = async (
  data: {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  phone_number?: string;
  company_name?: string;
  role?: number;
}): Promise<UserCreatePayload> => {
  const response = await api.post<UserCreatePayload>(`${BASE_URL}/admin`, data);
  return response.data;
};

export interface MerchantSettings{
    id:string,
    payInCharges:number,
    payOutCharges:number,
    payOutChargesFlat?: number,
    webhook: string,
    webhook_payout?: string | null,
    ip: string
}

export const addMerchantSettings = async (
  data: {
  id: string;
  payInCharges: number;
  payOutCharges: number;
  payOutChargesFlat?: number;
  webhook?: string;
  ip?: string;
 
}): Promise<MerchantSettings> => {
  const response = await api.post<MerchantSettings>(`${BASE_URL}/admin/settings`, data);
  return response.data;
};


export async function getMerchantSetting(merchant_id:string): Promise<MerchantSettings> {
  const { data } = await api.get<MerchantSettings>(`${BASE_URL}/admin/settings/${merchant_id}`);
  return data;
}

export const updateMerchantSettings = async (
  merchant_id: string,
  data: Partial<MerchantSettings>
): Promise<MerchantSettings> => {
  const response = await api.put<MerchantSettings>(`${BASE_URL}/admin/settings/${merchant_id}`, data);
  return response.data;
};


export const updateMerchant = async (
  userId: string,
  data: Partial<UserUpdatePayload>
): Promise<UserUpdatePayload> => {
  const response = await api.put<UserUpdatePayload>(`${BASE_URL}/admin/user/${userId}`, data);
  return response.data;
};
export async function updateUser(
  userId: string,
  payload: UserUpdatePayload,
): Promise<UserUpdatePayload> {
 
  const url = `${BASE_URL}/admin/user/${userId}`;


  try {
    const response = await api.put(url, {
       body: payload, 
    });
    return response.data;
  } catch (err: any) {
    // normalize axios / fetch errors into a thrown Error with useful message
  
    throw err;
  }
}
type GetTransactionsOpts1 = {
 
  // All possible filters:
  merchant_id?:string | null;
  transaction_type?: string | null;
  credit_debit?: string | null;
  status?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  date_from?: string | null; // ISO or YYYY-MM-DD
  date_to?: string | null;
  search?: string | null;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_desc?: boolean;
  signal?: AbortSignal | null;
};


export async function getAdminTransactions(opts: GetTransactionsOpts1 = {}): Promise<PaginatedWalletTransactions> {
  const {
    merchant_id,
    transaction_type,
    credit_debit,
    status,
    min_amount,
    max_amount,
    date_from,
    date_to,
    search,
    page = 1,
    per_page = 20,
    sort_by = "created_at",
    sort_desc = true,
    signal = null,
  } = opts;


  const url = new URL(`${BASE_URL}/admin/wallet-transactions`);
  const params: Record<string, string> = {
    page: String(page),
    per_page: String(per_page),
    sort_by,
    sort_desc: String(sort_desc),
  };

  if (merchant_id) params.merchant_id = merchant_id;
  if (transaction_type) params.transaction_type = transaction_type;
  if (credit_debit) params.credit_debit = credit_debit;
  if (status) params.status = status;
  if (typeof min_amount === "number") params.min_amount = String(min_amount);
  if (typeof max_amount === "number") params.max_amount = String(max_amount);
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  if (search) params.search = search;

  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = api.get(url.toString(), {
    signal: signal ?? undefined,
  });

  const text = (await res).data;
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!(await res).data) {
    throw new APIError(payload?.detail || (await res).status || "Failed to fetch transactions", (await res).status, payload);
  }

  return payload as PaginatedWalletTransactions;
}




export const TransferSettings = async (
  data: {
  id: string;
  payInCharges: number;
  payOutCharges: number;
  webhook?: string;
  ip?: string;
 
}): Promise<MerchantSettings> => {
  const response = await api.post<MerchantSettings>(`${BASE_URL}/admin/settings`, data);
  return response.data;
};

// apiHelper.ts
export async function checkPayoutStatus(upstream_order_id: string) {
  try {
    const { data } = await api.post(
      "/merchant/payout/status/check",
      { upstream_order_id } // if backend expects body
      // or pass as params if you keep FastAPI simple type param
    );
    return data;
  } catch (error: any) {
    const msg = extractErrorMessage(error);
    // If you need to compare/route on message, use safeLower(msg)
    throw new Error(msg);
  }
}
function extractErrorMessage(error: any): string {
  if (typeof error?.response?.data?.detail === 'string') {
    return error.response.data.detail;
  }
  if (typeof error?.message === 'string') {
    return error.message;
  }
  return 'An unknown error occurred';
}



export const fetchMerchantCredentials = async () => {
  const res = await api.get(`${BASE_URL}/merchant/credentials`);
  return res.data;
};

export const fetchAdminMerchantCredentials = async (merchant_id: string) => {
  const res = await api.get(`${BASE_URL}/admin/credentials?merchant_id=${merchant_id}`
  );
  return res.data;
};