'use client';

import { useState, useCallback, useTransition, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export interface FilterConfig {
  [key: string]: any;
}

export interface UseCrmBulkyStateOptions<T extends { _id: string | any }> {
  initialData?: T[];
  initialPage?: number;
  initialLimit?: number;
  fetchFn?: (params: {
    page: number;
    limit: number;
    search: string;
    filters: FilterConfig;
  }) => Promise<{ items: T[]; total: number; hasMore: boolean }>;
}

export function useCrmBulkyState<T extends { _id: string | any }>({
  initialData = [],
  initialPage = 1,
  initialLimit = 20,
  fetchFn,
}: UseCrmBulkyStateOptions<T> = {}) {
  const [data, setData] = useState<T[]>(initialData);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterConfig>({});
  const [isPending, startTransition] = useTransition();

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Spreadsheet Inline Edit state
  const [inlineEditRowId, setInlineEditRowId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Partial<T>>({});

  // Dynamic search handler (debounced)
  const handleSearch = useDebouncedCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, 300);

  // Filter handlers
  const updateFilter = useCallback((key: string, value: any) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === undefined || value === 'all' || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  // Selection handlers
  const toggleSelectOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  // Inline edit spreadsheet handlers
  const startInlineEdit = useCallback((row: T) => {
    setInlineEditRowId(row._id.toString());
    setEditBuffer({ ...row });
  }, []);

  const cancelInlineEdit = useCallback(() => {
    setInlineEditRowId(null);
    setEditBuffer({});
  }, []);

  const updateEditBuffer = useCallback((field: keyof T, value: any) => {
    setEditBuffer((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Standard refetch workflow
  const triggerFetch = useCallback(() => {
    if (!fetchFn) return;
    startTransition(async () => {
      try {
        const response = await fetchFn({ page, limit, search, filters });
        setData(response.items);
        setTotal(response.total);
        setHasMore(response.hasMore);
      } catch (err) {
        console.error('useCrmBulkyState: Fetch failed', err);
      }
    });
  }, [fetchFn, page, limit, search, filters]);

  // Bulk operation executor
  const runBulkOperation = useCallback(
    async (opFn: (ids: string[]) => Promise<{ success: boolean; error?: string }>) => {
      if (selected.size === 0) return { success: false, error: 'No items selected' };
      const ids = Array.from(selected);
      const res = await opFn(ids);
      if (res.success) {
        clearSelection();
        triggerFetch();
      }
      return res;
    },
    [selected, triggerFetch, clearSelection]
  );

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).length > 0;
  }, [filters]);

  return {
    data,
    setData,
    total,
    hasMore,
    page,
    setPage,
    limit,
    setLimit,
    search,
    filters,
    isPending,
    selected,
    inlineEditRowId,
    editBuffer,
    hasActiveFilters,

    // Handlers
    handleSearch,
    updateFilter,
    clearFilters,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    startInlineEdit,
    cancelInlineEdit,
    updateEditBuffer,
    triggerFetch,
    runBulkOperation,
  };
}
