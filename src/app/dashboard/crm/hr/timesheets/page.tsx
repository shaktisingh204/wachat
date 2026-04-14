'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getTimesheets,
  saveTimesheet,
  deleteTimesheet,
} from '@/app/actions/hr.actions';
import type { HrTimesheet } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  draft: 'neutral',
  submitted: 'amber',
  approved: 'green',
  rejected: 'red',
};

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function TimesheetsPage() {
  return (
    <HrEntityPage<HrTimesheet & { _id: string }>
      title="Timesheets"
      subtitle="Weekly hours logged per employee."
      icon={Clock}
      singular="Timesheet"
      basePath="/dashboard/crm/hr/timesheets"
      getAllAction={getTimesheets as any}
      saveAction={saveTimesheet}
      deleteAction={deleteTimesheet}
      columns={[
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">
              {String(row.employeeId)}
            </span>
          ),
        },
        {
          key: 'weekStart',
          label: 'Week Start',
          render: (row) => formatDate(row.weekStart),
        },
        { key: 'totalHours', label: 'Total Hours' },
        { key: 'billableHours', label: 'Billable' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
