'use client';

import { Award } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveRecognition } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewRecognitionPage() {
  return (
    <HrFormPage
      title="New Recognition"
      subtitle="Send kudos or a spot award."
      icon={Award}
      backHref="/dashboard/hrm/hr/recognition"
      singular="Recognition"
      fields={fields}
      sections={sections}
      saveAction={saveRecognition}
    />
  );
}
