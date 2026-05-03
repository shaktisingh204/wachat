export const dynamic = 'force-dynamic';

import { Timer } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { ReportToolbar, StatCard, BarRow } from '../_components/report-toolbar';
import { getLateArrivals } from '@/app/actions/worksuite/reports.actions';

export default async function LateReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getLateArrivals(sp.from, sp.to);
  const totalLate = rows.reduce((s, r) => s + r.lateCount, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.lateCount), 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Late Arrivals"
        subtitle="Employees arriving after the shift start (9:15am grace)."
        icon={Timer}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Late instances" value={String(totalLate)} tone="red" />
        <StatCard label="Employees affected" value={String(rows.length)} />
      </div>

      <ClayCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">
            By employee
          </h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            No late arrivals in this range.
          </div>
        ) : (
          rows.map((r) => (
            <BarRow
              key={r.employeeId}
              label={r.employeeName}
              value={r.lateCount}
              max={max}
              rightLabel={String(r.lateCount)}
              tone="red"
            />
          ))
        )}
      </ClayCard>
    </div>
  );
}
