'use client';

import * as React from 'react';
import { MessagesSquare } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getOneOnOnes,
  saveOneOnOne,
  deleteOneOnOne,
} from '@/app/actions/hr.actions';
import type { HrOneOnOne } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  scheduled: 'amber',
  completed: 'green',
  cancelled: 'neutral',
  rescheduled: 'amber',
};

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function OneOnOnesPage() {
  return (
    <HrEntityPage<HrOneOnOne & { _id: string }>
      title="One-on-Ones"
      subtitle="Scheduled check-ins between managers and direct reports."
      icon={MessagesSquare}
      singular="1:1"
      basePath="/dashboard/hrm/hr/one-on-ones"
      getAllAction={getOneOnOnes as any}
      saveAction={saveOneOnOne}
      deleteAction={deleteOneOnOne}
      columns={[
        {
          key: 'manager_id',
          label: 'Manager',
          render: (row) => (
            <span className="block max-w-[140px] truncate">
              {(row as any).manager_id || (row as any).managerName || '—'}
            </span>
          ),
        },
        {
          key: 'employee_id',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[140px] truncate">
              {(row as any).employee_id || String(row.employeeId) || '—'}
            </span>
          ),
        },
        {
          key: 'scheduled_date',
          label: 'Scheduled',
          render: (row) =>
            formatDate((row as any).scheduled_date ?? (row as any).scheduledAt),
        },
        {
          key: 'duration_minutes',
          label: 'Duration',
          render: (row) => {
            const min =
              (row as any).duration_minutes ?? (row as any).durationMinutes;
            return min != null ? (
              <span className="tabular-nums text-muted-foreground">{min}m</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
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
      ]}
      fields={fields}
    />
  );
}
