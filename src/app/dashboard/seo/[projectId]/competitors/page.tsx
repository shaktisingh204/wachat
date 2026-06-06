import { Suspense } from 'react';
import { CompetitorsClient } from './_components/competitors-client';
import { getCompetitorAnalysisData } from '@/app/actions/seo.actions';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Competitor Analysis | SabNode',
};

async function CompetitorsData({ projectId }: { projectId: string }) {
  const data = await getCompetitorAnalysisData(projectId);
  return <CompetitorsClient projectId={projectId} initialData={data} />;
}

export default async function CompetitorsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6 pb-12">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    }>
      <CompetitorsData projectId={projectId} />
    </Suspense>
  );
}
