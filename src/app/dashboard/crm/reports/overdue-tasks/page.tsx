import { ZoruBadge, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatCard } from '../_components/report-toolbar';

import { getOverdueTasks } from '@/app/actions/worksuite/reports.actions';

export default async function OverdueTasksPage() {
  const rows = await getOverdueTasks();

  const priorityTone: Record<string, 'red' | 'amber' | 'neutral'> = {
    High: 'red',
    Medium: 'amber',
    Low: 'neutral',
  };

  return (
    <EntityListShell title="Overdue Tasks" subtitle="Open tasks past their due date.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Overdue tasks" value={String(rows.length)} tone="red" />
        <StatCard
          label="High priority"
          value={String(rows.filter((r) => r.priority === 'High').length)}
          tone="amber"
        />
      </div>

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Task</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Due</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Assignee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Priority</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No overdue tasks — nice!
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r) => (
                  <ZoruTableRow key={r._id} className="border-border">
                    <ZoruTableCell className="font-medium text-foreground">
                      {r.title}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-destructive">
                      {r.dueDate ? format(new Date(r.dueDate), 'PP') : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.assignedTo || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px]">
                      <ZoruBadge variant={(priorityTone[r.priority] || 'neutral') as any}>
                        {r.priority}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {r.status}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
