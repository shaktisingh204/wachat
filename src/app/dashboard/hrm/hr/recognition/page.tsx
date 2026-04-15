'use client';

import { Award } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getRecognitions,
  saveRecognition,
  deleteRecognition,
} from '@/app/actions/hr.actions';
import type { HrRecognition } from '@/lib/hr-types';
import { fields } from './_config';

export default function RecognitionPage() {
  return (
    <HrEntityPage<HrRecognition & { _id: string }>
      title="Recognition"
      subtitle="Kudos, spot awards, and peer recognition."
      icon={Award}
      singular="Recognition"
      basePath="/dashboard/hrm/hr/recognition"
      getAllAction={getRecognitions as any}
      saveAction={saveRecognition}
      deleteAction={deleteRecognition}
      columns={[
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">{String(row.employeeId)}</span>
          ),
        },
        { key: 'fromName', label: 'Recognized By' },
        {
          key: 'type',
          label: 'Type',
          render: (row) => (
            <ClayBadge tone="rose-soft">{row.type}</ClayBadge>
          ),
        },
        {
          key: 'category',
          label: 'Category',
          render: (row) => row.category ? (
            <ClayBadge tone="neutral">{row.category}</ClayBadge>
          ) : <span className="text-clay-ink-muted">—</span>,
        },
        {
          key: 'message',
          label: 'Description',
          render: (row) => {
            const msg = String(row.message || '');
            return (
              <span className="block max-w-[240px] truncate">
                {msg.length > 50 ? msg.slice(0, 50) + '…' : msg || '—'}
              </span>
            );
          },
        },
        {
          key: 'visibility',
          label: 'Visibility',
          render: (row) => row.visibility ? (
            <ClayBadge tone={row.visibility === 'public' ? 'green' : row.visibility === 'private' ? 'neutral' : 'amber'}>
              {row.visibility}
            </ClayBadge>
          ) : <span className="text-clay-ink-muted">—</span>,
        },
        {
          key: 'givenAt',
          label: 'Awarded Date',
          render: (row) =>
            row.givenAt ? new Date(row.givenAt).toLocaleDateString() : '—',
        },
      ]}
      fields={fields}
    />
  );
}
