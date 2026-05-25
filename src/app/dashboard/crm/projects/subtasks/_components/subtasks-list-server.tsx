import { getWsSubTasks } from '@/app/actions/worksuite/projects.actions';
import { SubtasksListClient } from './subtasks-list-client';

export const dynamic = 'force-dynamic';

export async function SubtasksListServer() {
  const data = await getWsSubTasks();
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    _id: r._id.toString(),
    taskId: r.taskId ? r.taskId.toString() : '',
    projectId: r.projectId ? r.projectId.toString() : undefined,
    assignedTo: r.assignedTo ? r.assignedTo.toString() : undefined,
    dependencyId: r.dependencyId ? r.dependencyId.toString() : undefined,
    startDate: r.startDate ? new Date(r.startDate).toISOString() : undefined,
    dueDate: r.dueDate ? new Date(r.dueDate).toISOString() : undefined,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
  }));

  return <SubtasksListClient initialRows={rows} />;
}
