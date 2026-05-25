import { Suspense } from 'react';
import { GridTrackingClient } from './_components/grid-tracking-client';
import { getSeoProject } from '@/app/actions/seo.actions';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Local Geo-Grid | SabNode',
};

async function GridTrackingData({ projectId }: { projectId: string }) {
  const project = await getSeoProject(projectId);
  return <GridTrackingClient projectId={projectId} initialProj={project} />;
}

export default async function GridTrackingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-6 md:grid-cols-[350px_1fr]">
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    }>
      <GridTrackingData projectId={projectId} />
    </Suspense>
  );
}
