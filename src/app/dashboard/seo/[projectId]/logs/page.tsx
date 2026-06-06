import { Suspense } from 'react';
import { LogsClient } from './_components/logs-client';
import { getLogReport } from './actions';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Log Forensics | SabNode',
};

async function LogsData({ projectId }: { projectId: string }) {
  const report = await getLogReport(projectId);
  return <LogsClient projectId={projectId} initialData={report} />;
}

export default async function LogsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <Skeleton className="h-[200px] w-full" />
      </div>
    }>
      <LogsData projectId={projectId} />
    </Suspense>
  );
}
