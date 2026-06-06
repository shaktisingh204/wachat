import { Suspense } from 'react';
import { getWeeklyTimesheetById, getWeeklyEntries } from '@/app/actions/worksuite/time.actions';
import { WeeklyTimesheetGrid } from './_components/weekly-timesheet-grid';

export const dynamic = 'force-dynamic';

function TimesheetSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-[var(--st-bg-muted)]" />
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded bg-[var(--st-bg-muted)]" />
          <div className="h-9 w-20 rounded bg-[var(--st-bg-muted)]" />
        </div>
      </div>
      <div className="h-[300px] w-full rounded-lg bg-[var(--st-bg-muted)]" />
    </div>
  );
}

export default async function WeeklyTimesheetDetailPage({
  params,
}: {
  params: Promise<{ timesheetId: string }>;
}) {
  const { timesheetId } = await params;

  // Trigger parallel asynchronous data fetching on the server.
  // Next.js will stream the response once the skeleton renders, suspending only on the dataPromise.
  const dataPromise = Promise.all([
    getWeeklyTimesheetById(timesheetId),
    getWeeklyEntries(timesheetId),
  ]);

  return (
    <Suspense fallback={<TimesheetSkeleton />}>
      <WeeklyTimesheetGrid timesheetId={timesheetId} dataPromise={dataPromise} />
    </Suspense>
  );
}
