import { Suspense } from 'react';
import { getWeeklyTimesheets } from '@/app/actions/worksuite/time.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { WeeklyTimesheetsClient } from './components/weekly-timesheets-client';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function WeeklyTimesheetsPage() {
  return (
    <Suspense 
      fallback={
        <EntityListShell
          title="Weekly Timesheets"
          subtitle="Track, submit, and approve weekly hour logs across your team."
        >
          <div className="p-12 text-center text-sm text-zoru-ink-muted">
            Loading timesheets...
          </div>
        </EntityListShell>
      }
    >
      <DataLoader />
    </Suspense>
  );
}

async function DataLoader() {
  const [sheets, employees] = await Promise.all([
    getWeeklyTimesheets(),
    getCrmEmployees(),
  ]);

  return (
    <WeeklyTimesheetsClient 
      initialSheets={sheets} 
      initialEmployees={
        // Transform the standard employees to simple id/name
        employees.map((e: any) => ({
          _id: String(e._id),
          name: [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.email || 'Unnamed',
        }))
      } 
    />
  );
}
