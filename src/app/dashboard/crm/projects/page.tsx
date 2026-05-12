'use client';

import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import { EntityPickerChip } from '@/components/crm/entity-picker';
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
          {
            key: 'clientName',
            label: 'Client',
            render: (row) =>
              row.clientId ? (
                <EntityPickerChip
                  entity="client"
                  id={String(row.clientId)}
                  fallback={row.clientName}
                />
              ) : (
                row.clientName || '—'
              ),
          },
          {
            key: 'categoryName',
            label: 'Category',
            render: (row) =>
              row.categoryId ? (
                <EntityPickerChip
                  entity="category"
                  id={String(row.categoryId)}
                  fallback={row.categoryName}
                />
              ) : (
                row.categoryName || '—'
              ),
          },
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
          {
            key: 'managerName',
            label: 'Manager',
            render: (row) =>
              row.projectAdmin ? (
                <EntityPickerChip
                  entity="user"
                  id={String(row.projectAdmin)}
                  fallback={row.managerName}
                />
              ) : (
                row.managerName || '—'
              ),
          },
        ]}
        fields={[
          {
            name: 'name',
            label: 'Project Name',
            required: true,
            fullWidth: true,
          },
          {
            name: 'clientId',
            label: 'Client',
            type: 'entity',
            entity: 'client',
            dualWriteName: 'clientName',
            allowCreate: true,
          },
          {
            name: 'projectAdmin',
            label: 'Manager',
            type: 'entity',
            entity: 'user',
            dualWriteName: 'managerName',
          },
          {
            name: 'categoryId',
            label: 'Category',
            type: 'entity',
            entity: 'category',
            dualWriteName: 'categoryName',
            allowCreate: true,
          },
          {
            name: 'subCategoryId',
            label: 'Sub-Category',
            type: 'entity',
            entity: 'category',
            dualWriteName: 'subCategoryName',
            allowCreate: true,
          },
          {
            name: 'departmentId',
            label: 'Department',
            type: 'entity',
            entity: 'department',
            dualWriteName: 'departmentName',
            allowCreate: true,
          },
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
          {
            name: 'currency',
            label: 'Currency',
            type: 'entity',
            entity: 'currency',
            defaultValue: 'INR',
          },
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
