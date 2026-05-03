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
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10 text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Product</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Units
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Revenue
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={4}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No products sold.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={`${r.productName}-${i}`}
                    className="border-border"
                  >
                    <TableCell className="text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {r.productName}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-foreground">
                      {fmtNumber(r.units)}
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-emerald-500">
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
