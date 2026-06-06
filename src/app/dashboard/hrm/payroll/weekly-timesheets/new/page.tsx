import { Suspense } from 'react';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { NewTimesheetClient, EmployeeLite } from './new-timesheet-client';

export const dynamic = 'force-dynamic';


async function EmployeesLoader() {
  const rows = await getCrmEmployees();
  const employees: EmployeeLite[] = (rows as any[]).map((e) => ({
    _id: String(e._id),
    firstName: e.firstName,
    lastName: e.lastName,
  }));
  return <NewTimesheetClient employees={employees} />;
}

export default function NewWeeklyTimesheetPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-[13px] text-[var(--st-text-secondary)]">Loading employees…</div>}>
      <EmployeesLoader />
    </Suspense>
  );
}
