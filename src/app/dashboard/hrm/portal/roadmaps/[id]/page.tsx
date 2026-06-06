import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { getRoadmapById } from '@/app/actions/hrm-roadmaps.actions';
import { getSession } from '@/app/actions/user.actions';
import { getMyDirectReports } from '@/app/actions/hrm-portal.actions';
import { RoadmapEditor } from './_components/roadmap-editor';
import type { DirectReport } from './_components/add-task-drawer';
import { LoaderCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';


interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RoadmapEditorPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="h-full">
      <Suspense fallback={<RoadmapLoading />}>
        <RoadmapDataLoader id={id} />
      </Suspense>
    </div>
  );
}

async function RoadmapDataLoader({ id }: { id: string }) {
  const [session, roadmap] = await Promise.all([
    getSession(),
    getRoadmapById(id),
  ]);

  if (!session?.user || !roadmap) notFound();

  // FIX: previously this listed *every* active employee in the tenant as a
  // "direct report", letting any roadmap author assign tasks to anyone in the
  // org. Now it uses the real org-chart lookup that scopes by
  // `reportingManagerId == myEmployee._id`, matching the My Team grid.
  const reports = await getMyDirectReports();
  const directReports: DirectReport[] = reports.map((r) => ({
    _id: r._id,
    name: `${r.firstName} ${r.lastName}`.trim() || 'Unknown',
  }));

  return <RoadmapEditor roadmap={roadmap} directReports={directReports} />;
}

function RoadmapLoading() {
  return (
    <div className="flex h-full items-center justify-center min-h-[400px]">
      <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
    </div>
  );
}
