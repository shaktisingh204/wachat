export const dynamic = 'force-dynamic';

import { TrendingUp } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  fmtMoney,
} from '../_components/report-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getProfitLoss } from '@/app/actions/worksuite/reports.actions';

export default async function ProfitLossPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getProfitLoss(sp.from, sp.to, 'month');

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expense: acc.expense + r.expense,
      profit: acc.profit + r.profit,
    }),
    { income: 0, expense: 0, profit: 0 },
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Profit & Loss"
        subtitle="Income minus expenses by month."
        icon={TrendingUp}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Income" value={fmtMoney(totals.income)} tone="green" />
        <StatCard label="Expense" value={fmtMoney(totals.expense)} tone="red" />
        <StatCard
          label="Net profit"
          value={fmtMoney(totals.profit)}
          tone={totals.profit >= 0 ? 'green' : 'red'}
        />
      </div>

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Period</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Income
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Expense
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Profit
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
                    No data.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.period} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {r.period}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-emerald-500">
                      {fmtMoney(r.income)}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-destructive">
                      {fmtMoney(r.expense)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-[13px] font-medium ${
                        r.profit >= 0 ? 'text-emerald-500' : 'text-destructive'
                      }`}
                    >
                      {fmtMoney(r.profit)}
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
