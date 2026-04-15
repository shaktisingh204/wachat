'use client';

import { Plane } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveTravelRequest } from '@/app/actions/hr.actions';

export default function NewTravelRequestPage() {
  return (
    <HrFormPage
      title="New Travel Request"
      subtitle="Request a business trip."
      icon={Plane}
      backHref="/dashboard/hrm/hr/travel"
      singular="Travel Request"
      fields={fields}
      sections={sections}
      saveAction={saveTravelRequest}
    />
  );
}
