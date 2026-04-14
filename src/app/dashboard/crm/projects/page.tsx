'use client';

import Link from 'next/link';
import { Briefcase, LayoutGrid, GanttChart } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../hr/_components/hr-entity-page';
import {
  getProjects,
  saveProject,
  deleteProject,
} from '@/app/actions/crm-services.actions';
import type { HrProject } from '@/lib/hr-types';
import { ClayButton } from '@/components/clay';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  planning: 'amber',
  active: 'green',
  'on-hold': 'amber',
  completed: 'blue',
  cancelled: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ProjectsPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Link href="/dashboard/crm/projects/kanban">
          <ClayButton
            variant="pill"
            leading={<LayoutGrid className="h-4 w-4" strokeWidth={1.75} />}
          >
            Kanban
          </ClayButton>
        </Link>
        <Link href="/dashboard/crm/projects/gantt">
          <ClayButton
            variant="pill"
            leading={<GanttChart className="h-4 w-4" strokeWidth={1.75} />}
          >
            Gantt
          </ClayButton>
        </Link>
      </div>

      <HrEntityPage<HrProject & { _id: string }>
        title="Projects"
        subtitle="Manage client projects, timelines, and delivery."
        icon={Briefcase}
        singular="Project"
        getAllAction={getProjects as any}
        saveAction={saveProject}
        deleteAction={deleteProject}
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (row) => (
              <Link
                href={`/dashboard/crm/projects/${row._id}`}
                className="font-medium text-clay-ink hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          { key: 'clientName', label: 'Client' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
                {row.status}
              </ClayBadge>
            ),
          },
          {
            key: 'progress',
            label: 'Progress',
            render: (row) => `${row.progress ?? 0}%`,
          },
          {
            key: 'startDate',
            label: 'Start',
            render: (row) => fmtDate(row.startDate),
          },
          {
            key: 'endDate',
            label: 'End',
            render: (row) => fmtDate(row.endDate),
          },
          { key: 'managerName', label: 'Manager' },
        ]}
        fields={[
          { name: 'name', label: 'Project Name', required: true, fullWidth: true },
          { name: 'clientName', label: 'Client Name' },
          { name: 'managerName', label: 'Manager Name' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            required: true,
            options: [
              { value: 'planning', label: 'Planning' },
              { value: 'active', label: 'Active' },
              { value: 'on-hold', label: 'On Hold' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
            defaultValue: 'planning',
          },
          { name: 'progress', label: 'Progress (%)', type: 'number' },
          { name: 'budget', label: 'Budget', type: 'number' },
          { name: 'currency', label: 'Currency', defaultValue: 'INR' },
          { name: 'startDate', label: 'Start Date', type: 'date' },
          { name: 'endDate', label: 'End Date', type: 'date' },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            fullWidth: true,
          },
        ]}
      />
    </div>
  );
}
