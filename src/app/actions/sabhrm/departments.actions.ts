'use server';

import { ObjectId, type Db } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  DepartmentRow,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface DepartmentDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  code?: string;
  headEmployeeId?: string;
  headEmployeeName?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/* ── form values (local — not in shared types.ts) ────────────────────── */

export interface DepartmentFormValues {
  name: string;
  code?: string;
  headEmployeeId?: string;
}

/* ── head-employee name resolution ───────────────────────────────────── */

async function resolveHeadName(
  db: Db,
  workspaceId: string,
  headEmployeeId?: string,
): Promise<string | undefined> {
  if (!headEmployeeId || !ObjectId.isValid(headEmployeeId)) return undefined;
  const emp = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .findOne(
      { _id: new ObjectId(headEmployeeId), workspaceId },
      { projection: { displayName: 1, firstName: 1, lastName: 1 } },
    )) as Record<string, unknown> | null;
  if (!emp) return undefined;
  return String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());
}

/* ── employee-count rollup (count by departmentId) ───────────────────── */

async function countByDepartment(
  db: Db,
  workspaceId: string,
  departmentIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (departmentIds.length === 0) return out;
  const rows = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .aggregate([
      { $match: { workspaceId, departmentId: { $in: departmentIds } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ])
    .toArray()) as Array<{ _id: string; count: number }>;
  for (const r of rows) out.set(String(r._id), r.count);
  return out;
}

function toRow(d: DepartmentDoc, employeeCount: number): DepartmentRow {
  return {
    id: String(d._id),
    name: d.name,
    code: d.code ?? null,
    headEmployeeId: d.headEmployeeId ?? null,
    headEmployeeName: d.headEmployeeName ?? null,
    employeeCount,
  };
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listDepartments(
  params: ListParams = {},
): Promise<ActionResult<Paginated<DepartmentRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { code: rx }];
    }

    const col = db.collection<DepartmentDoc>(SABHRM_COLLECTIONS.departments);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    const counts = await countByDepartment(db, workspaceId, docs.map((d) => String(d._id)));

    return {
      ok: true,
      data: {
        rows: docs.map((d) => toRow(d, counts.get(String(d._id)) ?? 0)),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load departments.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createDepartment(
  form: DepartmentFormValues,
): Promise<ActionResult<DepartmentRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const name = form.name?.trim();
  if (!name) return { ok: false, error: 'Department name is required.' };

  try {
    const col = db.collection<DepartmentDoc>(SABHRM_COLLECTIONS.departments);

    // Uniqueness within the workspace (case-insensitive name).
    const dupe = await col.findOne(
      { workspaceId, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { projection: { _id: 1 } },
    );
    if (dupe) return { ok: false, error: `A department named "${name}" already exists.` };

    const headEmployeeName = await resolveHeadName(db, workspaceId, form.headEmployeeId);

    const now = new Date();
    const doc: Omit<DepartmentDoc, '_id'> = {
      workspaceId,
      name,
      code: form.code?.trim() || undefined,
      headEmployeeId: form.headEmployeeId || undefined,
      headEmployeeName,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await col.insertOne(doc as DepartmentDoc);
    revalidatePath('/sabhrm/departments');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as DepartmentDoc), _id: ins.insertedId }, 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create department.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateDepartment(
  id: string,
  form: Partial<DepartmentFormValues>,
): Promise<ActionResult<DepartmentRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid department id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<DepartmentDoc>(SABHRM_COLLECTIONS.departments);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Department not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.name !== undefined) {
      const name = form.name.trim();
      if (!name) return { ok: false, error: 'Department name is required.' };
      set.name = name;
    }
    if (form.code !== undefined) set.code = form.code.trim() || undefined;
    if (form.headEmployeeId !== undefined) {
      set.headEmployeeId = form.headEmployeeId || undefined;
      set.headEmployeeName = await resolveHeadName(db, workspaceId, form.headEmployeeId);
    }

    await col.updateOne({ _id: existing._id }, { $set: set });
    const updated = (await col.findOne({ _id: existing._id })) as DepartmentDoc;
    const counts = await countByDepartment(db, workspaceId, [String(existing._id)]);
    revalidatePath('/sabhrm/departments');
    return { ok: true, data: toRow(updated, counts.get(String(existing._id)) ?? 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update department.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid department id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<DepartmentDoc>(SABHRM_COLLECTIONS.departments)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Department not found.' };
    revalidatePath('/sabhrm/departments');
    revalidatePath('/sabhrm');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete department.' };
  }
}

/* ── head-employee picker options ────────────────────────────────────── */

export interface DepartmentPickerOptions {
  heads: Array<{ value: string; label: string }>;
}

export async function getDepartmentPickerOptions(): Promise<ActionResult<DepartmentPickerOptions>> {
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
        heads: emps.map((d) => {
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
