import * as React from 'react';
import { Suspense } from 'react';
import { TimeLogsContainer } from './_components/time-logs-container';

export const dynamic = 'force-dynamic';

interface TimeLogsPageProps {
  searchParams: Promise<{
    employeeId?: string;
    projectId?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function TimeLogsPage(props: TimeLogsPageProps) {
  const sp = await props.searchParams;
  const filters = {
    employeeId: sp.employeeId ?? '',
    projectId: sp.projectId ?? '',
    from: sp.from ?? '',
    to: sp.to ?? '',
  };

  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--st-text)]">Loading time logs...</p>
          <p className="text-[12px] text-[var(--st-text-secondary)]">Please wait while we compile hours.</p>
        </div>
      </div>
    }>
      <TimeLogsContainer filters={filters} />
    </Suspense>
  );
}
