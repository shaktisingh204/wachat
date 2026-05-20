'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  createTaskReport,
  resolveEmployeeNameById,
} from '@/app/actions/hrm-task-reports.actions';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface RoadmapTask {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  startDate?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  completedAt?: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  tasks: RoadmapTask[];
}

export interface HrmRoadmap {
  _id: string;
  userId: string;
  createdBy: string;
  title: string;
  description?: string;
  phases: RoadmapPhase[];
  status: 'draft' | 'active' | 'completed' | 'archived';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const COLLECTION = 'hrm_roadmaps';

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getRoadmaps(): Promise<HrmRoadmap[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const docs = await db
      .collection(COLLECTION)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(docs)) as HrmRoadmap[];
  } catch (e) {
    console.error('[getRoadmaps] failed:', e);
    return [];
  }
}

export async function getRoadmapById(id: string): Promise<HrmRoadmap | null> {
  const session = await getSession();
  if (!session?.user) return null;

  try {
    if (!ObjectId.isValid(id)) return null;
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const doc = await db
      .collection(COLLECTION)
      .findOne({ _id: new ObjectId(id), userId });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc)) as HrmRoadmap;
  } catch (e) {
    console.error('[getRoadmapById] failed:', e);
    return null;
  }
}

/* ─── KPIs ───────────────────────────────────────────────────────────── */

export async function getRoadmapKpis(): Promise<{ label: string; value: number }[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const docs = await db
      .collection(COLLECTION)
      .find({ userId })
      .toArray();

    const roadmaps = docs as unknown as HrmRoadmap[];
    const total = roadmaps.length;
    const active = roadmaps.filter((r) => r.status === 'active').length;
    const completed = roadmaps.filter((r) => r.status === 'completed').length;
    const tasksDone = roadmaps.reduce((acc, r) => {
      return (
        acc +
        r.phases.reduce(
          (pa, ph) => pa + ph.tasks.filter((t) => t.status === 'done').length,
          0,
        )
      );
    }, 0);

    return [
      { label: 'Total', value: total },
      { label: 'Active', value: active },
      { label: 'Completed', value: completed },
      { label: 'Tasks Done', value: tasksDone },
    ];
  } catch (e) {
    console.error('[getRoadmapKpis] failed:', e);
    return [];
  }
}

/* ─── Mutations ──────────────────────────────────────────────────────── */

export async function createRoadmap(data: {
  title: string;
  description?: string;
  phases: RoadmapPhase[];
  status?: HrmRoadmap['status'];
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Not authenticated' };

  if (!data.title?.trim()) return { success: false, error: 'Title is required' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const now = new Date().toISOString();

    const doc = {
      userId,
      createdBy: session.user._id,
      title: data.title.trim(),
      description: data.description?.trim(),
      phases: data.phases,
      status: data.status ?? 'draft',
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTION).insertOne(doc);
    revalidatePath('/dashboard/hrm/portal/roadmaps');
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    console.error('[createRoadmap] failed:', e);
    return { success: false, error: 'Failed to create roadmap' };
  }
}

export async function updateRoadmap(
  id: string,
  data: Partial<Omit<HrmRoadmap, '_id' | 'userId' | 'createdAt'>>,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Not authenticated' };

  try {
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const { _id: _removed, userId: _u, createdAt: _c, ...safe } = data as Record<string, unknown>;

    const result = await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { ...safe, updatedAt: new Date().toISOString() } },
    );

    if (result.matchedCount === 0) return { success: false, error: 'Roadmap not found' };
    revalidatePath('/dashboard/hrm/portal/roadmaps');
    revalidatePath(`/dashboard/hrm/portal/roadmaps/${id}`);
    return { success: true };
  } catch (e) {
    console.error('[updateRoadmap] failed:', e);
    return { success: false, error: 'Failed to update roadmap' };
  }
}

export async function deleteRoadmap(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Not authenticated' };

  try {
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const result = await db
      .collection(COLLECTION)
      .deleteOne({ _id: new ObjectId(id), userId });
    if (result.deletedCount === 0) return { success: false, error: 'Roadmap not found' };
    revalidatePath('/dashboard/hrm/portal/roadmaps');
    return { success: true };
  } catch (e) {
    console.error('[deleteRoadmap] failed:', e);
    return { success: false, error: 'Failed to delete roadmap' };
  }
}

export async function updateTaskStatus(
  roadmapId: string,
  phaseId: string,
  taskId: string,
  status: RoadmapTask['status'],
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Not authenticated' };

  try {
    if (!ObjectId.isValid(roadmapId)) return { success: false, error: 'Invalid id' };
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const now = new Date().toISOString();

    const roadmap = await db
      .collection(COLLECTION)
      .findOne({ _id: new ObjectId(roadmapId), userId });
    if (!roadmap) return { success: false, error: 'Roadmap not found' };

    const phases = (roadmap.phases ?? []) as RoadmapPhase[];
    let task: RoadmapTask | undefined;

    const updatedPhases = phases.map((phase) => {
      if (phase.id !== phaseId) return phase;
      return {
        ...phase,
        tasks: phase.tasks.map((t) => {
          if (t.id !== taskId) return t;
          task = t;
          return {
            ...t,
            status,
            completedAt: status === 'done' ? now : t.completedAt,
          };
        }),
      };
    });

    await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(roadmapId), userId },
      { $set: { phases: updatedPhases, updatedAt: now } },
    );

    // Auto-report on task completion — delegates to hrm-task-reports.actions
    // so the manager sees it in the Reports Inbox (/portal/reports).
    if (status === 'done' && task) {
      const workerId = task.assigneeId ?? String(session.user._id);
      const assignerId = String(roadmap.createdBy ?? session.user._id);

      const [workerName, assignerName] = await Promise.all([
        resolveEmployeeNameById(String(session.user._id), workerId),
        resolveEmployeeNameById(String(session.user._id), assignerId),
      ]);

      // Best-effort: a report write failure must not unwind the task update.
      await createTaskReport({
        roadmapId,
        phaseId,
        taskId,
        taskTitle: task.title,
        workerId,
        workerName,
        assignerId,
        assignerName,
        completedAt: now,
      }).catch((err: unknown) => {
        console.error('[updateTaskStatus] createTaskReport best-effort failed:', err);
      });
    }

    revalidatePath(`/dashboard/hrm/portal/roadmaps/${roadmapId}`);
    return { success: true };
  } catch (e) {
    console.error('[updateTaskStatus] failed:', e);
    return { success: false, error: 'Failed to update task' };
  }
}
