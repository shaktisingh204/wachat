/**
 * Proposals list — `/dashboard/crm/sales/proposals`
 * §1D rebuild. Server component. Fetches proposals + count KPIs in
 * parallel, hands data to `<ProposalListClient>` which composes
 * `<EntityListShell>`.
 *
 * getProposals is Mongo-backed (no page/hasMore yet), so we pass
 * the full row set and let the client component do in-memory filtering.
 */

import { getProposals } from '@/app/actions/worksuite/proposals.actions';
import type { WsProposal } from '@/lib/worksuite/proposals-types';
import { ProposalListClient } from './_components/proposal-list-client';

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
    <ProposalListClient
      proposals={proposals as ProposalRow[]}
      initialQuery={q}
      kpi={kpi}
    />
  );
}
