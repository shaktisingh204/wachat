export const dynamic = 'force-dynamic';

import { Crown } from 'lucide-react';
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
import { fmtMoney } from '../_components/report-toolbar';
import { getTopClients } from '@/app/actions/worksuite/reports.actions';

export default async function TopClientsPage() {
  const rows = await getTopClients(20);
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Top Clients"
        subtitle="Clients ranked by total revenue (paid invoices)."
        icon={Crown}
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10 text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Client</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Invoices
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
                    No clients yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.clientId}-${i}`} className="border-border">
                    <TableCell className="text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {r.clientName}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-foreground">
                      {r.invoices}
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
