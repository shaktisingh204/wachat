'use server';

import { ObjectId, type Db } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  GoalRow,
  GoalStatus,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface GoalDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  metric?: string;
  target?: number;
  progress: number; // 0-100
  dueDate?: Date;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: GoalDoc): GoalRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    title: d.title,
    description: d.description ?? null,
    metric: d.metric ?? null,
    target: typeof d.target === 'number' ? d.target : null,
    progress: typeof d.progress === 'number' ? d.progress : 0,
    dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : null,
    status: d.status,
  };
}

function clampProgress(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/* ── employee name resolution ────────────────────────────────────────── */

async function resolveEmployeeName(
  db: Db,
  workspaceId: string,
  employeeId: string,
): Promise<string | null> {
  if (!employeeId || !ObjectId.isValid(employeeId)) return null;
  const emp = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .findOne(
      { _id: new ObjectId(employeeId), workspaceId },
      { projection: { displayName: 1, firstName: 1, lastName: 1 } },
    )) as Record<string, unknown> | null;
  if (!emp) return null;
  return String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());
}

/* ── form values ─────────────────────────────────────────────────────── */

export interface GoalFormValues {
  employeeId: string;
  title: string;
  description?: string;
  metric?: string;
  target?: number;
  progress?: number;
  dueDate?: string;
  status?: GoalStatus;
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listGoals(
  params: ListParams = {},
): Promise<ActionResult<Paginated<GoalRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.status) filter.status = params.status;
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, { employeeName: rx }, { metric: rx }, { description: rx }];
    }

    const col = db.collection<GoalDoc>(SABHRM_COLLECTIONS.goals);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    return {
      ok: true,
      data: {
        rows: docs.map(toRow),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load goals.' };
  }
}

/* ── get ─────────────────────────────────────────────────────────────── */

export async function getGoal(id: string): Promise<ActionResult<GoalRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid goal id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const doc = await db
      .collection<GoalDoc>(SABHRM_COLLECTIONS.goals)
      .findOne({ _id: new ObjectId(id), workspaceId });
    if (!doc) return { ok: false, error: 'Goal not found.' };
    return { ok: true, data: toRow(doc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load goal.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createGoal(
  form: GoalFormValues,
): Promise<ActionResult<GoalRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const title = form.title?.trim();
  const employeeId = form.employeeId?.trim();
  if (!title) return { ok: false, error: 'A goal title is required.' };
  if (!employeeId) return { ok: false, error: 'An employee is required.' };

  try {
    const employeeName = await resolveEmployeeName(db, workspaceId, employeeId);
    if (!employeeName) return { ok: false, error: 'Selected employee was not found.' };

    const now = new Date();
    const doc: Omit<GoalDoc, '_id'> = {
      workspaceId,
      employeeId,
      employeeName,
      title,
      description: form.description?.trim() || undefined,
      metric: form.metric?.trim() || undefined,
      target: typeof form.target === 'number' ? form.target : undefined,
      progress: clampProgress(form.progress ?? 0),
      dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
      status: form.status ?? 'not_started',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await db
      .collection<GoalDoc>(SABHRM_COLLECTIONS.goals)
      .insertOne(doc as GoalDoc);
    revalidatePath('/sabhrm/goals');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as GoalDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create goal.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateGoal(
  id: string,
  form: Partial<GoalFormValues>,
): Promise<ActionResult<GoalRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid goal id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const goals = db.collection<GoalDoc>(SABHRM_COLLECTIONS.goals);
    const existing = await goals.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Goal not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.employeeId !== undefined) {
      const employeeId = form.employeeId.trim();
      const employeeName = await resolveEmployeeName(db, workspaceId, employeeId);
      if (!employeeName) return { ok: false, error: 'Selected employee was not found.' };
      set.employeeId = employeeId;
      set.employeeName = employeeName;
    }
    if (form.title !== undefined) set.title = form.title.trim();
    if (form.description !== undefined) set.description = form.description.trim() || undefined;
    if (form.metric !== undefined) set.metric = form.metric.trim() || undefined;
    if (form.target !== undefined) set.target = typeof form.target === 'number' ? form.target : undefined;
    if (form.progress !== undefined) set.progress = clampProgress(form.progress);
    if (form.dueDate !== undefined) set.dueDate = form.dueDate ? new Date(form.dueDate) : undefined;
    if (form.status !== undefined) set.status = form.status;

    await goals.updateOne({ _id: existing._id, workspaceId }, { $set: set });
    const updated = await goals.findOne({ _id: existing._id, workspaceId });
    revalidatePath('/sabhrm/goals');
    return { ok: true, data: toRow(updated as GoalDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update goal.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteGoal(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid goal id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<GoalDoc>(SABHRM_COLLECTIONS.goals)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Goal not found.' };
    revalidatePath('/sabhrm/goals');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete goal.' };
  }
}

/* ── employee picker options for the form ────────────────────────────── */

export interface GoalPickerOptions {
  employees: Array<{ value: string; label: string }>;
}

export async function getGoalPickerOptions(): Promise<ActionResult<GoalPickerOptions>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const emps = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .find({ workspaceId }, { projection: { displayName: 1, firstName: 1, lastName: 1 } })
      .limit(1000)
      .toArray();
    return {
      ok: true,
      data: {
        employees: emps.map((d) => {
          const r = d as Record<string, unknown>;
          return {
            value: String(r._id),
            label: String(r.displayName || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()),
          };
        }),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load options.' };
  }
}
