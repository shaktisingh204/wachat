import { Suspense } from 'react';
import { getWeeklyTimesheetById, getWeeklyEntries } from '@/app/actions/worksuite/time.actions';
import { LoaderCircle } from 'lucide-react';
import { TimesheetDetailClient } from './client';
import type { WsWeeklyTimesheet, WsWeeklyTimesheetEntry } from '@/lib/worksuite/time-types';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';


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
  try {
    const [sheet, entries] = await Promise.all([
      getWeeklyTimesheetById(id),
      getWeeklyEntries(id),
    ]);

    if (!sheet) {
      notFound();
    }

    if ('error' in sheet) {
      throw new Error((sheet as any).error || 'Failed to load timesheet');
    }

    return (
      <TimesheetDetailClient 
        initialSheet={sheet as WsWeeklyTimesheet} 
        initialEntries={entries as WsWeeklyTimesheetEntry[]} 
        sheetId={id} 
      />
    );
  } catch (error) {
    console.error('Error fetching timesheet:', error);
    throw error;
  }
}
