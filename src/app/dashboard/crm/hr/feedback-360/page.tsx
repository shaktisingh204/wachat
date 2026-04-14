'use client';

import { Star } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getFeedback360,
  saveFeedback360,
  deleteFeedback360,
} from '@/app/actions/hr.actions';
import type { HrFeedback360 } from '@/lib/hr-types';

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function Feedback360Page() {
  return (
    <HrEntityPage<HrFeedback360 & { _id: string }>
      title="360° Feedback"
      subtitle="Peer, manager, and self reviews."
      icon={Star}
      singular="Feedback"
      getAllAction={getFeedback360 as any}
      saveAction={saveFeedback360}
      deleteAction={deleteFeedback360}
      columns={[
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">{String(row.employeeId)}</span>
          ),
        },
        { key: 'reviewerName', label: 'Reviewer' },
        {
          key: 'reviewerType',
          label: 'Type',
          render: (row) => (
            <ClayBadge tone="rose-soft" dot>
              {row.reviewerType}
            </ClayBadge>
          ),
        },
        { key: 'rating', label: 'Rating' },
        {
          key: 'submittedAt',
          label: 'Submitted',
          render: (row) => formatDate(row.submittedAt),
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'reviewerName', label: 'Reviewer Name', required: true },
        {
          name: 'reviewerType',
          label: 'Reviewer Type',
          type: 'select',
          options: [
            { value: 'peer', label: 'Peer' },
            { value: 'manager', label: 'Manager' },
            { value: 'report', label: 'Report' },
            { value: 'self', label: 'Self' },
          ],
          defaultValue: 'peer',
        },
        { name: 'rating', label: 'Rating (1-5)', type: 'number' },
        { name: 'strengths', label: 'Strengths', type: 'textarea', fullWidth: true },
        { name: 'improvements', label: 'Improvements', type: 'textarea', fullWidth: true },
        { name: 'submittedAt', label: 'Submitted At', type: 'date' },
      ]}
    />
  );
}
