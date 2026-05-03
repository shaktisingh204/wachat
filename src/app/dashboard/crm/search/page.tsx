'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Sparkles, RefreshCw } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
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

const GROUP_TONE: Record<string, 'neutral' | 'amber' | 'green' | 'red' | 'rose-soft'> = {
  contact: 'neutral',
  account: 'rose-soft',
  deal: 'amber',
  lead: 'green',
  task: 'neutral',
  project: 'rose-soft',
  invoice: 'amber',
  ticket: 'red',
  contract: 'neutral',
  kb: 'neutral',
  note: 'neutral',
  client: 'rose-soft',
  proposal: 'amber',
  estimate: 'amber',
};

function GroupCard({ group }: { group: WsSearchGroup }) {
  const tone = GROUP_TONE[group.type] ?? 'neutral';
  const shown = group.items.slice(0, 5);
  const more = Math.max(0, group.items.length - shown.length);

  return (
    <ClayCard>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-semibold text-foreground">{group.label}</h2>
          <ClayBadge tone={tone}>{group.items.length}</ClayBadge>
        </div>
        {more > 0 ? (
          <span className="text-[12px] text-muted-foreground">
            Showing 5 of {group.items.length}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Title</TableHead>
              <TableHead className="text-muted-foreground">Description</TableHead>
              <TableHead className="text-muted-foreground w-[110px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((item) => {
              const url =
                item.url ||
                defaultSearchUrl(group.type, String(item.searchable_id));
              return (
                <TableRow
                  key={String(item._id)}
                  className="border-border"
                >
                  <TableCell className="text-[13px] font-medium text-foreground">
                    {item.title}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {item.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={url}
                      className="text-[12.5px] font-medium text-accent-foreground hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ClayCard>
  );
}

export default function CrmUniversalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { toast } = useToast();

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
          <ClayButton
            variant="ghost"
            onClick={handleReindex}
            disabled={isReindexing}
            leading={
              <RefreshCw
                className={`h-4 w-4 ${isReindexing ? 'animate-spin' : ''}`}
              />
            }
          >
            Reindex
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="flex flex-col gap-2">
          <label className="text-[12.5px] font-medium text-muted-foreground">
            Search query
          </label>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              defaultValue={initialQuery}
              placeholder="Type at least one character..."
              className="h-11 rounded-lg border-border bg-card pl-9 text-[13.5px]"
              onChange={(e) => handleChange(e.target.value)}
            />
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Searches title, description and keywords in the universal index.
            Run <span className="font-medium text-foreground">Reindex</span> to
            rebuild from your CRM data.
          </p>
        </div>
      </ClayCard>

      {isPending && state.groups.length === 0 ? (
        <ClayCard>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-3 h-40 w-full" />
        </ClayCard>
      ) : state.query.length === 0 ? (
        <ClayCard>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
            <p className="text-[13px] text-muted-foreground">
              Start typing above to search across your CRM entities.
            </p>
          </div>
        </ClayCard>
      ) : state.groups.length === 0 ? (
        <ClayCard>
          <div className="flex flex-col items-start gap-1">
            <p className="text-[13px] font-medium text-foreground">
              No results for &ldquo;{state.query}&rdquo;.
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Try a different query or run a reindex if you&rsquo;ve recently added data.
            </p>
          </div>
        </ClayCard>
      ) : (
        <>
          <div className="text-[12.5px] text-muted-foreground">
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
