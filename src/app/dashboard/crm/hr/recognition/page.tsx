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
      basePath="/dashboard/crm/hr/recognition"
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
        { key: 'fromName', label: 'From' },
        {
          key: 'type',
          label: 'Type',
          render: (row) => (
            <ClayBadge tone="rose-soft">{row.type}</ClayBadge>
          ),
        },
        {
          key: 'message',
          label: 'Message',
          render: (row) => {
            const msg = String(row.message || '');
            return (
              <span className="block max-w-[240px] truncate">
                {msg.length > 40 ? msg.slice(0, 40) + '…' : msg}
              </span>
            );
          },
        },
        {
          key: 'givenAt',
          label: 'Given',
          render: (row) =>
            row.givenAt ? new Date(row.givenAt).toLocaleDateString() : '—',
        },
      ]}
      fields={fields}
    />
  );
}
