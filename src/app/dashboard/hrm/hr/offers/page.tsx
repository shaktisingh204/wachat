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
  pending: 'amber',
  accepted: 'green',
  rejected: 'red',
  expired: 'neutral',
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
        { key: 'designation', label: 'Designation' },
        { key: 'department', label: 'Department' },
        {
          key: 'salary',
          label: 'Salary',
          render: (row) => {
            const s = (row as any).salary ?? (row as any).ctc;
            const c = (row as any).currency || '';
            return s != null ? `${Number(s).toLocaleString()} ${c}`.trim() : '—';
          },
        },
        {
          key: 'joining_date',
          label: 'Joining Date',
          render: (row) => {
            const d = (row as any).joining_date ?? (row as any).joiningDate;
            return d ? new Date(d).toLocaleDateString() : '—';
          },
        },
        {
          key: 'valid_till',
          label: 'Valid Till',
          render: (row) => {
            const d = (row as any).valid_till ?? (row as any).expiresAt;
            return d ? new Date(d).toLocaleDateString() : '—';
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
