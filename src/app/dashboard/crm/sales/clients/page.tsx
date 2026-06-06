/**
 * Clients & Prospects list — `/dashboard/crm/sales/clients`
 * Server component. Reads page/limit/q/filters from the URL,
 * fetches a page window + KPIs in parallel, and hands data to
 * `<ClientsListClient>`.
 */

import { Suspense } from 'react';
import { getCrmAccounts, getCrmAccountKpis } from '@/app/actions/crm-accounts.actions';
import { ClientsListClient } from './_components/clients-list-client';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  industry?: string;
  engagement?: string;
  tab?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SalesClientsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const industry = (sp.industry ?? 'all').trim();
  const status = (sp.status ?? 'all').trim();
  const engagement = (sp.engagement ?? 'all').trim();
  const tab = (sp.tab ?? 'active').trim();

  const [{ accounts, total }, kpis] = await Promise.all([
    getCrmAccounts(
      page,
      limit,
      q || undefined,
      tab as 'active' | 'archived' | 'all',
      {
        industry: industry === 'all' ? undefined : industry,
        status: status === 'all' ? undefined : status,
        engagementScore: engagement === 'all' ? undefined : engagement,
      }
    ),
    getCrmAccountKpis(),
  ]);

  const hasMore = page * limit < total;

  return (
    <Suspense fallback={<ClientsPageLoader />}>
      <ClientsListClient
        accounts={accounts}
        total={total}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpis={kpis}
      />
    </Suspense>
  );
}

function ClientsPageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
