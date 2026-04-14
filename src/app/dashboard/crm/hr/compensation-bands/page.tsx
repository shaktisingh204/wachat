'use client';

import { LineChart } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getCompensationBands,
  saveCompensationBand,
  deleteCompensationBand,
} from '@/app/actions/hr.actions';
import type { HrCompensationBand } from '@/lib/hr-types';
import { fields } from './_config';

export default function CompensationBandsPage() {
  return (
    <HrEntityPage<HrCompensationBand & { _id: string }>
      title="Compensation Bands"
      subtitle="Salary bands by level and role."
      icon={LineChart}
      singular="Band"
      basePath="/dashboard/crm/hr/compensation-bands"
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
      fields={fields}
    />
  );
}
