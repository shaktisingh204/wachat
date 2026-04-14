'use client';

import { Calendar } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveInterview } from '@/app/actions/hr.actions';

export default function NewInterviewPage() {
  return (
    <HrFormPage
      title="New Interview"
      subtitle="Schedule a new candidate interview round."
      icon={Calendar}
      backHref="/dashboard/crm/hr/interviews"
      singular="Interview"
      fields={fields}
      sections={sections}
      saveAction={saveInterview}
    />
  );
}
