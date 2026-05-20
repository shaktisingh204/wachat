export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getOverdueTasksDeep } from '@/app/actions/worksuite/reports.actions';
import { OverdueTasksClient } from './_components/overdue-tasks-client';

export default async function OverdueTasksPage(props: {
  searchParams: Promise<{
    priority?: string;
    minDays?: string;
    maxDays?: string;
  }>;
}) {
  const sp = await props.searchParams;

  const data = await getOverdueTasksDeep({
    priority: sp.priority || undefined,
    minDaysOverdue: sp.minDays ? Number(sp.minDays) : undefined,
    maxDaysOverdue: sp.maxDays ? Number(sp.maxDays) : undefined,
  });

  return (
    <EntityListShell
      title="Overdue Tasks"
      subtitle="Open tasks that are past their due date, grouped by assignee."
    >
      <OverdueTasksClient
        data={data}
        filters={{
          priority: sp.priority,
          minDays: sp.minDays,
          maxDays: sp.maxDays,
        }}
      />
    </EntityListShell>
  );
}
