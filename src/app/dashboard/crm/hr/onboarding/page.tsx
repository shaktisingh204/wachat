'use client';

import { UserCheck } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getOnboardingTemplates,
  saveOnboardingTemplate,
  deleteOnboardingTemplate,
} from '@/app/actions/hr.actions';
import type { HrOnboardingTemplate } from '@/lib/hr-types';
import { fields } from './_config';

export default function OnboardingPage() {
  return (
    <HrEntityPage<HrOnboardingTemplate & { _id: string }>
      title="Onboarding Templates"
      subtitle="Reusable checklists for day-one through week-one."
      icon={UserCheck}
      singular="Template"
      basePath="/dashboard/crm/hr/onboarding"
      getAllAction={getOnboardingTemplates as any}
      saveAction={saveOnboardingTemplate}
      deleteAction={deleteOnboardingTemplate}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'department', label: 'Department' },
        { key: 'estimatedDays', label: 'Est. Days' },
        { key: 'description', label: 'Description' },
      ]}
      fields={fields}
    />
  );
}
