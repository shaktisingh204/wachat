'use client';

import * as React from 'react';
import { Plane } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getTravelRequests,
  saveTravelRequest,
  deleteTravelRequest,
} from '@/app/actions/hr.actions';
import type { HrTravelRequest } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  completed: 'neutral',
  cancelled: 'neutral',
};

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function TravelPage() {
  return (
    <HrEntityPage<HrTravelRequest & { _id: string }>
      title="Travel Requests"
      subtitle="Business trip requests and approvals."
      icon={Plane}
      singular="Travel Request"
      basePath="/dashboard/crm/hr/travel"
      getAllAction={getTravelRequests as any}
      saveAction={saveTravelRequest}
      deleteAction={deleteTravelRequest}
      columns={[
        { key: 'destination', label: 'Destination' },
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
          key: 'fromDate',
          label: 'From',
          render: (row) => formatDate(row.fromDate),
        },
        {
          key: 'toDate',
          label: 'To',
          render: (row) => formatDate(row.toDate),
        },
        { key: 'mode', label: 'Mode' },
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
