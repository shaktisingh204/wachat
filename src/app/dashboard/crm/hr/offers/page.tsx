'use client';

import { Send } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getOfferLetters,
  saveOfferLetter,
  deleteOfferLetter,
} from '@/app/actions/hr.actions';
import type { HrOfferLetter } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  draft: 'neutral',
  sent: 'amber',
  accepted: 'green',
  declined: 'red',
  withdrawn: 'neutral',
};

export default function OffersPage() {
  return (
    <HrEntityPage<HrOfferLetter & { _id: string }>
      title="Offer Letters"
      subtitle="Draft, send, and track candidate offers."
      icon={Send}
      singular="Offer"
      getAllAction={getOfferLetters as any}
      saveAction={saveOfferLetter}
      deleteAction={deleteOfferLetter}
      columns={[
        { key: 'jobTitle', label: 'Job Title' },
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
      fields={[
        { name: 'candidateId', label: 'Candidate ID' },
        { name: 'jobTitle', label: 'Job Title', required: true },
        { name: 'ctc', label: 'CTC', type: 'number', required: true },
        { name: 'currency', label: 'Currency', defaultValue: 'INR' },
        {
          name: 'joiningDate',
          label: 'Joining Date',
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'declined', label: 'Declined' },
            { value: 'withdrawn', label: 'Withdrawn' },
          ],
          defaultValue: 'draft',
        },
        { name: 'fixedComponent', label: 'Fixed Component', type: 'number' },
        { name: 'variableComponent', label: 'Variable Component', type: 'number' },
        { name: 'joiningBonus', label: 'Joining Bonus', type: 'number' },
        { name: 'probationMonths', label: 'Probation (months)', type: 'number', defaultValue: '3' },
        {
          name: 'workMode',
          label: 'Work Mode',
          type: 'select',
          options: [
            { value: 'onsite', label: 'Onsite' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'remote', label: 'Remote' },
          ],
        },
        { name: 'reportsTo', label: 'Reports To' },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
