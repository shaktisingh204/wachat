'use client';

import { UserCheck } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getOnboardingTemplates,
  saveOnboardingTemplate,
  deleteOnboardingTemplate,
} from '@/app/actions/hr.actions';
import type { HrOnboardingTemplate } from '@/lib/hr-types';

export default function OnboardingPage() {
  return (
    <HrEntityPage<HrOnboardingTemplate & { _id: string }>
      title="Onboarding Templates"
      subtitle="Reusable checklists for day-one through week-one."
      icon={UserCheck}
      singular="Template"
      getAllAction={getOnboardingTemplates as any}
      saveAction={saveOnboardingTemplate}
      deleteAction={deleteOnboardingTemplate}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'tasks',
          label: 'Tasks (JSON array)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '[{"title":"Get laptop","dueDays":1}]',
        },
      ]}
    />
  );
}
