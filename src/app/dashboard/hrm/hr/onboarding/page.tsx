'use client';

import { UserCheck } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getOnboardingTemplates,
  saveOnboardingTemplate,
  deleteOnboardingTemplate,
} from '@/app/actions/hr.actions';
import type { HrOnboardingTemplate } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber'> = {
  pending: 'amber',
  completed: 'green',
  skipped: 'neutral',
};

const CATEGORY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'rose-soft' | 'green'> = {
  paperwork: 'neutral',
  equipment: 'blue',
  training: 'amber',
  access: 'rose-soft',
  intro: 'green',
};

export default function OnboardingPage() {
  return (
    <HrEntityPage<HrOnboardingTemplate & { _id: string }>
      title="Onboarding Tasks"
      subtitle="Employee onboarding tasks — paperwork, equipment, training, and more."
      icon={UserCheck}
      singular="Task"
      basePath="/dashboard/hrm/hr/onboarding"
      getAllAction={getOnboardingTemplates as any}
      saveAction={saveOnboardingTemplate}
      deleteAction={deleteOnboardingTemplate}
      columns={[
        { key: 'employee_id', label: 'Employee ID' },
        { key: 'task_name', label: 'Task' },
        {
          key: 'category',
          label: 'Category',
          render: (row) => {
            const v = (row as any).category;
            return v ? (
              <ClayBadge tone={CATEGORY_TONES[v] || 'neutral'}>{v}</ClayBadge>
            ) : (
              <span className="text-clay-ink-muted">—</span>
            );
          },
        },
        {
          key: 'due_date',
          label: 'Due Date',
          render: (row) => {
            const d = (row as any).due_date;
            return d ? new Date(d).toLocaleDateString() : '—';
          },
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const v = (row as any).status || 'pending';
            return (
              <ClayBadge tone={STATUS_TONES[v] || 'neutral'} dot>
                {v}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={fields}
    />
  );
}
