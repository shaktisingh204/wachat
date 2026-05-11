import { CheckSquare, Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ZoruBadge,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type AnyTask = {
  _id?: { toString(): string } | string;
  title?: string;
  type?: string; // call/email/meeting/todo/follow-up
  status?: string; // open/in-progress/done/cancelled
  priority?: string; // low/medium/high/critical
  assignee?: string;
  dueDate?: string | Date;
  linkedEntity?: string; // lead/deal/client/ticket/invoice
  linkedEntityId?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function getPriorityVariant(priority?: string): 'danger' | 'warning' | 'ghost' {
  const p = (priority || '').toLowerCase();
  if (p === 'high' || p === 'critical') return 'danger';
  if (p === 'medium') return 'warning';
  return 'ghost';
}

function getStatusVariant(status?: string): 'success' | 'ghost' | 'warning' | 'danger' {
  const s = (status || '').toLowerCase();
  if (s === 'done') return 'success';
  if (s === 'open') return 'ghost';
  if (s === 'in-progress') return 'warning';
  if (s === 'cancelled') return 'danger';
  return 'ghost';
}

export default async function CrmTasksPage() {
  const session = await getSession();
  let tasks: AnyTask[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_tasks')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      tasks = JSON.parse(JSON.stringify(docs)) as AnyTask[];
    } catch (e) {
      console.error('Failed to load crm_tasks:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Tasks"
        subtitle="Calls, meetings, follow-ups and to-dos across your CRM."
        icon={CheckSquare}
        actions={
          <Link
            href="/dashboard/crm/sales-crm/tasks/new"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New task
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All tasks</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Calls, meetings, follow-ups and to-dos linked to your CRM records.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Priority</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Due Date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Assignee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load tasks. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : tasks.length > 0 ? (
                tasks.map((task, idx) => {
                  const id =
                    typeof task._id === 'string'
                      ? task._id
                      : (task._id as any)?.toString?.() ?? String(idx);
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        {task.title || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] capitalize text-zoru-ink">
                        {task.type || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getPriorityVariant(task.priority)}>
                          {task.priority || 'low'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {formatDate(task.dueDate)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {task.assignee || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(task.status)}>
                          {task.status || 'open'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No tasks yet. Create tasks to track calls, meetings and follow-ups.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
