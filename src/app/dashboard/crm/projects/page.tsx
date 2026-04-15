'use client';

import Link from 'next/link';
import {
  Briefcase,
  LayoutGrid,
  GanttChart,
  Flag,
  FolderOpen,
  Tag,
  Bug,
  Activity,
  Columns3,
  Tags,
  ListChecks,
} from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getWsProjects,
  saveWsProject,
  deleteWsProject,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProject } from '@/lib/worksuite/project-types';
import { ClayButton } from '@/components/clay';

const STATUS_TONES: Record<
  string,
  'neutral' | 'green' | 'amber' | 'red' | 'blue'
> = {
  planning: 'amber',
  'not started': 'amber',
  'in progress': 'blue',
  active: 'green',
  'on hold': 'amber',
  'on-hold': 'amber',
  finished: 'green',
  completed: 'blue',
  canceled: 'red',
  cancelled: 'red',
};

const PRIORITY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const QUICK_LINKS: {
  href: string;
  label: string;
  icon: React.ElementType;
}[] = [
  { href: '/dashboard/crm/projects/kanban', label: 'Kanban', icon: LayoutGrid },
  { href: '/dashboard/crm/projects/gantt', label: 'Gantt', icon: GanttChart },
  {
    href: '/dashboard/crm/projects/milestones',
    label: 'Milestones',
    icon: Flag,
  },
  {
    href: '/dashboard/crm/projects/categories',
    label: 'Categories',
    icon: FolderOpen,
  },
  { href: '/dashboard/crm/projects/labels', label: 'Labels', icon: Tag },
  { href: '/dashboard/crm/projects/issues', label: 'Issues', icon: Bug },
  {
    href: '/dashboard/crm/projects/activity',
    label: 'Activity',
    icon: Activity,
  },
  {
    href: '/dashboard/crm/projects/taskboard-columns',
    label: 'Columns',
    icon: Columns3,
  },
  {
    href: '/dashboard/crm/projects/task-categories',
    label: 'Task Cats',
    icon: FolderOpen,
  },
  {
    href: '/dashboard/crm/projects/task-labels',
    label: 'Task Labels',
    icon: Tag,
  },
  {
    href: '/dashboard/crm/projects/task-tags',
    label: 'Task Tags',
    icon: Tags,
  },
  {
    href: '/dashboard/crm/projects/subtasks',
    label: 'Sub-Tasks',
    icon: ListChecks,
  },
];

export default function ProjectsPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        {QUICK_LINKS.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.href} href={q.href}>
              <ClayButton
                variant="pill"
                leading={<Icon className="h-4 w-4" strokeWidth={1.75} />}
              >
                {q.label}
              </ClayButton>
            </Link>
          );
        })}
      </div>

      <HrEntityPage<WsProject & { _id: string }>
        title="Projects"
        subtitle="Manage client projects, timelines, budgets and team delivery."
        icon={Briefcase}
        singular="Project"
        getAllAction={getWsProjects as any}
        saveAction={saveWsProject}
        deleteAction={deleteWsProject}
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (row) => (
              <Link
                href={`/dashboard/crm/projects/${row._id}`}
                className="font-medium text-clay-ink hover:underline"
              >
                {row.name || row.projectName || '—'}
              </Link>
            ),
          },
          { key: 'clientName', label: 'Client' },
          { key: 'categoryName', label: 'Category' },
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
            key: 'priority',
            label: 'Priority',
            render: (row) =>
              row.priority ? (
                <ClayBadge tone={PRIORITY_TONES[row.priority] || 'neutral'} dot>
                  {row.priority}
                </ClayBadge>
              ) : (
                '—'
              ),
          },
          {
            key: 'completionPercent',
            label: 'Progress',
            render: (row) =>
              `${row.completionPercent ?? row.progress ?? 0}%`,
          },
          {
            key: 'startDate',
            label: 'Start',
            render: (row) => fmtDate(row.startDate),
          },
          {
            key: 'deadline',
            label: 'Deadline',
            render: (row) => fmtDate(row.deadline || row.endDate),
          },
          {
            key: 'projectBudget',
            label: 'Budget',
            render: (row) =>
              row.projectBudget != null || row.budget != null
                ? `${row.currency || 'INR'} ${row.projectBudget ?? row.budget}`
                : '—',
          },
          { key: 'managerName', label: 'Manager' },
        ]}
        fields={[
          {
            name: 'name',
            label: 'Project Name',
            required: true,
            fullWidth: true,
          },
          { name: 'clientName', label: 'Client Name' },
          { name: 'managerName', label: 'Manager Name' },
          { name: 'categoryName', label: 'Category' },
          { name: 'subCategoryName', label: 'Sub-Category' },
          { name: 'departmentName', label: 'Department' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            required: true,
            options: [
              { value: 'not started', label: 'Not Started' },
              { value: 'in progress', label: 'In Progress' },
              { value: 'on hold', label: 'On Hold' },
              { value: 'finished', label: 'Finished' },
              { value: 'canceled', label: 'Canceled' },
            ],
            defaultValue: 'not started',
          },
          {
            name: 'priority',
            label: 'Priority',
            type: 'select',
            options: [
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ],
            defaultValue: 'medium',
          },
          {
            name: 'completionPercent',
            label: 'Completion %',
            type: 'number',
          },
          { name: 'projectBudget', label: 'Project Budget', type: 'number' },
          { name: 'currency', label: 'Currency', defaultValue: 'INR' },
          { name: 'hoursAllocated', label: 'Hours Allocated', type: 'number' },
          { name: 'startDate', label: 'Start Date', type: 'date' },
          { name: 'deadline', label: 'Deadline', type: 'date' },
          {
            name: 'projectShortCode',
            label: 'Short Code',
            placeholder: 'e.g. PRJ-001',
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            fullWidth: true,
          },
          {
            name: 'notes',
            label: 'Notes',
            type: 'textarea',
            fullWidth: true,
          },
        ]}
      />
    </div>
  );
}
