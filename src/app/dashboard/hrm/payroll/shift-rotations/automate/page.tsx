import { Suspense } from 'react';
import { getShiftRotations, getAutomateShifts } from '@/app/actions/worksuite/shifts.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import AutomateClient from './components/automate-client';
import AutomateLoading from './loading';

export const dynamic = 'force-dynamic';


export const metadata = {
  title: 'Automate Shift | SabNode',
};

export default async function AutomateShiftPage() {
  const [rotations, employees, runs] = await Promise.all([
    getShiftRotations(),
    getCrmEmployees(),
    getAutomateShifts(),
  ]);

  return (
    <EntityListShell
      title="Automate Shift"
      subtitle="Expand a rotation across a date range for selected employees."
    >
      <Suspense fallback={<AutomateLoading />}>
        <AutomateClient
          initialRotations={rotations}
          initialEmployees={employees}
          initialRuns={runs}
        />
      </Suspense>
    </EntityListShell>
  );
}
