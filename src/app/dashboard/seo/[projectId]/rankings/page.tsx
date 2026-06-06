import { Suspense } from 'react';
import { RankingsClient } from './_components/rankings-client';
import { getKeywords } from '@/app/actions/seo-rank.actions';
import { getSeoProject } from '@/app/actions/seo.actions';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Keyword Rankings | SabNode',
};

async function RankingsData({ projectId }: { projectId: string }) {
  const [data, proj] = await Promise.all([
    getKeywords(projectId),
    getSeoProject(projectId)
  ]);

  const keywords = Array.isArray(data) ? data : [];
  const competitors = proj?.competitors || [];

  return <RankingsClient projectId={projectId} initialKeywords={keywords} initialCompetitors={competitors} />;
}

export default async function RankingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-[350px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    }>
      <RankingsData projectId={projectId} />
    </Suspense>
  );
}
