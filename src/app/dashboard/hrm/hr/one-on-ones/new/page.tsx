'use client';

import { MessagesSquare } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveOneOnOne } from '@/app/actions/hr.actions';

export default function NewOneOnOnePage() {
  return (
    <HrFormPage
      title="New One-on-One"
      subtitle="Schedule a check-in between a manager and report."
      icon={MessagesSquare}
      backHref="/dashboard/hrm/hr/one-on-ones"
      singular="One-on-One"
      fields={fields}
      sections={sections}
      saveAction={saveOneOnOne}
    />
  );
}
