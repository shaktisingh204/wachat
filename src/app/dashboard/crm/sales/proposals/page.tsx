/**
 * Proposals list — `/dashboard/crm/sales/proposals`
 * §1D rebuild. Server component. Fetches proposals + count KPIs in
 * parallel, hands data to `<ProposalListClient>` which composes
 * `<EntityListShell>`.
 *
 * getProposals is Mongo-backed (no page/hasMore yet), so we pass
 * the full row set and let the client component do in-memory filtering.
 */

import { Suspense } from 'react';
import { getProposals } from '@/app/actions/worksuite/proposals.actions';
import type { WsProposal } from '@/lib/worksuite/proposals-types';
import { ProposalListClient } from './_components/proposal-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ProposalsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();

  // Fetch full list — getProposals does in-DB text search when q is set.
  const proposals = await getProposals({ query: q || undefined });

  // Compute KPIs from the fetched set.
  type ProposalRow = WsProposal & { _id: string };
  const kpi = (proposals as ProposalRow[]).reduce(
    (acc, p) => {
      if (p.status === 'draft') acc.draft += 1;
      else if (p.status === 'sent') acc.sent += 1;
      else if (p.status === 'accepted') acc.accepted += 1;
      else if (p.status === 'declined' || p.status === 'expired') acc.closed += 1;
      acc.totalValue += Number(p.total || 0);
      return acc;
    },
    { draft: 0, sent: 0, accepted: 0, closed: 0, totalValue: 0 },
  );

  return (
    <Suspense fallback={<ProposalsPageLoader />}>
      <ProposalListClient
        proposals={proposals as ProposalRow[]}
        initialQuery={q}
        kpi={kpi}
      />
    </Suspense>
  );
}

function ProposalsPageLoader() {
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

