'use client';

import { ZoruInput, ZoruStatCard } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * `<SearchClient>` — controlled search input for `/dashboard/crm/search`.
 *
 * Owns:
 *  - The text input + auto-focus on mount.
 *  - A 300ms debounce.
 *  - URL synchronisation (`router.push('/dashboard/crm/search?q=...')`)
 *    which triggers the server component to re-render with the new
 *    `searchParams.q` — that's how the results below stay in sync.
 *
 * Does NOT own the result list — that's rendered server-side by the
 * parent page and made interactive by `<SearchResultsClient>`.
 */

import * as React from 'react';

interface SearchClientProps {
  initialQuery: string;
  /** Total result count across all visible groups — for the KPI strip. */
  totalHits: number;
  /** Number of populated groups — for the KPI strip. */
  groupCount: number;
}

export function SearchClient({
  initialQuery,
  totalHits,
  groupCount,
}: SearchClientProps): React.JSX.Element {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Auto-focus the input on mount so the page is keyboard-first.
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pushQuery = useDebouncedCallback((value: string) => {
    const trimmed = value.trim();
    const target = trimmed.length === 0
      ? '/dashboard/crm/search'
      : `/dashboard/crm/search?q=${encodeURIComponent(trimmed)}`;
    router.push(target);
  }, 300);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pushQuery(e.target.value);
    },
    [pushQuery],
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="text-[12.5px] font-medium text-zoru-ink-muted" htmlFor="crm-global-search">
        Search query
      </label>
      <div className="relative">
        <SearchIcon
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted"
          aria-hidden
        />
        <ZoruInput
          id="crm-global-search"
          ref={inputRef}
          defaultValue={initialQuery}
          placeholder="Start typing to search across clients, invoices, leads, items…"
          className="h-11 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13.5px]"
          onChange={handleChange}
          aria-label="CRM global search"
          autoComplete="off"
        />
      </div>

      {/* KPI strip — small enough to live in the same card as the input. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ZoruStatCard label="Total matches" value={totalHits.toLocaleString()} />
        <ZoruStatCard label="Groups" value={groupCount.toLocaleString()} />
        <ZoruStatCard label="Status" value={initialQuery ? 'Searching' : 'Idle'} />
      </div>
    </div>
  );
}
