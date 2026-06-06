import { Suspense } from 'react';
import { PseoClient } from './_components/pseo-client';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'pSEO Clustering | SabNode',
};

export default async function PseoPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <PseoClient projectId={projectId} />
    </Suspense>
  );
}
