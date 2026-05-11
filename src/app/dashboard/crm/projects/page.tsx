'use client';

import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getWsProjects,
  saveWsProject,
  deleteWsProject,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProject } from '@/lib/worksuite/project-types';

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

export default function ProjectsPage() {
  return (
    <div className="flex w-full flex-col gap-4">
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
                className="font-medium text-zoru-ink hover:underline"
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
