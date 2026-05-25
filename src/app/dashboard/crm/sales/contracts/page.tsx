/**
 * Contracts list — `/dashboard/crm/sales/contracts`
 * §1D rebuild. Server component. Reads page/limit/q from the URL,
 * fetches a page window + KPIs in parallel, and hands data to
 * `<ContractListClient>` which composes `<EntityListShell>`.
 */

import { Suspense } from 'react';
import {
  listContracts,
  getContractKpisV2,
} from '@/app/actions/crm/contracts.actions';

import { ContractListClient } from './_components/contract-list-client';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SalesContractsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const [{ contracts, hasMore, error }, kpi] = await Promise.all([
    listContracts({ page, limit, q: q || undefined }),
    getContractKpisV2(),
  ]);

  return (
    <Suspense fallback={<ContractsPageLoader />}>
      <ContractListClient
        contracts={contracts}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        error={error}
      />
    </Suspense>
  );
}

function ContractsPageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

