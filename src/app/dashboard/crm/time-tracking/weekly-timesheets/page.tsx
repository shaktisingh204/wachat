'use client';

import Link from 'next/link';
import { CalendarRange } from 'lucide-react';

import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWeeklyTimesheets,
  saveWeeklyTimesheet,
  deleteWeeklyTimesheet,
} from '@/app/actions/worksuite/time.actions';
import type {
  WsWeeklyTimesheet,
  WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

const TONES: Record<WsWeeklyTimesheetStatus, 'neutral' | 'green' | 'amber' | 'red'> = {
  draft: 'neutral',
  submitted: 'amber',
  approved: 'green',
  rejected: 'red',
};

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

type Row = WsWeeklyTimesheet & { _id: string };

export default function WeeklyTimesheetsPage() {
  return (
    <HrEntityPage<Row>
      title="Weekly Timesheets"
      subtitle="Per-employee weekly grids of logged hours. Submit, approve, or reject."
      icon={CalendarRange}
      singular="Timesheet"
      getAllAction={getWeeklyTimesheets as unknown as () => Promise<Row[]>}
      saveAction={saveWeeklyTimesheet}
      deleteAction={deleteWeeklyTimesheet}
      columns={[
        {
          key: 'user_id',
          label: 'Employee',
          render: (row) => (
            <Link
              href={`/dashboard/crm/time-tracking/weekly-timesheets/${row._id}`}
              className="hover:underline"
            >
              {row.user_id ? String(row.user_id) : '—'}
            </Link>
          ),
        },
        {
          key: 'week_start_date',
          label: 'Week Start',
          render: (row) => fmtDate(row.week_start_date),
        },
        {
          key: 'week_end_date',
          label: 'Week End',
          render: (row) => fmtDate(row.week_end_date),
        },
        {
          key: 'total_hours',
          label: 'Total',
          render: (row) =>
            `${row.total_hours || 0}h ${String(row.total_minutes || 0).padStart(2, '0')}m`,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'user_id', label: 'Employee ID', required: true },
        {
          name: 'week_start_date',
          label: 'Week Start',
          type: 'date',
          required: true,
        },
        {
          name: 'week_end_date',
          label: 'Week End',
          type: 'date',
          required: true,
        },
        { name: 'total_hours', label: 'Total Hours', type: 'number' },
        { name: 'total_minutes', label: 'Total Minutes', type: 'number' },
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
        { name: 'reason', label: 'Reason (if rejected)', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
