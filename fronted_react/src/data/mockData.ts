import { Transaction, Merchant, Settlement, ApiKey } from '@/types/transaction';

export const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    merchantId: "merch_123",
    type: "payin",
    amount: 5000,
    currency: "INR",
    status: "completed",
    txRef: "REF001",
    fromWallet: "wallet_456",
    toWallet: "wallet_123",
    fees: 50,
    createdAt: "2024-01-15T10:30:00Z",
    completedAt: "2024-01-15T10:31:00Z",
    description: "Payment for order #1001"
  },
  {
    id: "txn_002",
    merchantId: "merch_123",
    type: "payout",
    amount: 2000,
    currency: "USDT",
    status: "pending",
    txRef: "REF002",
    fees: 20,
    createdAt: "2024-01-15T09:15:00Z",
    description: "Settlement request"
  },
  {
    id: "txn_003",
    merchantId: "merch_123",
    type: "payin",
    amount: 15000,
    currency: "INR",
    status: "completed",
    txRef: "REF003",
    fromWallet: "wallet_789",
    toWallet: "wallet_123",
    fees: 150,
    createdAt: "2024-01-14T16:45:00Z",
    completedAt: "2024-01-14T16:46:00Z",
    description: "Subscription payment"
  },
  {
    id: "txn_004",
    merchantId: "merch_456",
    type: "payin",
    amount: 8500,
    currency: "INR",
    status: "failed",
    txRef: "REF004",
    fees: 0,
    createdAt: "2024-01-14T12:20:00Z",
    description: "Failed payment attempt"
  }
];

export const mockMerchants: Merchant[] = [
  {
    id: "merch_123",
    name: "TechCorp Solutions",
    email: "merchant@example.com",
    status: "active",
    kycStatus: "approved",
    createdAt: "2024-01-01T00:00:00Z",
    balances: {
      INR: 45000,
      USDT: 2500
    },
    totalVolume: 125000,
    totalFees: 1250
  },
  {
    id: "merch_456",
    name: "E-Commerce Plus",
    email: "merchant2@example.com",  
    status: "active",
    kycStatus: "pending",
    createdAt: "2024-01-05T00:00:00Z",
    balances: {
      INR: 28000,
      USDT: 1200
    },
    totalVolume: 85000,
    totalFees: 850
  },
  {
    id: "merch_789",
    name: "Digital Services Ltd",
    email: "merchant3@example.com",
    status: "inactive",
    kycStatus: "rejected",
    createdAt: "2023-12-15T00:00:00Z",
    balances: {
      INR: 0,
      USDT: 0
    },
    totalVolume: 15000,
    totalFees: 150
  }
];

export const mockSettlements: Settlement[] = [
  {
    id: "settle_001",
    merchantId: "merch_123",
    amount: 20000,
    currency: "INR",
    method: "bank_transfer",
    status: "approved",
    requestedAt: "2024-01-14T08:00:00Z",
    processedAt: "2024-01-15T10:00:00Z",
    externalDetails: {
      bankAccount: "HDFC***1234"
    }
  },
  {
    id: "settle_002",
    merchantId: "merch_123",
    amount: 1500,
    currency: "USDT",
    method: "usdt_payout",
    status: "requested",
    requestedAt: "2024-01-15T14:30:00Z",
    externalDetails: {
      usdtAddress: "0x742d...8f2a"
    }
  },
  {
    id: "settle_003",
    merchantId: "merch_456",
    amount: 15000,
    currency: "INR",
    method: "bank_transfer",
    status: "rejected",
    requestedAt: "2024-01-13T12:00:00Z",
    processedAt: "2024-01-14T09:00:00Z",
    externalDetails: {
      bankAccount: "SBI***5678"
    }
  }
];

export const mockApiKeys: ApiKey[] = [
  {
    id: "key_001",
    merchantId: "merch_123",
    keyPrefix: "pk_test_",
    name: "Development Key",
    environment: "sandbox",
    permissions: ["payin", "payout", "webhooks"],
    createdAt: "2024-01-01T00:00:00Z",
    lastUsed: "2024-01-15T09:30:00Z"
  },
  {
    id: "key_002", 
    merchantId: "merch_123",
    keyPrefix: "pk_live_",
    name: "Production Key",
    environment: "live",
    permissions: ["payin", "payout"],
    createdAt: "2024-01-10T00:00:00Z",
    lastUsed: "2024-01-15T11:15:00Z"
  }
];