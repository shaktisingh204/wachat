'use client';

import { LineChart } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getCompensationBands,
  saveCompensationBand,
  deleteCompensationBand,
} from '@/app/actions/hr.actions';
import type { HrCompensationBand } from '@/lib/hr-types';

export default function CompensationBandsPage() {
  return (
    <HrEntityPage<HrCompensationBand & { _id: string }>
      title="Compensation Bands"
      subtitle="Salary bands by level and role."
      icon={LineChart}
      singular="Band"
      getAllAction={getCompensationBands as any}
      saveAction={saveCompensationBand}
      deleteAction={deleteCompensationBand}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'level', label: 'Level' },
        { key: 'department', label: 'Department' },
        { key: 'minSalary', label: 'Min' },
        { key: 'maxSalary', label: 'Max' },
        { key: 'currency', label: 'Currency' },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        { name: 'level', label: 'Level', required: true },
        { name: 'minSalary', label: 'Min Salary', type: 'number', required: true },
        { name: 'maxSalary', label: 'Max Salary', type: 'number', required: true },
        { name: 'currency', label: 'Currency', defaultValue: 'INR' },
        { name: 'department', label: 'Department' },
        { name: 'experienceMin', label: 'Experience Min (years)', type: 'number' },
        { name: 'experienceMax', label: 'Experience Max (years)', type: 'number' },
        { name: 'bandVersion', label: 'Band Version', defaultValue: 'v1' },
        {
          name: 'reviewCycle',
          label: 'Review Cycle',
          type: 'select',
          options: [
            { value: 'annual', label: 'Annual' },
            { value: 'bi-annual', label: 'Bi-annual' },
            { value: 'quarterly', label: 'Quarterly' },
          ],
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
