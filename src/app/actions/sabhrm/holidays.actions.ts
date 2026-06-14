'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  HolidayRow,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── local form type (not in shared types.ts) ────────────────────────── */

export type HolidayType = 'public' | 'restricted' | 'company';

export interface HolidayFormValues {
  name: string;
  /** ISO 'YYYY-MM-DD' date string from the date input. */
  date: string;
  type: HolidayType;
  recurring?: boolean;
}

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface HolidayDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  date: Date;
  type: HolidayType;
  recurring: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: HolidayDoc): HolidayRow {
  return {
    id: String(d._id),
    name: d.name,
    date: d.date ? d.date.toISOString().slice(0, 10) : '',
    type: d.type,
    recurring: !!d.recurring,
  };
}

/** Parse a 'YYYY-MM-DD' string into a UTC midnight Date (timezone-stable). */
function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listHolidays(
  params: ListParams = {},
): Promise<ActionResult<Paginated<HolidayRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { type: rx }];
    }

    const col = db.collection<HolidayDoc>(SABHRM_COLLECTIONS.holidays);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ date: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
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
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load holidays.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createHoliday(
  form: HolidayFormValues,
): Promise<ActionResult<HolidayRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const name = form.name?.trim();
  if (!name) return { ok: false, error: 'A holiday name is required.' };
  const date = form.date ? parseDate(form.date) : null;
  if (!date) return { ok: false, error: 'A valid date is required.' };
  const type: HolidayType =
    form.type === 'restricted' || form.type === 'company' ? form.type : 'public';

  try {
    const col = db.collection<HolidayDoc>(SABHRM_COLLECTIONS.holidays);
    const now = new Date();
    const doc: Omit<HolidayDoc, '_id'> = {
      workspaceId,
      name,
      date,
      type,
      recurring: !!form.recurring,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await col.insertOne(doc as HolidayDoc);
    revalidatePath('/sabhrm/holidays');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as HolidayDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create holiday.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateHoliday(
  id: string,
  form: Partial<HolidayFormValues>,
): Promise<ActionResult<HolidayRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid holiday id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<HolidayDoc>(SABHRM_COLLECTIONS.holidays);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Holiday not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.name !== undefined) {
      const name = form.name.trim();
      if (!name) return { ok: false, error: 'A holiday name is required.' };
      set.name = name;
    }
    if (form.date !== undefined) {
      const date = parseDate(form.date);
      if (!date) return { ok: false, error: 'A valid date is required.' };
      set.date = date;
    }
    if (form.type !== undefined) {
      set.type =
        form.type === 'restricted' || form.type === 'company' ? form.type : 'public';
    }
    if (form.recurring !== undefined) set.recurring = !!form.recurring;

    await col.updateOne({ _id: existing._id, workspaceId }, { $set: set });
    const updated = await col.findOne({ _id: existing._id, workspaceId });
    revalidatePath('/sabhrm/holidays');
    return { ok: true, data: toRow(updated as HolidayDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update holiday.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteHoliday(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid holiday id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<HolidayDoc>(SABHRM_COLLECTIONS.holidays)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Holiday not found.' };
    revalidatePath('/sabhrm/holidays');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete holiday.' };
  }
}
