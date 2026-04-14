'use client';

import { Target } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getCandidates,
  saveCandidate,
  deleteCandidate,
} from '@/app/actions/hr.actions';
import type { HrCandidate } from '@/lib/hr-types';

const STAGE_TONES: Record<
  string,
  'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'rose-soft'
> = {
  new: 'neutral',
  screening: 'blue',
  interview: 'amber',
  offer: 'rose-soft',
  hired: 'green',
  rejected: 'red',
};

export default function CandidatesPage() {
  return (
    <HrEntityPage<HrCandidate & { _id: string }>
      title="Candidates"
      subtitle="Talent pipeline, profiles, and hiring stages."
      icon={Target}
      singular="Candidate"
      getAllAction={getCandidates as any}
      saveAction={saveCandidate}
      deleteAction={deleteCandidate}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        {
          key: 'stage',
          label: 'Stage',
          render: (row) => (
            <ClayBadge tone={STAGE_TONES[row.stage] || 'neutral'} dot>
              {row.stage}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'source', label: 'Source' },
        {
          name: 'stage',
          label: 'Stage',
          type: 'select',
          required: true,
          options: [
            { value: 'new', label: 'New' },
            { value: 'screening', label: 'Screening' },
            { value: 'interview', label: 'Interview' },
            { value: 'offer', label: 'Offer' },
            { value: 'hired', label: 'Hired' },
            { value: 'rejected', label: 'Rejected' },
          ],
          defaultValue: 'new',
        },
        { name: 'rating', label: 'Rating', type: 'number' },
        { name: 'resumeUrl', label: 'Resume URL' },
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
