// src/hooks/useMerchantTransactions.ts
import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/api/api"; // your axios instance
import type { WalletTransactionOut } from "@/api/apiHelper";

export type TransactionsQuery = {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  search?: string | undefined;
  user_id?: string | undefined;
  transaction_type?: string | undefined;
  credit_debit?: string | undefined;
  status?: string | undefined;
  min_amount?: number | undefined;
  max_amount?: number | undefined;
  from_date?: string | undefined;
  to_date?: string | undefined;
};

export type PaginatedTx = {
  total: number;
  page: number;
  per_page: number;
  items: WalletTransactionOut[];
  total_pages?: number;
};

const DEFAULT_QUERY = {
  page: 1,
  per_page: 20,
  sort_by: "created_at",
  sort_dir: "desc" as "asc" | "desc",
};

export default function useMerchantTransactions(initial?: Partial<TransactionsQuery>) {
  const [query, setQuery] = useState<Required<Pick<TransactionsQuery, "page" | "per_page" | "sort_by" | "sort_dir">> & Partial<TransactionsQuery>>({
    ...DEFAULT_QUERY,
    ...(initial ?? {}),
  });

  const [data, setData] = useState<PaginatedTx | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimer = useRef<number | null>(null);
  const currentAbort = useRef<AbortController | null>(null);

  const doFetch = useCallback(async (q: TransactionsQuery) => {
    // cancel previous
    if (currentAbort.current) currentAbort.current.abort();
    const ac = new AbortController();
    currentAbort.current = ac;

    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      Object.entries(q).forEach(([k, v]) => {
        // only include meaningful values
        if (v !== undefined && v !== null && v !== "") params[k] = v;
      });

      const resp = await api.get("/admin/wallet-transactions", {
        params,
        signal: ac.signal,
      });

      // backend returns { items, meta: { page, per_page, total, total_pages } }
      const payload = resp.data ?? {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      const meta = payload.meta ?? {};

      setData({
        items,
        total: meta.total ?? 0,
        page: meta.page ?? q.page ?? DEFAULT_QUERY.page,
        per_page: meta.per_page ?? q.per_page ?? DEFAULT_QUERY.per_page,
        total_pages: meta.total_pages ?? Math.ceil((meta.total ?? 0) / (meta.per_page ?? q.per_page ?? DEFAULT_QUERY.per_page)),
      });
    } catch (err: any) {
      if (err?.name === "CanceledError" || err?.message === "canceled") return;
      console.error("fetch transactions error", err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to fetch");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // effect: fetch on relevant query fields
  useEffect(() => {
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }

    const perform = () => doFetch(query);

    if (query.search) {
      searchTimer.current = window.setTimeout(perform, 350);
    } else {
      perform();
    }

    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
      if (currentAbort.current) currentAbort.current.abort();
    };
  // depend on primitives only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query.page,
    query.per_page,
    query.sort_by,
    query.sort_dir,
    query.user_id,
    query.transaction_type,
    query.credit_debit,
    query.status,
    query.min_amount,
    query.max_amount,
    query.from_date,
    query.to_date,
    query.search,
  ]);

  // setters
  const setPage = useCallback((p: number) => setQuery((s) => ({ ...s, page: p })), []);
  const setPerPage = useCallback((n: number) => setQuery((s) => ({ ...s, per_page: n, page: 1 })), []);
  const setSort = useCallback((sort_by: string, sort_dir: "asc" | "desc") => setQuery((s) => ({ ...s, sort_by, sort_dir, page: 1 })), []);
  const setFilter = useCallback((partial: Partial<TransactionsQuery>) => setQuery((s) => ({ ...s, ...partial, page: partial.page ?? 1 })), []);
  const refresh = useCallback(() => doFetch(query), [doFetch, query]);

  return {
    query,
    data,
    loading,
    error,
    setPage,
    setPerPage,
    setSort,
    setFilter,
    refresh,
  };
}
