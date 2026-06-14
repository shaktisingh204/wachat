'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type { ActionResult, ListParams, Paginated, ShiftRow } from '@/lib/sabhrm/types';

/* ── form contract (local — not in shared types.ts) ──────────────────── */

export interface ShiftFormValues {
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  weekOffs: number[]; // 0=Sun..6=Sat
  active: boolean;
}

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface ShiftDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  weekOffs: number[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: ShiftDoc, employeeCount: number): ShiftRow {
  return {
    id: String(d._id),
    name: d.name,
    startTime: d.startTime,
    endTime: d.endTime,
    breakMinutes: typeof d.breakMinutes === 'number' ? d.breakMinutes : 0,
    weekOffs: Array.isArray(d.weekOffs) ? d.weekOffs : [],
    active: d.active !== false,
    employeeCount,
  };
}

/* ── validation helpers ──────────────────────────────────────────────── */

const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeWeekOffs(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<number>();
  for (const v of input) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listShifts(
  params: ListParams = {},
): Promise<ActionResult<Paginated<ShiftRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.name = rx;
    }

    const col = db.collection<ShiftDoc>(SABHRM_COLLECTIONS.shifts);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ]);

    // employeeCount per shift — employees whose shiftId references this shift.
    const employees = db.collection(SABHRM_COLLECTIONS.employees);
    const counts = await Promise.all(
      docs.map((d) =>
        employees.countDocuments({ workspaceId, shiftId: String(d._id) }),
      ),
    );

    return {
      ok: true,
      data: {
        rows: docs.map((d, i) => toRow(d, counts[i] ?? 0)),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load shifts.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createShift(form: ShiftFormValues): Promise<ActionResult<ShiftRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const name = form.name?.trim();
  if (!name) return { ok: false, error: 'A shift name is required.' };
  if (!TIME_RX.test(form.startTime || '')) return { ok: false, error: 'A valid start time (HH:mm) is required.' };
  if (!TIME_RX.test(form.endTime || '')) return { ok: false, error: 'A valid end time (HH:mm) is required.' };
  const breakMinutes = Number.isFinite(form.breakMinutes) ? Math.max(0, Math.round(form.breakMinutes)) : 0;

  try {
    const col = db.collection<ShiftDoc>(SABHRM_COLLECTIONS.shifts);
    const dupe = await col.findOne({ workspaceId, name }, { projection: { _id: 1 } });
    if (dupe) return { ok: false, error: `A shift named "${name}" already exists.` };

    const now = new Date();
    const doc: Omit<ShiftDoc, '_id'> = {
      workspaceId,
      name,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes,
      weekOffs: normalizeWeekOffs(form.weekOffs),
      active: form.active !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await col.insertOne(doc as ShiftDoc);
    revalidatePath('/sabhrm/shifts');
    return { ok: true, data: toRow({ ...(doc as ShiftDoc), _id: ins.insertedId }, 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create shift.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateShift(
  id: string,
  form: Partial<ShiftFormValues>,
): Promise<ActionResult<ShiftRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid shift id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<ShiftDoc>(SABHRM_COLLECTIONS.shifts);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Shift not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.name !== undefined) {
      const name = form.name.trim();
      if (!name) return { ok: false, error: 'A shift name is required.' };
      set.name = name;
    }
    if (form.startTime !== undefined) {
      if (!TIME_RX.test(form.startTime)) return { ok: false, error: 'A valid start time (HH:mm) is required.' };
      set.startTime = form.startTime;
    }
    if (form.endTime !== undefined) {
      if (!TIME_RX.test(form.endTime)) return { ok: false, error: 'A valid end time (HH:mm) is required.' };
      set.endTime = form.endTime;
    }
    if (form.breakMinutes !== undefined) {
      set.breakMinutes = Number.isFinite(form.breakMinutes) ? Math.max(0, Math.round(form.breakMinutes)) : 0;
    }
    if (form.weekOffs !== undefined) set.weekOffs = normalizeWeekOffs(form.weekOffs);
    if (form.active !== undefined) set.active = form.active !== false;

    await col.updateOne({ _id: existing._id, workspaceId }, { $set: set });
    const updated = (await col.findOne({ _id: existing._id, workspaceId })) as ShiftDoc;
    const employeeCount = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .countDocuments({ workspaceId, shiftId: String(updated._id) });
    revalidatePath('/sabhrm/shifts');
    return { ok: true, data: toRow(updated, employeeCount) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update shift.' };
  }
}

/* ── set active ──────────────────────────────────────────────────────── */

export async function setShiftActive(id: string, active: boolean): Promise<ActionResult<ShiftRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid shift id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<ShiftDoc>(SABHRM_COLLECTIONS.shifts);
    const res = await col.findOneAndUpdate(
      { _id: new ObjectId(id), workspaceId },
      { $set: { active: !!active, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    const updated = (res as unknown as { value?: ShiftDoc } | ShiftDoc | null);
    const doc = (updated && 'value' in (updated as object) ? (updated as { value?: ShiftDoc }).value : updated) as ShiftDoc | null;
    if (!doc) return { ok: false, error: 'Shift not found.' };
    const employeeCount = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .countDocuments({ workspaceId, shiftId: String(doc._id) });
    revalidatePath('/sabhrm/shifts');
    return { ok: true, data: toRow(doc, employeeCount) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update shift.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteShift(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid shift id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<ShiftDoc>(SABHRM_COLLECTIONS.shifts)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Shift not found.' };
    revalidatePath('/sabhrm/shifts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete shift.' };
  }
}
