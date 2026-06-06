import { Suspense } from 'react';
import { GscClient } from './_components/gsc-client';
import { getGscIntegration } from '@/app/actions/seo-gsc.actions';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Google Search Console | SabNode',
};

async function GscData({ projectId }: { projectId: string }) {
  const integration = await getGscIntegration(projectId);
  return <GscClient projectId={projectId} initialIntegration={integration} />;
}

export default async function GscPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    }>
      <GscData projectId={projectId} />
    </Suspense>
  );
}
