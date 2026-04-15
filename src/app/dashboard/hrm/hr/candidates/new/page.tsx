'use client';

import { Target } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveCandidate } from '@/app/actions/hr.actions';

export default function NewCandidatePage() {
  return (
    <HrFormPage
      title="New Candidate"
      subtitle="Add a new candidate to your talent pipeline."
      icon={Target}
      backHref="/dashboard/hrm/hr/candidates"
      singular="Candidate"
      fields={fields}
      sections={sections}
      saveAction={saveCandidate}
    />
  );
}
