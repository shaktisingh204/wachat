import { Suspense } from 'react';
import { getWeeklyTimesheetById, getWeeklyEntries } from '@/app/actions/worksuite/time.actions';
import { LoaderCircle } from 'lucide-react';
import { TimesheetDetailClient } from './client';
import type { WsWeeklyTimesheet, WsWeeklyTimesheetEntry } from '@/lib/worksuite/time-types';

export default async function WeeklyTimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense 
      fallback={
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
        </div>
      }
    >
      <TimesheetFetcher id={id} />
    </Suspense>
  );
}

async function TimesheetFetcher({ id }: { id: string }) {
  const [sheet, entries] = await Promise.all([
    getWeeklyTimesheetById(id),
    getWeeklyEntries(id),
  ]);

  if (!sheet || 'error' in sheet) {
    return (
      <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
        Timesheet not found or could not be loaded.
      </div>
    );
  }

  return (
    <TimesheetDetailClient 
      initialSheet={sheet as WsWeeklyTimesheet} 
      initialEntries={entries as WsWeeklyTimesheetEntry[]} 
      sheetId={id} 
    />
  );
}
