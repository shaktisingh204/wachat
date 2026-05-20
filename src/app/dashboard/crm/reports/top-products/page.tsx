export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTopProducts } from '@/app/actions/worksuite/reports.actions';
import { TopProductsView } from './top-products-view';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; page?: string; limit?: string }>;
}

export default async function TopProductsPage(props: PageProps) {
  const sp = await props.searchParams;
  const rows = await getTopProducts(100, sp.from, sp.to);

  return (
    <EntityListShell
      title="Top Products"
      subtitle="Products ranked by units sold and revenue across invoice line items."
    >
      <TopProductsView
        rows={rows}
        page={Math.max(1, Number(sp.page ?? 1))}
        limit={Math.max(5, Number(sp.limit ?? 20))}
      />
    </EntityListShell>
  );
}
