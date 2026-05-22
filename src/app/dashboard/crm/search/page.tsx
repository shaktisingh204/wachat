import { Card } from '@/components/zoruui';
import { Search as SearchIcon } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * CRM Global Search — server component per CRM_REBUILD_PLAN §5.2.
 *
 * Reads `?q=<query>` from `searchParams`. Empty → renders an empty
 * "Type to search" state. Present → calls `searchCrmEntities(q)` and
 * renders the results grouped by entity kind in `<Card>`s.
 *
 * The controlled input + debounced URL push live in the client
 * companion (`./_components/search-client.tsx`); the grouped result
 * list + keyboard nav live in `./_components/search-results-client.tsx`.
 * The server side just does the data fetch and renders the shell.
 */

import { searchCrmEntities, type SearchResultGroup } from '@/app/actions/crm-search.actions';

import { SearchClient } from './_components/search-client';
import { SearchResultsClient } from './_components/search-results-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CrmGlobalSearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();

  const groups: SearchResultGroup[] = q.length > 0 ? await searchCrmEntities(q) : [];

  const totalHits = groups.reduce((sum, g) => sum + g.results.length, 0);

  return (
    <EntityListShell
      title="Global Search"
      subtitle="Search every CRM entity at once — clients, vendors, items, employees, invoices and more."
    >

      <Card className="p-6">
        <SearchClient initialQuery={q} totalHits={totalHits} groupCount={groups.length} />
      </Card>

      {q.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <SearchIcon className="h-8 w-8 text-zoru-ink-muted" aria-hidden />
            <p className="text-[14px] font-medium text-zoru-ink">Type to search</p>
            <p className="text-[12.5px] text-zoru-ink-muted">
              Start typing above to search across every CRM entity in your tenant.
            </p>
          </div>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-[14px] font-medium text-zoru-ink">
              No results for &ldquo;{q}&rdquo;.
            </p>
            <p className="text-[12.5px] text-zoru-ink-muted">
              Try a different query, or check that you have view permission on the entity kind
              you&rsquo;re looking for.
            </p>
          </div>
        </Card>
      ) : (
        <SearchResultsClient groups={groups} query={q} />
      )}
    </EntityListShell>
  );
}
