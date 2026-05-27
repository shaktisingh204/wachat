'use server';

/**
 * Public Gantt actions — back `/share/gantt/[hash]`.
 *
 * Lookup is keyed on `crm_projects.publicHash` AND `public_gantt_chart`
 * must be truthy. Tenant is implicitly trusted via the 32-char hash.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidPublicHash } from '@/lib/public-hash';

type PublicGanttTask = {
  _id: string;
  heading: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  milestoneId: string | null;
  completionPercent: number;
};

type PublicGanttMilestone = {
  _id: string;
  title: string;
  status: string;
  endDate: string | null;
  cost: number | null;
  currency: string | null;
};

type PublicGanttLink = {
  _id: string;
  source: string;
  target: string;
  type: string;
};

type PublicGanttView = {
  project: {
    _id: string;
    name: string;
    status: string;
    startDate: string | null;
    deadline: string | null;
    description: string | null;
  };
  tasks: PublicGanttTask[];
  milestones: PublicGanttMilestone[];
  links: PublicGanttLink[];
};

function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function statusToPercent(status: unknown): number {
  const s = String(status || '').toLowerCase();
  if (s === 'done' || s === 'completed') return 100;
  if (s === 'review') return 75;
  if (s === 'in-progress') return 50;
  if (s === 'todo') return 10;
  return 0;
}

export async function getPublicGantt(
  hash: string,
): Promise<PublicGanttView | null> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const project = await db.collection('crm_projects').findOne({
      publicHash: hash,
      public_gantt_chart: { $in: [true, 1] },
    });
    if (!project) return null;

    const projectIdCandidates: unknown[] = [
      project._id,
      project._id.toString(),
    ];

    const [tasksRaw, milestonesRaw, linksRaw] = await Promise.all([
      db
        .collection('crm_tasks')
        .find({ projectId: { $in: projectIdCandidates } })
        .sort({ startDate: 1, dueDate: 1 })
        .toArray(),
      db
        .collection('crm_project_milestones')
        .find({ projectId: { $in: projectIdCandidates } })
        .sort({ endDate: 1 })
        .toArray(),
      db
        .collection('crm_gantt_links')
        .find({ projectId: { $in: projectIdCandidates } })
        .toArray(),
    ]);

    const tasks: PublicGanttTask[] = tasksRaw.map((t) => ({
      _id: (t._id as ObjectId).toString(),
      heading: String(t.heading ?? ''),
      description: (t.description as string | undefined) ?? null,
      status: String(t.status ?? 'incomplete'),
      priority: (t.priority as string | undefined) ?? null,
      assigneeName: (t.assigneeName as string | undefined) ?? null,
      startDate: asIsoDate(t.startDate),
      dueDate: asIsoDate(t.dueDate),
      milestoneId: t.milestoneId ? String(t.milestoneId) : null,
      completionPercent: statusToPercent(t.status),
    }));

    const milestones: PublicGanttMilestone[] = milestonesRaw.map((m) => ({
      _id: (m._id as ObjectId).toString(),
      title: String(m.milestoneTitle ?? ''),
      status: String(m.status ?? 'incomplete'),
      endDate: asIsoDate(m.endDate),
      cost: m.cost != null ? Number(m.cost) : null,
      currency: (m.currency as string | undefined) ?? null,
    }));

    const links: PublicGanttLink[] = linksRaw.map((l) => ({
      _id: (l._id as ObjectId).toString(),
      source: String(l.source ?? ''),
      target: String(l.target ?? ''),
      type: String(l.type ?? 'FS'),
    }));

    return {
      project: {
        _id: (project._id as ObjectId).toString(),
        name:
          (project.name as string) ||
          (project.projectName as string) ||
          'Project',
        status: String(project.status ?? '—'),
        startDate: asIsoDate(project.startDate),
        deadline: asIsoDate(project.deadline ?? project.endDate),
        description: (project.description as string | undefined) ?? null,
      },
      tasks,
      milestones,
      links,
    };
  } catch (e) {
    console.error('[getPublicGantt] failed:', e);
    return null;
  }
}
