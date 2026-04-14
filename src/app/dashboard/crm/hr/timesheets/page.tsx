'use client';

import { Clock } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getTimesheets,
  saveTimesheet,
  deleteTimesheet,
} from '@/app/actions/hr.actions';
import type { HrTimesheet } from '@/lib/hr-types';

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
      getAllAction={getTimesheets as any}
      saveAction={saveTimesheet}
      deleteAction={deleteTimesheet}
      columns={[
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">{String(row.employeeId)}</span>
          ),
        },
        {
          key: 'weekStart',
          label: 'Week Start',
          render: (row) => formatDate(row.weekStart),
        },
        { key: 'totalHours', label: 'Total Hours' },
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
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'weekStart', label: 'Week Start', type: 'date', required: true },
        { name: 'totalHours', label: 'Total Hours', type: 'number', required: true },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'submitted', label: 'Submitted' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ],
          defaultValue: 'draft',
        },
        {
          name: 'entries',
          label: 'Entries',
          type: 'array',
          fullWidth: true,
          addLabel: 'Add Entry',
          subFields: [
            {
              name: 'day',
              label: 'Day',
              type: 'select',
              options: [
                { value: 'Mon', label: 'Mon' },
                { value: 'Tue', label: 'Tue' },
                { value: 'Wed', label: 'Wed' },
                { value: 'Thu', label: 'Thu' },
                { value: 'Fri', label: 'Fri' },
                { value: 'Sat', label: 'Sat' },
                { value: 'Sun', label: 'Sun' },
              ],
            },
            { name: 'hours', label: 'Hours', type: 'number', required: true },
            { name: 'project', label: 'Project', type: 'text' },
            { name: 'notes', label: 'Notes', type: 'text' },
          ],
        },
      ]}
    />
  );
}
