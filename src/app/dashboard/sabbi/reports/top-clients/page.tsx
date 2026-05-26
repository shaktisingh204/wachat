export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTopClientsDeep } from '@/app/actions/worksuite/reports.actions';
import { TopClientsReport } from './top-clients-report';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    minRevenue?: string;
    industry?: string;
  }>;
}

export default async function TopClientsPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = Math.max(5, Number(sp.limit ?? 20));
  const minRevenue = Math.max(0, Number(sp.minRevenue ?? 0));

  const rows = await getTopClientsDeep(
    200,
    sp.from,
    sp.to,
    minRevenue,
    sp.industry,
  );

  return (
    <EntityListShell
      title="Top Clients"
      subtitle="Clients ranked by total revenue from paid invoices."
    >
      <TopClientsReport
        rows={rows}
        page={page}
        limit={limit}
        from={sp.from}
        to={sp.to}
        minRevenue={minRevenue}
        industry={sp.industry ?? ''}
      />
    </EntityListShell>
  );
}
