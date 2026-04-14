'use client';

import { Target } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import { getOkrs, saveOkr, deleteOkr } from '@/app/actions/hr.actions';
import type { HrOkr } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  draft: 'neutral',
  'in-progress': 'blue',
  achieved: 'green',
  missed: 'red',
};

export default function OkrsPage() {
  return (
    <HrEntityPage<HrOkr & { _id: string }>
      title="OKRs"
      subtitle="Objectives and key results by quarter."
      icon={Target}
      singular="OKR"
      getAllAction={getOkrs as any}
      saveAction={saveOkr}
      deleteAction={deleteOkr}
      columns={[
        { key: 'objective', label: 'Objective' },
        { key: 'quarter', label: 'Quarter' },
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
      fields={[
        { name: 'employeeId', label: 'Employee ID' },
        { name: 'quarter', label: 'Quarter', required: true, placeholder: 'Q1 2026' },
        { name: 'objective', label: 'Objective', required: true, fullWidth: true },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'in-progress', label: 'In progress' },
            { value: 'achieved', label: 'Achieved' },
            { value: 'missed', label: 'Missed' },
          ],
          defaultValue: 'draft',
        },
        {
          name: 'keyResults',
          label: 'Key Results (JSON)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '[{"description":"Ship X","progress":50}]',
        },
      ]}
    />
  );
}
