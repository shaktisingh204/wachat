export const dynamic = 'force-dynamic';

import { FolderKanban } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { StatCard, BarRow } from '../_components/report-toolbar';
import { getProjectStatusReport } from '@/app/actions/worksuite/reports.actions';

export default async function ProjectStatusReportPage() {
  const rows = await getProjectStatusReport();
  const total = rows.reduce((s, r) => s + r.count, 0);
  const maxC = rows.reduce((m, r) => Math.max(m, r.count), 0);
  const avgCompletion =
    rows.length
      ? Math.round(
          rows.reduce((s, r) => s + r.completion * r.count, 0) /
            Math.max(1, total),
        )
      : 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Project Status"
        subtitle="Projects grouped by status with average completion."
        icon={FolderKanban}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total projects" value={String(total)} />
        <StatCard label="Statuses" value={String(rows.length)} />
        <StatCard
          label="Avg completion"
          value={`${avgCompletion}%`}
          tone="green"
        />
      </div>

      <ClayCard>
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">By status</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            No projects.
          </div>
        ) : (
          rows.map((r) => (
            <BarRow
              key={r.status}
              label={`${r.status} — ${r.completion}% avg`}
              value={r.count}
              max={maxC}
              rightLabel={String(r.count)}
              tone="rose"
            />
          ))
        )}
      </ClayCard>
    </div>
  );
}
