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
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function OneOnOnesPage() {
  return (
    <HrEntityPage<HrOneOnOne & { _id: string }>
      title="One-on-Ones"
      subtitle="Scheduled check-ins between managers and reports."
      icon={MessagesSquare}
      singular="1:1"
      basePath="/dashboard/crm/hr/one-on-ones"
      getAllAction={getOneOnOnes as any}
      saveAction={saveOneOnOne}
      deleteAction={deleteOneOnOne}
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
        { key: 'managerName', label: 'Manager' },
        {
          key: 'scheduledAt',
          label: 'Scheduled',
          render: (row) => formatDate(row.scheduledAt),
        },
        { key: 'mood', label: 'Mood' },
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
