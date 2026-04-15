'use client';

import { BookOpen } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveTrainingProgram } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewTrainingProgramPage() {
  return (
    <HrFormPage
      title="New Training Program"
      subtitle="Schedule a learning session or workshop."
      icon={BookOpen}
      backHref="/dashboard/hrm/hr/training"
      singular="Program"
      fields={fields}
      sections={sections}
      saveAction={saveTrainingProgram}
    />
  );
}
