export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getDealFunnel,
  getDealsByMonth,
  getCrmDealsFiltered,
} from '@/app/actions/worksuite/reports.actions';
import { SalesDealsView } from './sales-deals-view';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    stage?: string;
    pipeline?: string;
  }>;
}

export default async function SalesDealsReportPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = Math.max(5, Number(sp.limit ?? 20));

  const [funnel, byMonth, dealsRes] = await Promise.all([
    getDealFunnel(),
    getDealsByMonth(sp.from, sp.to),
    getCrmDealsFiltered(page, limit, sp.from, sp.to, sp.stage, sp.pipeline),
  ]);

  return (
    <EntityListShell
      title="Sales Deals"
      subtitle="Deal pipeline, win-rate, and recent deal activity."
    >
      <SalesDealsView
        funnel={funnel}
        byMonth={byMonth}
        deals={dealsRes.rows}
        total={dealsRes.total}
        page={page}
        limit={limit}
        from={sp.from}
        to={sp.to}
        stage={sp.stage ?? ''}
        pipeline={sp.pipeline ?? ''}
      />
    </EntityListShell>
  );
}
