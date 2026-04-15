'use client';

import { Briefcase } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveJobPosting } from '@/app/actions/hr.actions';

export default function NewJobPage() {
  return (
    <HrFormPage
      title="New Job"
      subtitle="Create a new job posting for your hiring pipeline."
      icon={Briefcase}
      backHref="/dashboard/hrm/hr/jobs"
      singular="Job"
      fields={fields}
      sections={sections}
      saveAction={saveJobPosting}
    />
  );
}
