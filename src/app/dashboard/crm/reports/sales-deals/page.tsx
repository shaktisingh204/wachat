export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getDealFunnel,
  getDealsByMonth,
} from '@/app/actions/worksuite/reports.actions';
import { getCrmDeals } from '@/app/actions/crm-deals.actions';
import { SalesDealsView } from './sales-deals-view';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; page?: string; limit?: string }>;
}

export default async function SalesDealsReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = Math.max(5, Number(sp.limit ?? 20));

  const [funnel, byMonth, dealsRes] = await Promise.all([
    getDealFunnel(),
    getDealsByMonth(sp.from, sp.to),
    getCrmDeals(page, limit),
  ]);

  const dealRows = dealsRes.deals.map((d) => ({
    id: String(d._id),
    name: (d as { name?: string }).name ?? 'Untitled deal',
    stage: (d as { stage?: string }).stage ?? 'Unknown',
    value: Number((d as { value?: number }).value ?? 0),
    accountId: (d as { accountId?: unknown }).accountId
      ? String((d as { accountId?: unknown }).accountId)
      : undefined,
    createdAt: (d as { createdAt?: string | Date }).createdAt
      ? new Date((d as { createdAt?: string | Date }).createdAt as string | Date).toISOString()
      : null,
  }));

  return (
    <EntityListShell
      title="Sales Deals"
      subtitle="Deal pipeline, win-rate, and recent deal activity."
    >
      <SalesDealsView
        funnel={funnel}
        byMonth={byMonth}
        deals={dealRows}
        total={dealsRes.total}
        page={page}
        limit={limit}
      />
    </EntityListShell>
  );
}
