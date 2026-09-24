// src/hooks/useTransactions.ts
import { useEffect, useState, useRef, useCallback } from "react";
import { getTransactions, PaginatedWalletTransactions } from "@/api/apiHelper";

type Query = {
  transaction_type?: string | null;
  credit_debit?: string | null;
  status?: string | null;
  min_amount?: number | null;
  max_amount?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  search?: string | null;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_desc?: boolean;
};

export default function useTransactions(initialQuery: Query = {}) {
  const [query, setQuery] = useState<Query>({
    page: 1,
    per_page: 20,
    sort_by: "created_at",
    sort_desc: true,
    ...initialQuery,
  });
  const [data, setData] = useState<PaginatedWalletTransactions | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Abort controller ref to cancel previous requests
  const abortRef = useRef<AbortController | null>(null);
  // debounce timer for search
  const searchTimer = useRef<number | null>(null);

  const fetchData = useCallback(
    (overrides: Partial<Query> = {}, debounceSearch = true) => {
      // If search changed and debounceSearch true -> reset to page 1 and debounce
      const nextQuery = { ...query, ...overrides, page: overrides.page ?? query.page ?? 1 };

      // handle search debounce: if search exists in overrides or query has search
      // debounce only when the search text itself changes (paging/sorting must not reset to page 1)
      const searchChanged = overrides.search !== undefined && overrides.search !== query.search;
      if (debounceSearch && searchChanged) {
        if (searchTimer.current) window.clearTimeout(searchTimer.current);
        searchTimer.current = window.setTimeout(() => {
          fetchData({ ...overrides, page: 1 }, false);
        }, 400);
        // update state query immediately (but actual fetch delayed)
        setQuery((q) => ({ ...q, ...overrides, page: 1 }));
        return;
      }

      // cancel previous
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      // set and freeze the query we will use
      setQuery(nextQuery);

      getTransactions({
        ...nextQuery,
        signal: controller.signal,
      })
        .then((res) => {
          setData(res);
        })
        .catch((err: any) => {
          if (err.name === "AbortError") {
            // ignored
            return;
          }
          setError(err.message || "Failed to fetch transactions");
          setData(null);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [query]
  );

  // initial load
  useEffect(() => {
    fetchData({}, false);
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPage = (page: number) => fetchData({ page });
  const setPerPage = (per_page: number) => fetchData({ per_page, page: 1 });
  const setSort = (sort_by: string, sort_desc: boolean) => fetchData({ sort_by, sort_desc, page: 1 });
  const setFilter = (partial: Partial<Query>) => fetchData({ ...partial, page: 1 });
  const refresh = () => fetchData({}, false);

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
    fetchData, // lower-level trigger if needed
  };
}
