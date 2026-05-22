import { notFound } from 'next/navigation';

import { getRoadmapById } from '@/app/actions/hrm-roadmaps.actions';
import { getSession } from '@/app/actions/user.actions';
import { getMyDirectReports } from '@/app/actions/hrm-portal.actions';
import { RoadmapEditor } from './_components/roadmap-editor';
import type { DirectReport } from './_components/add-task-drawer';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RoadmapEditorPage({ params }: PageProps) {
  const { id } = await params;

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

  return (
    <div className="h-full">
      <RoadmapEditor roadmap={roadmap} directReports={directReports} />
    </div>
  );
}
