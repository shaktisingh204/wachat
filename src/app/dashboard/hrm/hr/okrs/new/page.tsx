'use client';

import { Target } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveOkr } from '@/app/actions/hr.actions';

export default function NewOkrPage() {
  return (
    <HrFormPage
      title="New OKR"
      subtitle="Define a new objective and its key results."
      icon={Target}
      backHref="/dashboard/hrm/hr/okrs"
      singular="OKR"
      fields={fields}
      sections={sections}
      saveAction={saveOkr}
    />
  );
}
