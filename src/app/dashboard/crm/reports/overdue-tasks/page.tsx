export const dynamic = 'force-dynamic';

import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ClayBadge, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { StatCard } from '../_components/report-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getOverdueTasks } from '@/app/actions/worksuite/reports.actions';

export default async function OverdueTasksPage() {
  const rows = await getOverdueTasks();

  const priorityTone: Record<string, 'red' | 'amber' | 'neutral'> = {
    High: 'red',
    Medium: 'amber',
    Low: 'neutral',
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Overdue Tasks"
        subtitle="Open tasks past their due date."
        icon={AlertTriangle}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Overdue tasks" value={String(rows.length)} tone="red" />
        <StatCard
          label="High priority"
          value={String(rows.filter((r) => r.priority === 'High').length)}
          tone="amber"
        />
      </div>

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Task</TableHead>
                <TableHead className="text-muted-foreground">Due</TableHead>
                <TableHead className="text-muted-foreground">Assignee</TableHead>
                <TableHead className="text-muted-foreground">Priority</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No overdue tasks — nice!
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r._id} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {r.title}
                    </TableCell>
                    <TableCell className="text-[13px] text-destructive">
                      {r.dueDate ? format(new Date(r.dueDate), 'PP') : '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-foreground">
                      {r.assignedTo || '—'}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <ClayBadge tone={priorityTone[r.priority] || 'neutral'}>
                        {r.priority}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-[13px] text-foreground">
                      {r.status}
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
