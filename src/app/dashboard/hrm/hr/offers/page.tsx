'use client';

import { Send } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getOfferLetters,
  saveOfferLetter,
  deleteOfferLetter,
} from '@/app/actions/hr.actions';
import type { HrOfferLetter } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  draft: 'neutral',
  sent: 'amber',
  accepted: 'green',
  declined: 'red',
  withdrawn: 'neutral',
  revoked: 'red',
};

export default function OffersPage() {
  return (
    <HrEntityPage<HrOfferLetter & { _id: string }>
      title="Offer Letters"
      subtitle="Draft, send, and track candidate offers."
      icon={Send}
      singular="Offer"
      basePath="/dashboard/hrm/hr/offers"
      getAllAction={getOfferLetters as any}
      saveAction={saveOfferLetter}
      deleteAction={deleteOfferLetter}
      columns={[
        { key: 'jobTitle', label: 'Job Title' },
        { key: 'department', label: 'Department' },
        {
          key: 'ctc',
          label: 'CTC',
          render: (row) =>
            row.ctc != null
              ? `${row.ctc.toLocaleString()} ${row.currency || ''}`.trim()
              : '—',
        },
        {
          key: 'joiningDate',
          label: 'Joining Date',
          render: (row) =>
            row.joiningDate
              ? new Date(row.joiningDate).toLocaleDateString()
              : '—',
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
