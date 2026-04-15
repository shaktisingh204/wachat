'use client';

import { Target } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getCandidates,
  saveCandidate,
  deleteCandidate,
} from '@/app/actions/hr.actions';
import type { HrCandidate } from '@/lib/hr-types';
import { fields } from './_config';

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
      basePath="/dashboard/hrm/hr/candidates"
      getAllAction={getCandidates as any}
      saveAction={saveCandidate}
      deleteAction={deleteCandidate}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'currentCompany', label: 'Current Company' },
        { key: 'experienceYears', label: 'Exp (yrs)' },
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
      fields={fields}
    />
  );
}
