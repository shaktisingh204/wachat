export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTopProductsDeep } from '@/app/actions/worksuite/reports.actions';
import { TopProductsReport } from './top-products-report';

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
    category?: string;
    minQty?: string;
  }>;
}

export default async function TopProductsPage(props: PageProps) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = Math.max(5, Number(sp.limit ?? 20));
  const minQuantity = Math.max(0, Number(sp.minQty ?? 0));

  const rows = await getTopProductsDeep(
    200,
    sp.from,
    sp.to,
    sp.category,
    minQuantity,
  );

  return (
    <EntityListShell
      title="Top Products"
      subtitle="Products ranked by units sold and revenue across invoice line items."
    >
      <TopProductsReport
        rows={rows}
        page={page}
        limit={limit}
        from={sp.from}
        to={sp.to}
        category={sp.category ?? ''}
        minQuantity={minQuantity}
      />
    </EntityListShell>
  );
}
