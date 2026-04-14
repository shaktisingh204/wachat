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
