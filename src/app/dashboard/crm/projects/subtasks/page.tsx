'use client';

import { ListChecks } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsSubTasks,
  saveWsSubTask,
  deleteWsSubTask,
} from '@/app/actions/worksuite/projects.actions';
import type { WsSubTask } from '@/lib/worksuite/project-types';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'blue' | 'green'> = {
  incomplete: 'neutral',
  todo: 'neutral',
  'in-progress': 'blue',
  review: 'amber',
  completed: 'green',
  done: 'green',
};

export default function SubTasksPage() {
  return (
    <HrEntityPage<WsSubTask & { _id: string }>
      title="Sub-Tasks"
      subtitle="Break tasks down into smaller actionable items."
      icon={ListChecks}
      singular="Sub-Task"
      getAllAction={getWsSubTasks as any}
      saveAction={saveWsSubTask}
      deleteAction={deleteWsSubTask}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'taskId', label: 'Parent Task', render: (r) => String(r.taskId) },
        { key: 'assignedToName', label: 'Assignee' },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (
            <ClayBadge tone={STATUS_TONES[r.status] || 'neutral'} dot>
              {r.status}
            </ClayBadge>
          ),
        },
        { key: 'dueDate', label: 'Due', render: (r) => fmtDate(r.dueDate) },
      ]}
      fields={[
        { name: 'taskId', label: 'Parent Task ID', required: true },
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        { name: 'assignedToName', label: 'Assignee Name' },
        { name: 'startDate', label: 'Start Date', type: 'date' },
        { name: 'dueDate', label: 'Due Date', type: 'date' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'incomplete', label: 'Incomplete' },
            { value: 'todo', label: 'To Do' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'review', label: 'Review' },
            { value: 'completed', label: 'Completed' },
          ],
          defaultValue: 'incomplete',
        },
      ]}
    />
  );
}
