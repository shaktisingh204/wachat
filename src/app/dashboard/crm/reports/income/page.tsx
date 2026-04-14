export const dynamic = 'force-dynamic';

import { Wallet } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  BarRow,
  fmtMoney,
} from '../_components/report-toolbar';
import { getIncomeByPeriod } from '@/app/actions/worksuite/reports.actions';

export default async function IncomeReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string; clientId?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getIncomeByPeriod(sp.from, sp.to, 'month', sp.clientId);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const count = rows.reduce((s, r) => s + r.count, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
  const avg = rows.length ? total / rows.length : 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Income Report"
        subtitle="Revenue by month from paid and partially paid invoices."
        icon={Wallet}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total income" value={fmtMoney(total)} tone="green" />
        <StatCard label="Invoices" value={String(count)} />
        <StatCard label="Monthly average" value={fmtMoney(avg)} />
      </div>

      <ClayCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-clay-ink">By month</h2>
          <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
            Grouped by invoice date.
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-clay-ink-muted">
            No income for the selected range.
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((r) => (
              <BarRow
                key={r.period}
                label={r.period}
                value={r.total}
                max={max}
                rightLabel={fmtMoney(r.total)}
                tone="rose"
              />
            ))}
          </div>
        )}
      </ClayCard>
    </div>
  );
}
