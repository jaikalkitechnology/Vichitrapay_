import { useCallback, useEffect, useState } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";

export type NavNotification = {
  id: string;
  title: string;
  description: string;
  count: number;
  /** Sidebar tab id to open when clicked. */
  tab: string;
  tone: "amber" | "indigo" | "red" | "green";
};

const REFRESH_MS = 60_000;

/**
 * Pending-work notifications for the topbar bell, built from real data:
 * admin → /admin/summary counts; merchant → pending withdrawals and KYC status.
 */
export default function useNotifications(isAdmin: boolean) {
  const [items, setItems] = useState<NavNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const { data } = await api.get(`${BASE_URL}/admin/summary`);
        const kyc = Number(data?.merchant_kyc_pending || 0);
        const settle = Number(data?.total_settle_pending || 0);
        const bank = Number(data?.pending_bank_approvals || 0);
        setItems(
          [
            { id: "kyc", title: "KYC pending", description: "Merchants awaiting verification", count: kyc, tab: "merchants", tone: "amber" as const },
            { id: "settle", title: "Pending settlements", description: "Withdrawal requests to approve", count: settle, tab: "settlements", tone: "indigo" as const },
            { id: "bank", title: "Bank approvals", description: "Payout accounts to review", count: bank, tab: "bankApproval", tone: "red" as const },
          ].filter((n) => n.count > 0)
        );
      } else {
        const [settled, profile] = await Promise.allSettled([
          api.get(`${BASE_URL}/merchant/settled`, { params: { page: 1, per_page: 50 } }),
          api.get(`${BASE_URL}/merchant`),
        ]);
        const rows = settled.status === "fulfilled" && Array.isArray(settled.value.data) ? settled.value.data : [];
        const pending = rows.filter((r: { status?: string }) => ["pending", "requested", "processing"].includes(String(r?.status || "").toLowerCase())).length;
        const kycPending = profile.status === "fulfilled" && profile.value.data && profile.value.data.kyc_verified === false;
        const next: NavNotification[] = [];
        if (pending > 0) next.push({ id: "withdraw", title: "Withdrawals in progress", description: "Settlement requests awaiting approval", count: pending, tab: "settlements", tone: "indigo" });
        if (kycPending) next.push({ id: "kyc", title: "KYC pending", description: "Your account verification is not complete", count: 1, tab: "dashboard", tone: "amber" });
        setItems(next);
      }
    } catch {
      // notifications are best-effort; keep the last known list
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const total = items.reduce((sum, n) => sum + n.count, 0);
  return { items, total, loading, refresh: load };
}
