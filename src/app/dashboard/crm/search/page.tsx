'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Sparkles, RefreshCw } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';

import {
  searchEverything,
  reindexAll,
} from '@/app/actions/worksuite/search.actions';
import {
  defaultSearchUrl,
  type WsSearchGroup,
} from '@/lib/worksuite/search-types';

type SearchState = { query: string; groups: WsSearchGroup[] };

const GROUP_VARIANT: Record<
  string,
  'ghost' | 'warning' | 'success' | 'danger'
> = {
  contact: 'ghost',
  account: 'danger',
  deal: 'warning',
  lead: 'success',
  task: 'ghost',
  project: 'danger',
  invoice: 'warning',
  ticket: 'danger',
  contract: 'ghost',
  kb: 'ghost',
  note: 'ghost',
  client: 'danger',
  proposal: 'warning',
  estimate: 'warning',
};

function GroupCard({ group }: { group: WsSearchGroup }) {
  const variant = GROUP_VARIANT[group.type] ?? 'ghost';
  const shown = group.items.slice(0, 5);
  const more = Math.max(0, group.items.length - shown.length);

  return (
    <ZoruCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-semibold text-zoru-ink">{group.label}</h2>
          <ZoruBadge variant={variant}>{group.items.length}</ZoruBadge>
        </div>
        {more > 0 ? (
          <span className="text-[12px] text-zoru-ink-muted">
            Showing 5 of {group.items.length}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-zoru-line">
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
              <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
              <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
              <ZoruTableHead className="text-zoru-ink-muted w-[110px]">Action</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {shown.map((item) => {
              const url =
                item.url ||
                defaultSearchUrl(group.type, String(item.searchable_id));
              return (
                <ZoruTableRow
                  key={String(item._id)}
                  className="border-zoru-line"
                >
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

export default function CrmUniversalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { toast } = useZoruToast();

  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState>({
    query: initialQuery,
    groups: [],
  });
  const [isPending, startTransition] = useTransition();
  const [isReindexing, startReindex] = useTransition();

  const runSearch = useCallback((q: string) => {
    startTransition(async () => {
      const result = await searchEverything(q);
      setState({ query: result.query, groups: result.groups });
    });
  }, []);

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  const handleChange = useDebouncedCallback((value: string) => {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('q', value);
    else params.delete('q');
    router.replace(`/dashboard/crm/search?${params.toString()}`);
    runSearch(value);
  }, 300);

  const handleReindex = () => {
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
  };

  const totalHits = state.groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Universal Search"
        subtitle="Find contacts, accounts, deals, projects, tickets and more across your workspace."
        icon={SearchIcon}
        actions={
          <ZoruButton
            variant="ghost"
            onClick={handleReindex}
            disabled={isReindexing}
          >
            <RefreshCw className={`h-4 w-4 ${isReindexing ? 'animate-spin' : ''}`} />
            Reindex
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="flex flex-col gap-2">
          <label className="text-[12.5px] font-medium text-zoru-ink-muted">
            Search query
          </label>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <ZoruInput
              defaultValue={initialQuery}
              placeholder="Type at least one character..."
              className="h-11 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13.5px]"
              onChange={(e) => handleChange(e.target.value)}
            />
          </div>
          <p className="text-[11.5px] text-zoru-ink-muted">
            Searches title, description and keywords in the universal index.
            Run <span className="font-medium text-zoru-ink">Reindex</span> to
            rebuild from your CRM data.
          </p>
        </div>
      </ZoruCard>

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
              Start typing above to search across your CRM entities.
            </p>
          </div>
        </ZoruCard>
      ) : state.groups.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="flex flex-col items-start gap-1">
            <p className="text-[13px] font-medium text-zoru-ink">
              No results for &ldquo;{state.query}&rdquo;.
            </p>
            <p className="text-[12.5px] text-zoru-ink-muted">
              Try a different query or run a reindex if you&rsquo;ve recently added data.
            </p>
          </div>
        </ZoruCard>
      ) : (
        <>
          <div className="text-[12.5px] text-zoru-ink-muted">
            {totalHits} result{totalHits === 1 ? '' : 's'} across{' '}
            {state.groups.length} group{state.groups.length === 1 ? '' : 's'}.
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {state.groups.map((g) => (
              <GroupCard key={g.type} group={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
