import { Suspense } from 'react';
import { getTimeLogs } from '@/app/actions/worksuite/time.actions';
import { TimeLogsClient } from './components/time-logs-client';
import { ErrorBoundaryWrapper } from './components/error-boundary';
import { Card } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';


export default function TimeLogsPage() {
  // Trigger data fetch on the server to pass the promise down for Suspense
  const logsPromise = getTimeLogs();

  return (
    <ErrorBoundaryWrapper>
      <Suspense
        fallback={
          <div className="p-6">
            <Card className="flex flex-col items-center justify-center h-64 border-[var(--st-border)] bg-[var(--st-bg)]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--st-text-secondary)] border-t-transparent" />
              <p className="mt-4 text-sm text-[var(--st-text-secondary)]">Loading time logs...</p>
            </Card>
          </div>
        }
      >
        <TimeLogsClient initialLogsPromise={logsPromise} />
      </Suspense>
    </ErrorBoundaryWrapper>
  );
}
