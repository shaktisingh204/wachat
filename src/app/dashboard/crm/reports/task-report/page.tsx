export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTaskReportDeep } from '@/app/actions/worksuite/reports.actions';
import { TaskReportClient } from './_components/task-report-client';

export default async function TaskReportPage(props: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    from?: string;
    to?: string;
    tags?: string;
  }>;
}) {
  const sp = await props.searchParams;

  const data = await getTaskReportDeep({
    status: sp.status || undefined,
    priority: sp.priority || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    // Add tags if backend supports it or pass it. The action might need update or it ignores unknown keys.
    tags: sp.tags || undefined,
  } as any);

  return (
    <EntityListShell
      title="Task Report"
      subtitle="Task completion rates, trends per week, and per-task details."
    >
      <TaskReportClient
        data={data}
        filters={{
          status: sp.status,
          priority: sp.priority,
          from: sp.from,
          to: sp.to,
          tags: sp.tags,
        }}
      />
    </EntityListShell>
  );
}
