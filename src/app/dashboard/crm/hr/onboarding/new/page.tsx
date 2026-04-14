'use client';

import { UserCheck } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveOnboardingTemplate } from '@/app/actions/hr.actions';

export default function NewOnboardingTemplatePage() {
  return (
    <HrFormPage
      title="New Onboarding Template"
      subtitle="Create a reusable onboarding checklist."
      icon={UserCheck}
      backHref="/dashboard/crm/hr/onboarding"
      singular="Template"
      fields={fields}
      sections={sections}
      saveAction={saveOnboardingTemplate}
    />
  );
}
