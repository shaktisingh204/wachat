export const dynamic = 'force-dynamic';

import { ListChecks } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { ReportToolbar, StatCard, BarRow } from '../_components/report-toolbar';
import { getTaskReport } from '@/app/actions/worksuite/reports.actions';

export default async function TaskReportPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const report = await getTaskReport(sp);

  const maxA = report.byAssignee.reduce((m, r) => Math.max(m, r.count), 0);
  const maxS = report.byStatus.reduce((m, r) => Math.max(m, r.count), 0);
  const maxP = report.byPriority.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Task Report"
        subtitle="Tasks grouped by assignee, status and priority."
        icon={ListChecks}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total tasks" value={String(report.total)} />
        <StatCard label="Assignees" value={String(report.byAssignee.length)} />
        <StatCard label="Statuses" value={String(report.byStatus.length)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By assignee
            </h2>
          </div>
          {report.byAssignee.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              No tasks.
            </div>
          ) : (
            report.byAssignee.map((r) => (
              <BarRow
                key={r.bucket}
                label={r.bucket}
                value={r.count}
                max={maxA}
                rightLabel={String(r.count)}
                tone="rose"
              />
            ))
          )}
        </ClayCard>

        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By status
            </h2>
          </div>
          {report.byStatus.map((r) => (
            <BarRow
              key={r.bucket}
              label={r.bucket}
              value={r.count}
              max={maxS}
              rightLabel={String(r.count)}
              tone="obsidian"
            />
          ))}
        </ClayCard>

        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By priority
            </h2>
          </div>
          {report.byPriority.map((r) => (
            <BarRow
              key={r.bucket}
              label={r.bucket}
              value={r.count}
              max={maxP}
              rightLabel={String(r.count)}
              tone="amber"
            />
          ))}
        </ClayCard>
      </div>
    </div>
  );
}
