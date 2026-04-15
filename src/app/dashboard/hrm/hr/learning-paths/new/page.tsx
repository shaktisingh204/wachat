'use client';

import { Route } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveLearningPath } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewLearningPathPage() {
  return (
    <HrFormPage
      title="New Learning Path"
      subtitle="Design a structured learning track."
      icon={Route}
      backHref="/dashboard/hrm/hr/learning-paths"
      singular="Path"
      fields={fields}
      sections={sections}
      saveAction={saveLearningPath}
    />
  );
}
