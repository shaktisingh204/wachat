import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { fmtMoney, fmtNumber } from '../_components/report-toolbar';
import { getTopProducts } from '@/app/actions/worksuite/reports.actions';

export default async function TopProductsPage() {
  const rows = await getTopProducts(20);

  return (
    <EntityListShell
      title="Top Products"
      subtitle="Products ranked by units sold and revenue (invoice line items)."
    >
      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="w-10 text-muted-foreground">#</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Product</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Units
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">
                  Revenue
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={4}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No products sold.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r, i) => (
                  <ZoruTableRow
                    key={`${r.productName}-${i}`}
                    className="border-border"
                  >
                    <ZoruTableCell className="text-muted-foreground">
                      {i + 1}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-medium text-foreground">
                      {r.productName}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                      {fmtNumber(r.units)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-emerald-500">
                      {fmtMoney(r.revenue)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
