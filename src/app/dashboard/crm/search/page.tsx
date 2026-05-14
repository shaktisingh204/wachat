'use client';

/**
 * Global Search — §1D enhanced.
 *
 * - Search bar auto-focused on mount.
 * - KPI strip (Total matches · top entity kind · groups · recent count).
 * - Entity-kind filter chips (toggle which types are included).
 * - Date range + owner (deferred client filter — kept simple).
 * - Recents in localStorage (`crm.search.recent` — last 10).
 * - Results grouped by entity kind with up to 10 hits + "see all" link.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  History,
  RefreshCw,
  Search as SearchIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { CrmPageHeader } from '../_components/crm-page-header';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';

import {
  searchEverything,
  reindexAll,
} from '@/app/actions/worksuite/search.actions';
import {
  defaultSearchUrl,
  WS_SEARCHABLE_TYPES,
  WS_TYPE_LABELS,
  type WsSearchableType,
  type WsSearchGroup,
} from '@/lib/worksuite/search-types';

const RECENT_KEY = 'crm.search.recent';
const MAX_RECENT = 10;

interface SearchState {
  query: string;
  groups: WsSearchGroup[];
}

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

export default function CrmUniversalSearchPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { toast } = useZoruToast();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = React.useState(initialQuery);
  const [state, setState] = React.useState<SearchState>({ query: initialQuery, groups: [] });
  const [isPending, startTransition] = React.useTransition();
  const [isReindexing, startReindex] = React.useTransition();
  const [includedTypes, setIncludedTypes] = React.useState<Set<WsSearchableType>>(
    () => new Set(WS_SEARCHABLE_TYPES),
  );
  const [recents, setRecents] = React.useState<string[]>([]);

  // Auto-focus on mount
  React.useEffect(() => {
    inputRef.current?.focus();
    setRecents(loadRecents());
  }, []);

  const runSearch = React.useCallback((q: string) => {
    startTransition(async () => {
      const result = await searchEverything(q);
      setState({ query: result.query, groups: result.groups });
    });
  }, []);

  React.useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  const persistRecent = React.useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecents((prev) => {
      const next = [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, MAX_RECENT);
      saveRecents(next);
      return next;
    });
  }, []);

  const handleChange = useDebouncedCallback((value: string) => {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('q', value);
    else params.delete('q');
    router.replace(`/dashboard/crm/search?${params.toString()}`);
    runSearch(value);
    persistRecent(value);
  }, 300);

  const handleRecentClick = React.useCallback(
    (q: string) => {
      if (inputRef.current) inputRef.current.value = q;
      setQuery(q);
      const params = new URLSearchParams(searchParams.toString());
      params.set('q', q);
      router.replace(`/dashboard/crm/search?${params.toString()}`);
      runSearch(q);
    },
    [router, runSearch, searchParams],
  );

  const handleReindex = React.useCallback(() => {
    startReindex(async () => {
      const res = await reindexAll();
      if (res.ok) {
        toast({
          title: 'Search reindex complete',
          description: `${res.indexed} records indexed.`,
        });
        if (state.query) runSearch(state.query);
      } else {
        toast({
          variant: 'destructive',
          title: 'Reindex failed',
          description: res.error,
        });
      }
    });
  }, [runSearch, state.query, toast]);

  const toggleType = React.useCallback((t: WsSearchableType) => {
    setIncludedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const visibleGroups = React.useMemo(
    () => state.groups.filter((g) => includedTypes.has(g.type)),
    [state.groups, includedTypes],
  );

  const totalHits = React.useMemo(
    () => visibleGroups.reduce((acc, g) => acc + g.items.length, 0),
    [visibleGroups],
  );

  const topGroup = React.useMemo(() => {
    if (visibleGroups.length === 0) return '—';
    const sorted = [...visibleGroups].sort((a, b) => b.items.length - a.items.length);
    return `${sorted[0].label} (${sorted[0].items.length})`;
  }, [visibleGroups]);

  const clearRecents = React.useCallback(() => {
    setRecents([]);
    saveRecents([]);
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Universal Search"
        subtitle="Find contacts, accounts, deals, projects, tickets and more across all 14+ searchable entities."
        icon={SearchIcon}
        actions={
          <ZoruButton variant="ghost" onClick={handleReindex} disabled={isReindexing}>
            <RefreshCw className={cn('h-4 w-4', isReindexing && 'animate-spin')} />
            Reindex
          </ZoruButton>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <ZoruStatCard label="Total matches" value={totalHits.toLocaleString()} />
        <ZoruStatCard label="Top group" value={topGroup} />
        <ZoruStatCard label="Groups" value={visibleGroups.length.toLocaleString()} />
        <ZoruStatCard label="Recent searches" value={recents.length.toLocaleString()} />
      </div>

      {/* Search input */}
      <ZoruCard className="p-6">
        <label className="text-[12.5px] font-medium text-zoru-ink-muted">Search query</label>
        <div className="relative mt-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            ref={inputRef}
            defaultValue={initialQuery}
            placeholder="Start typing to search across leads, deals, invoices, contacts…"
            className="h-11 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13.5px]"
            onChange={(e) => handleChange(e.target.value)}
            aria-label="Universal search"
          />
        </div>

        {/* Entity-kind chips */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Include:
          </span>
          {WS_SEARCHABLE_TYPES.map((t) => {
            const active = includedTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors',
                  active
                    ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-ink'
                    : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink',
                )}
              >
                {WS_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </ZoruCard>

      {/* Recents */}
      {state.query.length === 0 && recents.length > 0 ? (
        <ZoruCard className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-medium text-zoru-ink">
              <History className="h-4 w-4 text-zoru-ink-muted" />
              Recent searches
            </div>
            <ZoruButton variant="ghost" size="sm" onClick={clearRecents}>
              <X className="h-3.5 w-3.5" />
              Clear
            </ZoruButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRecentClick(r)}
                className="rounded-full border border-zoru-line bg-zoru-bg px-3 py-1 text-[12px] text-zoru-ink hover:bg-zoru-surface-2"
              >
                {r}
              </button>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      {/* Results */}
      {isPending && state.groups.length === 0 ? (
        <ZoruCard className="p-6">
          <ZoruSkeleton className="h-6 w-64" />
          <ZoruSkeleton className="mt-3 h-40 w-full" />
        </ZoruCard>
      ) : state.query.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
            <p className="text-[13px] text-zoru-ink-muted">
              Start typing to search across leads, deals, invoices, contacts, tickets…
            </p>
          </div>
        </ZoruCard>
      ) : visibleGroups.length === 0 ? (
        <ZoruCard className="p-6">
          <p className="text-[13px] font-medium text-zoru-ink">
            No results for &ldquo;{state.query}&rdquo;.
          </p>
          <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
            Try a different query, broaden the entity-kind filter, or run a reindex if you&rsquo;ve
            recently added data.
          </p>
        </ZoruCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleGroups.map((group) => (
            <GroupCard key={group.type} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: WsSearchGroup }): React.JSX.Element {
  const shown = group.items.slice(0, 10);
  return (
    <ZoruCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-zoru-ink">{group.label}</h2>
          <ZoruBadge variant="secondary">{group.items.length}</ZoruBadge>
        </div>
        <Link
          href={defaultSearchUrl(group.type, '')}
          className="text-[12px] font-medium text-accent-foreground hover:underline"
        >
          See all
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zoru-line">
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
              <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
              <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
              <ZoruTableHead className="w-[80px] text-zoru-ink-muted">Open</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {shown.map((item) => {
              const url = item.url || defaultSearchUrl(group.type, String(item.searchable_id));
              return (
                <ZoruTableRow key={String(item._id)} className="border-zoru-line">
                  <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                    {item.title}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {item.description || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Link
                      href={url}
                      className="text-[12.5px] font-medium text-accent-foreground hover:underline"
                    >
                      View
                    </Link>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })}
          </ZoruTableBody>
        </ZoruTable>
      </div>
    </ZoruCard>
  );
}
