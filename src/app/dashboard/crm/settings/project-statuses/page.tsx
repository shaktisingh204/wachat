'use client';

import { Flag } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import { ClayBadge } from '@/components/clay';
import {
  getProjectStatusSettings,
  saveProjectStatusSetting,
  deleteProjectStatusSetting,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsProjectStatusSetting } from '@/lib/worksuite/module-settings-types';

/**
 * Project Status catalog — user-defined status options that show up
 * in project select menus and Kanban columns. Terminal states are
 * flagged via `is_final` for reporting; one row may be marked default.
 */
export default function ProjectStatusesPage() {
  return (
    <HrEntityPage<WsProjectStatusSetting & { _id: string }>
      title="Project Statuses"
      subtitle="Available status options that classify projects across boards and reports."
      icon={Flag}
      singular="Status"
      getAllAction={getProjectStatusSettings as any}
      saveAction={saveProjectStatusSetting}
      deleteAction={deleteProjectStatusSetting}
      columns={[
        { key: 'status_name', label: 'Name' },
        { key: 'slug', label: 'Slug' },
        {
          key: 'color',
          label: 'Color',
          render: (row) =>
            row.color ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded-full border border-clay-border"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-[12px] text-clay-ink-muted">{row.color}</span>
              </span>
            ) : (
              '—'
            ),
        },
        {
          key: 'priority',
          label: 'Priority',
          render: (row) => (row.priority != null ? String(row.priority) : '—'),
        },
        {
          key: 'is_final',
          label: 'Final',
          render: (row) => (
            <ClayBadge tone={row.is_final ? 'amber' : 'neutral'}>
              {row.is_final ? 'Yes' : 'No'}
            </ClayBadge>
          ),
        },
        {
          key: 'is_default',
          label: 'Default',
          render: (row) => (
            <ClayBadge tone={row.is_default ? 'green' : 'neutral'}>
              {row.is_default ? 'Yes' : 'No'}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'status_name', label: 'Status Name', required: true, placeholder: 'In Progress' },
        { name: 'slug', label: 'Slug', placeholder: 'in-progress' },
        { name: 'color', label: 'Color (hex)', placeholder: '#F59E0B' },
        { name: 'priority', label: 'Sort Priority', type: 'number', defaultValue: '10' },
        {
          name: 'is_final',
          label: 'Terminal State',
          type: 'select',
          defaultValue: 'no',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
        },
        {
          name: 'is_default',
          label: 'Default Status',
          type: 'select',
          defaultValue: 'no',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
        },
      ]}
    />
  );
}
