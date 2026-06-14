'use server';

import { ObjectId, type Db } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  DesignationRow,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── form values (local — not in shared types) ───────────────────────── */

export interface DesignationFormValues {
  name: string;
  level?: number;
  departmentId?: string;
}

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface DesignationDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  level?: number;
  departmentId?: string;
  departmentName?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: DesignationDoc, employeeCount = 0): DesignationRow {
  return {
    id: String(d._id),
    name: d.name,
    level: typeof d.level === 'number' ? d.level : null,
    departmentId: d.departmentId ?? null,
    departmentName: d.departmentName ?? null,
    employeeCount,
  };
}

/* ── department name resolution ──────────────────────────────────────── */

async function resolveDepartmentName(
  db: Db,
  workspaceId: string,
  departmentId?: string,
): Promise<string | undefined> {
  if (departmentId && ObjectId.isValid(departmentId)) {
    const dep = await db
      .collection(SABHRM_COLLECTIONS.departments)
      .findOne({ _id: new ObjectId(departmentId), workspaceId }, { projection: { name: 1 } });
    if (dep) return String((dep as Record<string, unknown>).name);
  }
  return undefined;
}

/* ── employee counts per designation ─────────────────────────────────── */

async function employeeCounts(
  db: Db,
  workspaceId: string,
  designationIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (designationIds.length === 0) return out;
  const agg = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .aggregate([
      { $match: { workspaceId, designationId: { $in: designationIds } } },
      { $group: { _id: '$designationId', count: { $sum: 1 } } },
    ])
    .toArray()) as Array<{ _id: string; count: number }>;
  for (const row of agg) out[String(row._id)] = row.count;
  return out;
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listDesignations(
  params: ListParams = {},
): Promise<ActionResult<Paginated<DesignationRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.departmentId) filter.departmentId = params.departmentId;
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { departmentName: rx }];
    }

    const col = db.collection<DesignationDoc>(SABHRM_COLLECTIONS.designations);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ level: 1, name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    const counts = await employeeCounts(db, workspaceId, docs.map((d) => String(d._id)));

    return {
      ok: true,
      data: {
        rows: docs.map((d) => toRow(d, counts[String(d._id)] ?? 0)),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load designations.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createDesignation(
  form: DesignationFormValues,
): Promise<ActionResult<DesignationRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const name = form.name?.trim();
  if (!name) return { ok: false, error: 'A designation name is required.' };

  try {
    const designations = db.collection<DesignationDoc>(SABHRM_COLLECTIONS.designations);

    const dupe = await designations.findOne(
      { workspaceId, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { projection: { _id: 1 } },
    );
    if (dupe) return { ok: false, error: `A designation named "${name}" already exists.` };

    const departmentName = await resolveDepartmentName(db, workspaceId, form.departmentId);

    const now = new Date();
    const doc: Omit<DesignationDoc, '_id'> = {
      workspaceId,
      name,
      level: typeof form.level === 'number' && !Number.isNaN(form.level) ? form.level : undefined,
      departmentId: form.departmentId || undefined,
      departmentName,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await designations.insertOne(doc as DesignationDoc);
    revalidatePath('/sabhrm/designations');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as DesignationDoc), _id: ins.insertedId }, 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create designation.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateDesignation(
  id: string,
  form: Partial<DesignationFormValues>,
): Promise<ActionResult<DesignationRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid designation id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const designations = db.collection<DesignationDoc>(SABHRM_COLLECTIONS.designations);
    const existing = await designations.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Designation not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.name !== undefined) {
      const name = form.name.trim();
      if (!name) return { ok: false, error: 'A designation name is required.' };
      const dupe = await designations.findOne(
        {
          workspaceId,
          _id: { $ne: existing._id },
          name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        },
        { projection: { _id: 1 } },
      );
      if (dupe) return { ok: false, error: `A designation named "${name}" already exists.` };
      set.name = name;
    }
    if (form.level !== undefined) {
      set.level = typeof form.level === 'number' && !Number.isNaN(form.level) ? form.level : undefined;
    }
    if (form.departmentId !== undefined) {
      set.departmentId = form.departmentId || undefined;
      set.departmentName = await resolveDepartmentName(db, workspaceId, form.departmentId);
    }

    await designations.updateOne({ _id: existing._id }, { $set: set });
    const updated = (await designations.findOne({ _id: existing._id })) as DesignationDoc;
    const counts = await employeeCounts(db, workspaceId, [String(existing._id)]);
    revalidatePath('/sabhrm/designations');
    return { ok: true, data: toRow(updated, counts[String(existing._id)] ?? 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update designation.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteDesignation(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid designation id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<DesignationDoc>(SABHRM_COLLECTIONS.designations)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Designation not found.' };
    revalidatePath('/sabhrm/designations');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete designation.' };
  }
}

/* ── department picker options ───────────────────────────────────────── */

export interface DesignationPickerOptions {
  departments: Array<{ value: string; label: string }>;
}

export async function getDesignationPickerOptions(): Promise<ActionResult<DesignationPickerOptions>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const deps = await db
      .collection(SABHRM_COLLECTIONS.departments)
      .find({ workspaceId }, { projection: { name: 1 } })
      .limit(500)
      .toArray();
    return {
      ok: true,
      data: {
        departments: deps.map((d) => ({ value: String(d._id), label: String((d as Record<string, unknown>).name) })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load options.' };
  }
}
