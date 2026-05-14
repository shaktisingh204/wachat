'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

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
  if (!value) return <span className="text-muted-foreground">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function TimesheetsPage() {
  return (
    <HrEntityPage<HrTimesheet & { _id: string }>
      title="Timesheets"
      subtitle="Weekly hours logged per employee."
      icon={Clock}
      singular="Timesheet"
      basePath="/dashboard/hrm/hr/timesheets"
      rowLinksToDetail
      getAllAction={getTimesheets as any}
      saveAction={saveTimesheet}
      deleteAction={deleteTimesheet}
      kpis={[
        {
          label: 'Submitted this week',
          compute: (rows) => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return rows.filter((r) => {
              const ws = (r as any).weekStart ? new Date((r as any).weekStart) : null;
              return (
                String((r as any).status) === 'submitted' &&
                ws &&
                !isNaN(ws.getTime()) &&
                ws >= weekAgo
              );
            }).length;
          },
        },
        {
          label: 'Pending approval',
          compute: (rows) =>
            rows.filter((r) => String((r as any).status) === 'submitted').length,
          tone: 'amber',
        },
        {
          label: 'Approved',
          compute: (rows) =>
            rows.filter((r) => String((r as any).status) === 'approved').length,
          tone: 'green',
        },
        {
          label: 'Total hours',
          compute: (rows) =>
            rows.reduce((a, r) => a + (Number((r as any).totalHours) || 0), 0),
        },
        {
          label: 'Billable hours',
          compute: (rows) =>
            rows.reduce(
              (a, r) => a + (Number((r as any).billableHours) || 0),
              0,
            ),
          tone: 'blue',
        },
      ]}
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
