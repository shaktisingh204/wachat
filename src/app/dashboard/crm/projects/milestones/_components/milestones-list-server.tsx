import { getWsProjectMilestones } from '@/app/actions/worksuite/projects.actions';
import { MilestonesListClient } from './milestones-list-client';

export const dynamic = 'force-dynamic';

export async function MilestonesListServer() {
  const data = await getWsProjectMilestones();
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    _id: r._id.toString(),
    projectId: r.projectId ? r.projectId.toString() : undefined,
    userId: r.userId ? r.userId.toString() : undefined,
    startDate: r.startDate ? new Date(r.startDate).toISOString() : undefined,
    endDate: r.endDate ? new Date(r.endDate).toISOString() : undefined,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
  }));

  return <MilestonesListClient initialRows={rows} />;
}
