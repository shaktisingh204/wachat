import React, { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui/compat';
import { LoaderCircle } from 'lucide-react';
import { startOfWeek, addDays } from 'date-fns';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getEmployeeShifts, getShiftSchedules } from '@/app/actions/worksuite/shifts.actions';
import { ScheduleClient } from './schedule-client';

export const dynamic = 'force-dynamic';


export default async function ShiftSchedulePage(props: { searchParams: Promise<any> | any }) {
  const params = await props.searchParams;
  const dateParam = params?.date as string | undefined;
  const weekStart = dateParam ? new Date(dateParam) : startOfWeek(new Date(), { weekStartsOn: 1 });

  return (
    <Suspense fallback={
      <EntityListShell title="Shift Schedule">
        <Card className="p-6 flex justify-center items-center h-64">
          <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
        </Card>
      </EntityListShell>
    }>
      <DataLoader weekStart={weekStart} />
    </Suspense>
  );
}

async function DataLoader({ weekStart }: { weekStart: Date }) {
  const weekEnd = addDays(weekStart, 6);
  const [employees, shifts, schedules] = await Promise.all([
    getCrmEmployees(),
    getEmployeeShifts(),
    getShiftSchedules({ from: weekStart, to: weekEnd }),
  ]);

  return <ScheduleClient employees={employees} shifts={shifts} initialSchedules={schedules} weekStart={weekStart} />;
}
