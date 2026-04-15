'use client';

import { Star } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveFeedback360 } from '@/app/actions/hr.actions';

export default function NewFeedback360Page() {
  return (
    <HrFormPage
      title="New 360° Feedback"
      subtitle="Record peer, manager, or self feedback."
      icon={Star}
      backHref="/dashboard/hrm/hr/feedback-360"
      singular="Feedback"
      fields={fields}
      sections={sections}
      saveAction={saveFeedback360}
    />
  );
}
