import { Suspense } from 'react';
import LeaveCalendarClient from './client';
import { listDepartments } from '@/app/actions/crm/departments.actions';
import { getLeavesForDateRange } from '@/app/actions/worksuite/leave.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';

function monthStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function monthEnd(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function LeaveCalendarLoader() {
  const now = new Date();
  const start = monthStart(now);
  const end = monthEnd(now);

  const [depts, entries] = await Promise.all([
    listDepartments({ limit: 100 }),
    getLeavesForDateRange(start, end),
  ]);

  return <LeaveCalendarClient initialDepartments={depts.items || []} initialEntries={entries} />;
}

export default function LeaveCalendarPage() {
  return (
    <Suspense
      fallback={
        <EntityListShell
          title="Leave Calendar"
          subtitle="Loading leave calendar..."
        >
          <div className="text-center py-8 text-zoru-ink-muted">Loading…</div>
        </EntityListShell>
      }
    >
      <LeaveCalendarLoader />
    </Suspense>
  );
}
