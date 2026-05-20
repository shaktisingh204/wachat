/**
 * React hook that resolves a Forge field's dynamic options against
 * `/api/sabflow/load-options`.
 *
 * Re-fetches whenever any of these change:
 *   • the selected credential
 *   • the value of any field listed in `field.loadOptionsDependsOn`
 *   • the search `filter`
 *   • the field id itself (defensive)
 *
 * Phase 3 additions:
 *   • `filter` argument — debounced 250ms before hitting the network so
 *     typing doesn't issue one request per keystroke.
 *   • `loadMore()` — concatenates the next page when the resolver returned
 *     a `paginationToken`. Filter/dep changes reset back to page 1.
 *   • `hasMore` — true while the resolver's last page returned a non-null
 *     pagination cursor.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ForgeField,
  ForgeSelectOption,
} from '@/lib/sabflow/forge/types';

export type UseLoadOptionsArgs = {
  blockId: string;
  actionId?: string;
  field: ForgeField;
  options: Record<string, unknown>;
  credentialId?: string;
  filter?: string;
};

export type UseLoadOptionsResult = {
  items: ForgeSelectOption[] | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

const DEBOUNCE_MS = 250;

/** Stable key — any change here forces a page-1 refetch. */
function buildDepKey(args: UseLoadOptionsArgs): string {
  const deps = args.field.loadOptionsDependsOn ?? [];
  const depValues: Record<string, unknown> = {};
  for (const k of deps) depValues[k] = args.options[k] ?? null;
  return JSON.stringify({
    blockId: args.blockId,
    actionId: args.actionId ?? null,
    fieldId: args.field.id,
    credentialId: args.credentialId ?? null,
    deps: depValues,
    filter: args.filter ?? '',
  });
}

type FetchResponse = {
  options?: ForgeSelectOption[];
  paginationToken?: string | null;
  error?: string;
};

export function useLoadOptions(args: UseLoadOptionsArgs): UseLoadOptionsResult {
  const [items, setItems] = useState<ForgeSelectOption[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depKey = buildDepKey(args);
  const lastKey = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  // Keep the latest args in a ref so loadMore() always uses fresh values
  // without depending on every arg in its useCallback deps array (which
  // would make it churn on every render).
  const argsRef = useRef(args);
  argsRef.current = args;

  /** Fire a single fetch. `token=null` means "first page". */
  const fetchPage = useCallback(async (token: string | null) => {
    const a = argsRef.current;
    if (typeof a.field.loadOptions !== 'function') return;

    // Abort any prior request so out-of-order responses can't clobber state.
    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;

    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/sabflow/load-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId: a.blockId,
          fieldId: a.field.id,
          actionId: a.actionId,
          credentialId: a.credentialId,
          options: a.options,
          filter: a.filter,
          paginationToken: token,
        }),
        signal: ac.signal,
      });
      const data = (await r.json().catch(() => ({}))) as FetchResponse;
      if (!r.ok) throw new Error(data.error ?? `Failed (${r.status})`);
      if (ac.signal.aborted) return;
      const page = Array.isArray(data.options) ? data.options : [];
      setItems((prev) => (token ? [...(prev ?? []), ...page] : page));
      setCursor(data.paginationToken ?? null);
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Failed to load options');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  // First-page fetch on any dep-key change (debounced when the change was
  // a filter keystroke — depKey includes filter so any edit triggers this).
  useEffect(() => {
    if (typeof args.field.loadOptions !== 'function') return;
    if (lastKey.current === depKey) return;
    lastKey.current = depKey;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPage(null);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  const loadMore = useCallback(() => {
    if (cursor && !loading) void fetchPage(cursor);
  }, [cursor, loading, fetchPage]);

  return {
    items,
    loading,
    error,
    hasMore: cursor != null,
    loadMore,
  };
}
