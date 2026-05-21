'use server';

/**
 * Public taskboard actions — back `/share/taskboard/[hash]`.
 *
 * Lookup is keyed on `crm_projects.publicHash` AND `public_taskboard`
 * must be truthy. Tenant is implicitly trusted via the 32-char hash.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidPublicHash } from '@/lib/public-hash';

export type PublicTaskboardCard = {
  _id: string;
  heading: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeName: string | null;
  dueDate: string | null;
};

export type PublicTaskboardColumn = {
  _id: string;
  name: string;
  color: string;
  priority: number;
  cards: PublicTaskboardCard[];
};

export type PublicTaskboardView = {
  project: {
    _id: string;
    name: string;
    status: string;
    startDate: string | null;
    deadline: string | null;
  };
  columns: PublicTaskboardColumn[];
};

function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getPublicTaskboard(
  hash: string,
): Promise<PublicTaskboardView | null> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const project = await db.collection('crm_projects').findOne({
      publicHash: hash,
      public_taskboard: { $in: [true, 1] },
    });
    if (!project) return null;

    const tenantUserId = project.userId as ObjectId | string | undefined;
    if (!tenantUserId) return null;

    const projectIdCandidates: unknown[] = [
      project._id,
      project._id.toString(),
    ];

    // Columns are tenant-scoped (not per-project in current schema).
    const columnFilter: Record<string, unknown> = { userId: tenantUserId };

    const [columnsRaw, tasksRaw] = await Promise.all([
      db
        .collection('crm_taskboard_columns')
        .find(columnFilter)
        .sort({ priority: 1 })
        .toArray(),
      db
        .collection('crm_tasks')
        .find({ projectId: { $in: projectIdCandidates } })
        .sort({ columnPriority: 1, createdAt: 1 })
        .toArray(),
    ]);

    const cards: PublicTaskboardCard[] = tasksRaw.map((t) => ({
      _id: (t._id as ObjectId).toString(),
      heading: String(t.heading ?? ''),
      description: (t.description as string | undefined) ?? null,
      status: String(t.status ?? 'incomplete'),
      priority: (t.priority as string | undefined) ?? null,
      assigneeName: (t.assigneeName as string | undefined) ?? null,
      dueDate: asIsoDate(t.dueDate),
    }));

    const columns: PublicTaskboardColumn[] = columnsRaw.map((c) => {
      const colId = (c._id as ObjectId).toString();
      const cardsInCol = tasksRaw
        .filter((t) => {
          const bcid = t.boardColumnId;
          return bcid != null && String(bcid) === colId;
        })
        .map((t) => cards.find((card) => card._id === (t._id as ObjectId).toString()))
        .filter((x): x is PublicTaskboardCard => Boolean(x));
      return {
        _id: colId,
        name: String(c.columnName ?? ''),
        color: String(c.labelColor ?? '#71717a'),
        priority: Number(c.priority ?? 0),
        cards: cardsInCol,
      };
    });

    // Add an "Unassigned" virtual column for tasks without a boardColumnId.
    const unassigned = cards.filter((card) => {
      const raw = tasksRaw.find((t) => (t._id as ObjectId).toString() === card._id);
      return !raw?.boardColumnId;
    });
    if (unassigned.length > 0) {
      columns.unshift({
        _id: '__unassigned__',
        name: 'Unassigned',
        color: '#a1a1aa',
        priority: -1,
        cards: unassigned,
      });
    }

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
      },
      columns,
    };
  } catch (e) {
    console.error('[getPublicTaskboard] failed:', e);
    return null;
  }
}
