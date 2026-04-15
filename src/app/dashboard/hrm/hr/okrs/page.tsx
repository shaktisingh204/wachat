'use client';

import { Target } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import { getOkrs, saveOkr, deleteOkr } from '@/app/actions/hr.actions';
import type { HrOkr } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  draft: 'neutral',
  'in-progress': 'blue',
  achieved: 'green',
  missed: 'red',
  'at-risk': 'amber',
};

export default function OkrsPage() {
  return (
    <HrEntityPage<HrOkr & { _id: string }>
      title="OKRs"
      subtitle="Objectives and key results by quarter."
      icon={Target}
      singular="OKR"
      basePath="/dashboard/hrm/hr/okrs"
      getAllAction={getOkrs as any}
      saveAction={saveOkr}
      deleteAction={deleteOkr}
      columns={[
        { key: 'objective', label: 'Objective' },
        { key: 'quarter', label: 'Quarter' },
        { key: 'team', label: 'Team' },
        { key: 'weight', label: 'Weight' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
