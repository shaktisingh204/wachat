export const dynamic = 'force-dynamic';

import { Package } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtMoney, fmtNumber } from '../_components/report-toolbar';
import { getTopProducts } from '@/app/actions/worksuite/reports.actions';

export default async function TopProductsPage() {
  const rows = await getTopProducts(20);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Top Products"
        subtitle="Products ranked by units sold and revenue (invoice line items)."
        icon={Package}
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="w-10 text-clay-ink-muted">#</TableHead>
                <TableHead className="text-clay-ink-muted">Product</TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Units
                </TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Revenue
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={4}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    No products sold.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={`${r.productName}-${i}`}
                    className="border-clay-border"
                  >
                    <TableCell className="text-clay-ink-muted">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium text-clay-ink">
                      {r.productName}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-clay-ink">
                      {fmtNumber(r.units)}
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-clay-green">
                      {fmtMoney(r.revenue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
