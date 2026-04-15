'use client';

import { UserPlus } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getSuccessionPlans,
  saveSuccessionPlan,
  deleteSuccessionPlan,
} from '@/app/actions/hr.actions';
import type { HrSuccessionPlan } from '@/lib/hr-types';

const READINESS_TONES: Record<string, 'neutral' | 'green' | 'amber'> = {
  'ready-now': 'green',
  'ready-1yr': 'amber',
  'ready-2yr': 'neutral',
};

export default function SuccessionPage() {
  return (
    <HrEntityPage<HrSuccessionPlan & { _id: string }>
      title="Succession Planning"
      subtitle="Role continuity and successor readiness."
      icon={UserPlus}
      singular="Plan"
      getAllAction={getSuccessionPlans as any}
      saveAction={saveSuccessionPlan}
      deleteAction={deleteSuccessionPlan}
      columns={[
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'successorId', label: 'Successor ID' },
        {
          key: 'readiness',
          label: 'Readiness',
          render: (row) => {
            const v = (row as any).readiness || 'ready-2yr';
            return (
              <ClayBadge tone={READINESS_TONES[v] || 'neutral'} dot>
                {v}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'successorId', label: 'Successor ID', required: true },
        {
          name: 'readiness',
          label: 'Readiness',
          type: 'select',
          required: true,
          options: [
            { value: 'ready-now', label: 'Ready Now' },
            { value: 'ready-1yr', label: 'Ready in 1 Year' },
            { value: 'ready-2yr', label: 'Ready in 2 Years' },
          ],
          defaultValue: 'ready-2yr',
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
