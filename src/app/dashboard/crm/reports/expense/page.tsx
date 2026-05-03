export const dynamic = 'force-dynamic';

import { Receipt } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  BarRow,
  fmtMoney,
} from '../_components/report-toolbar';
import { getExpenseByPeriod } from '@/app/actions/worksuite/reports.actions';

export default async function ExpenseReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const { byPeriod, byCategory } = await getExpenseByPeriod(sp.from, sp.to);

  const total = byPeriod.reduce((s, r) => s + r.total, 0);
  const count = byPeriod.reduce((s, r) => s + r.count, 0);
  const maxP = byPeriod.reduce((m, r) => Math.max(m, r.total), 0);
  const maxC = byCategory.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Expense Report"
        subtitle="Expenses by month and category."
        icon={Receipt}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total expenses" value={fmtMoney(total)} tone="red" />
        <StatCard label="Entries" value={String(count)} />
        <StatCard label="Categories" value={String(byCategory.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">By month</h2>
          </div>
          {byPeriod.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No expenses.
            </div>
          ) : (
            byPeriod.map((r) => (
              <BarRow
                key={r.period}
                label={r.period}
                value={r.total}
                max={maxP}
                rightLabel={fmtMoney(r.total)}
                tone="red"
              />
            ))
          )}
        </ClayCard>

        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By category
            </h2>
          </div>
          {byCategory.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No expense categories.
            </div>
          ) : (
            byCategory.map((r) => (
              <BarRow
                key={r.category}
                label={r.category}
                value={r.total}
                max={maxC}
                rightLabel={fmtMoney(r.total)}
                tone="amber"
              />
            ))
          )}
        </ClayCard>
      </div>
    </div>
  );
}
