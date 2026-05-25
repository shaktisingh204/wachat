import { listDeals } from '@/app/actions/crm/deals.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DealListClient } from './_components/deal-list-client';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = sp.q?.trim() || '';

  const { deals, total, hasMore, error } = await listDeals({
    page,
    limit,
    search: q || undefined,
  });

  const stages = getDealStagesForIndustry();

  return (
    <EntityListShell
      title="Deals"
      subtitle="Pipeline opportunities — track value, stage, and forecast in one place."
    >
      <DealListClient
        deals={deals || []}
        total={total || 0}
        page={page}
        limit={limit}
        hasMore={hasMore || false}
        initialQuery={q}
        error={error}
        stages={stages}
      />
    </EntityListShell>
  );
}
