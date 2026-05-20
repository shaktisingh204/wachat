export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTopClients } from '@/app/actions/worksuite/reports.actions';
import { TopClientsView } from './top-clients-view';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; page?: string; limit?: string }>;
}

export default async function TopClientsPage(props: PageProps) {
  const sp = await props.searchParams;
  const rows = await getTopClients(100, sp.from, sp.to);

  return (
    <EntityListShell
      title="Top Clients"
      subtitle="Clients ranked by total revenue from paid invoices."
    >
      <TopClientsView
        rows={rows}
        page={Math.max(1, Number(sp.page ?? 1))}
        limit={Math.max(5, Number(sp.limit ?? 20))}
      />
    </EntityListShell>
  );
}
