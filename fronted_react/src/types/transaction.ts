export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'payin' | 'payout';
export type Currency = 'INR' | 'USDT';
export type SettlementMethod = 'bank_transfer' | 'usdt_payout';

export interface Transaction {
  id: string;
  merchantId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  status: TransactionStatus;
  txRef: string;
  fromWallet?: string;
  toWallet?: string;
  fees: number;
  createdAt: string;
  completedAt?: string;
  description?: string;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'banned';
  kycStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  balances: {
    INR: number;
    USDT: number;
  };
  totalVolume: number;
  totalFees: number;
}

export interface Settlement {
  id: string;
  merchantId: string;
  amount: number;
  currency: Currency;
  method: SettlementMethod;
  status: 'requested' | 'approved' | 'rejected' | 'paid';
  requestedAt: string;
  processedAt?: string;
  externalDetails: {
    bankAccount?: string;
    usdtAddress?: string;
  };
}

export interface ApiKey {
  id: string;
  merchantId: string;
  keyPrefix: string;
  name: string;
  environment: 'sandbox' | 'live';
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
}