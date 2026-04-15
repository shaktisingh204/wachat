'use client';

import { Gauge } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveSurvey } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewSurveyPage() {
  return (
    <HrFormPage
      title="New Survey"
      subtitle="Design an engagement or pulse survey."
      icon={Gauge}
      backHref="/dashboard/hrm/hr/surveys"
      singular="Survey"
      fields={fields}
      sections={sections}
      saveAction={saveSurvey}
    />
  );
}
