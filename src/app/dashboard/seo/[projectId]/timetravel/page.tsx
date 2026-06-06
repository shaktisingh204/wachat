import { Suspense } from 'react';
import { TimeTravelClient } from './_components/timetravel-client';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SERP Time Travel | SabNode',
};

export default async function TimeTravelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <TimeTravelClient projectId={projectId} />
    </Suspense>
  );
}
