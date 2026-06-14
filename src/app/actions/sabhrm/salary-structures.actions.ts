'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  ListParams,
  Paginated,
  SalaryComponent,
  SalaryStructureRow,
} from '@/lib/sabhrm/types';

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface SalaryStructureDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  ctc: number;
  components: SalaryComponent[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/** Form payload for create/update (define locally — not in shared types). */
export interface SalaryStructureFormValues {
  name: string;
  ctc: number;
  components: SalaryComponent[];
}

function sanitizeComponents(input: unknown): SalaryComponent[] {
  if (!Array.isArray(input)) return [];
  const out: SalaryComponent[] = [];
  for (const raw of input) {
    const c = raw as Partial<SalaryComponent> | null;
    if (!c) continue;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    if (!name) continue;
    const kind: SalaryComponent['kind'] = c.kind === 'deduction' ? 'deduction' : 'earning';
    const calc: SalaryComponent['calc'] =
      c.calc === 'percent_of_basic' ? 'percent_of_basic' : 'flat';
    const value = typeof c.value === 'number' && !Number.isNaN(c.value) ? c.value : 0;
    out.push({ name, kind, calc, value });
  }
  return out;
}

function toRow(d: SalaryStructureDoc, employeeCount: number): SalaryStructureRow {
  return {
    id: String(d._id),
    name: d.name,
    ctc: typeof d.ctc === 'number' ? d.ctc : 0,
    components: Array.isArray(d.components) ? d.components : [],
    employeeCount,
  };
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listSalaryStructures(
  params: ListParams = {},
): Promise<ActionResult<Paginated<SalaryStructureRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.name = rx;
    }

    const col = db.collection<SalaryStructureDoc>(SABHRM_COLLECTIONS.salaryStructures);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    // Count employees assigned to each structure in one grouped query.
    const employees = db.collection(SABHRM_COLLECTIONS.employees);
    const ids = docs.map((d) => String(d._id));
    const counts = new Map<string, number>();
    if (ids.length) {
      const grouped = await employees
        .aggregate<{ _id: string; count: number }>([
          { $match: { workspaceId, salaryStructureId: { $in: ids } } },
          { $group: { _id: '$salaryStructureId', count: { $sum: 1 } } },
        ])
        .toArray();
      for (const row of grouped) counts.set(String(row._id), row.count);
    }

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
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load salary structures.' };
  }
}

/* ── get ─────────────────────────────────────────────────────────────── */

export async function getSalaryStructure(id: string): Promise<ActionResult<SalaryStructureRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid salary structure id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const doc = await db
      .collection<SalaryStructureDoc>(SABHRM_COLLECTIONS.salaryStructures)
      .findOne({ _id: new ObjectId(id), workspaceId });
    if (!doc) return { ok: false, error: 'Salary structure not found.' };
    const employeeCount = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .countDocuments({ workspaceId, salaryStructureId: id });
    return { ok: true, data: toRow(doc, employeeCount) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load salary structure.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createSalaryStructure(
  form: SalaryStructureFormValues,
): Promise<ActionResult<SalaryStructureRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const name = form.name?.trim();
  if (!name) return { ok: false, error: 'A name is required.' };
  const ctc = typeof form.ctc === 'number' && !Number.isNaN(form.ctc) ? form.ctc : 0;
  if (ctc < 0) return { ok: false, error: 'CTC cannot be negative.' };

  try {
    const col = db.collection<SalaryStructureDoc>(SABHRM_COLLECTIONS.salaryStructures);
    const dupe = await col.findOne({ workspaceId, name }, { projection: { _id: 1 } });
    if (dupe) return { ok: false, error: `A salary structure named "${name}" already exists.` };

    const now = new Date();
    const doc: Omit<SalaryStructureDoc, '_id'> = {
      workspaceId,
      name,
      ctc,
      components: sanitizeComponents(form.components),
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await col.insertOne(doc as SalaryStructureDoc);
    revalidatePath('/sabhrm/salary-structures');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as SalaryStructureDoc), _id: ins.insertedId }, 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create salary structure.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateSalaryStructure(
  id: string,
  form: Partial<SalaryStructureFormValues>,
): Promise<ActionResult<SalaryStructureRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid salary structure id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<SalaryStructureDoc>(SABHRM_COLLECTIONS.salaryStructures);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Salary structure not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.name !== undefined) {
      const name = form.name.trim();
      if (!name) return { ok: false, error: 'A name is required.' };
      const dupe = await col.findOne(
        { workspaceId, name, _id: { $ne: existing._id } },
        { projection: { _id: 1 } },
      );
      if (dupe) return { ok: false, error: `A salary structure named "${name}" already exists.` };
      set.name = name;
    }
    if (form.ctc !== undefined) {
      const ctc = typeof form.ctc === 'number' && !Number.isNaN(form.ctc) ? form.ctc : 0;
      if (ctc < 0) return { ok: false, error: 'CTC cannot be negative.' };
      set.ctc = ctc;
    }
    if (form.components !== undefined) set.components = sanitizeComponents(form.components);

    await col.updateOne({ _id: existing._id }, { $set: set });
    const updated = await col.findOne({ _id: existing._id });
    const employeeCount = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .countDocuments({ workspaceId, salaryStructureId: id });
    revalidatePath('/sabhrm/salary-structures');
    return { ok: true, data: toRow(updated as SalaryStructureDoc, employeeCount) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update salary structure.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteSalaryStructure(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid salary structure id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const assigned = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .countDocuments({ workspaceId, salaryStructureId: id });
    if (assigned > 0) {
      return {
        ok: false,
        error: `Can't delete — ${assigned} employee${assigned === 1 ? '' : 's'} still use this structure.`,
      };
    }
    const res = await db
      .collection<SalaryStructureDoc>(SABHRM_COLLECTIONS.salaryStructures)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Salary structure not found.' };
    revalidatePath('/sabhrm/salary-structures');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete salary structure.' };
  }
}
