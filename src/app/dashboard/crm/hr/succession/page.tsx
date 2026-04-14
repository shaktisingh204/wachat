'use client';

import { UserPlus } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getSuccessionPlans,
  saveSuccessionPlan,
  deleteSuccessionPlan,
} from '@/app/actions/hr.actions';
import type { HrSuccessionPlan } from '@/lib/hr-types';

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
        { key: 'roleTitle', label: 'Role' },
        { key: 'incumbentName', label: 'Incumbent' },
        {
          key: 'successors',
          label: 'Successors',
          render: (row) => (row.successors?.length ?? 0) + ' candidates',
        },
      ]}
      fields={[
        { name: 'roleTitle', label: 'Role Title', required: true, fullWidth: true },
        { name: 'incumbentName', label: 'Incumbent Name' },
        {
          name: 'successors',
          label: 'Successors (JSON)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '[{"name":"Jane","readiness":"ready"}]',
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
