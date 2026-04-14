'use client';

import { FileText } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { savePolicy } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewPolicyPage() {
  return (
    <HrFormPage
      title="New Policy"
      subtitle="Create a new company policy."
      icon={FileText}
      backHref="/dashboard/crm/hr/policies"
      singular="Policy"
      fields={fields}
      sections={sections}
      saveAction={savePolicy}
    />
  );
}
