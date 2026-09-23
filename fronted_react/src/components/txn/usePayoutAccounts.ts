// src/hooks/usePayoutAccounts.ts
import { useCallback, useEffect, useState } from "react";
import { createPayoutBankAccount, listPayoutBankAccounts, PayoutBankAccountOut, PayoutBankAccountList } from "@/api/apiHelper";

export default function usePayoutAccounts(initialLimit = 20) {
  const [items, setItems] = useState<PayoutBankAccountOut[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [offset, setOffset] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (opts?: { limit?: number; offset?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const res: PayoutBankAccountList = await listPayoutBankAccounts({
        limit: opts?.limit ?? limit,
        offset: opts?.offset ?? offset,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      if (opts?.limit != null) setLimit(opts.limit);
      if (opts?.offset != null) setOffset(opts.offset ?? 0);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch payout accounts");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: Parameters<typeof createPayoutBankAccount>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const created = await createPayoutBankAccount(payload);
      // after create, refresh list (reset to first page)
      await fetch({ limit: limit, offset: 0 });
      return created;
    } catch (err: any) {
      setError(err?.message || "Failed to create payout account");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetch, limit]);

  const setPage = (pageIndex: number) => {
    const nextOffset = Math.max(0, pageIndex * limit);
    setOffset(nextOffset);
    fetch({ offset: nextOffset });
  };

  const refresh = () => fetch({ limit, offset });

  return {
    items,
    total,
    limit,
    offset,
    loading,
    error,
    fetch,
    setLimit,
    setOffset,
    setPage,
    create,
    refresh,
  };
}
