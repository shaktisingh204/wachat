'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  ListParams,
  Paginated,
  TimeLogRow,
} from '@/lib/sabhrm/types';

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface TimeLogDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  project?: string;
  task?: string;
  hours: number;
  billable: boolean;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: TimeLogDoc): TimeLogRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    date: d.date ? d.date.toISOString().slice(0, 10) : '',
    project: d.project ?? null,
    task: d.task ?? null,
    hours: typeof d.hours === 'number' ? d.hours : 0,
    billable: Boolean(d.billable),
    approved: Boolean(d.approved),
  };
}

/* ── form values (local — not in shared types) ───────────────────────── */

export interface TimeLogFormValues {
  employeeId: string;
  date: string;
  project?: string;
  task?: string;
  hours: number;
  billable?: boolean;
}

/* ── employee name resolution ────────────────────────────────────────── */

async function resolveEmployeeName(
  db: import('mongodb').Db,
  workspaceId: string,
  employeeId: string,
): Promise<string | null> {
  if (!ObjectId.isValid(employeeId)) return null;
  const emp = (await db
    .collection(SABHRM_COLLECTIONS.employees)
    .findOne(
      { _id: new ObjectId(employeeId), workspaceId },
      { projection: { displayName: 1, firstName: 1, lastName: 1 } },
    )) as Record<string, unknown> | null;
  if (!emp) return null;
  return String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listTimeLogs(
  params: ListParams = {},
): Promise<ActionResult<Paginated<TimeLogRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const filter: Record<string, unknown> = { workspaceId };

    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ employeeName: rx }, { project: rx }, { task: rx }];
    }
    if (params.from || params.to) {
      const dateRange: Record<string, Date> = {};
      if (params.from) dateRange.$gte = new Date(params.from);
      if (params.to) {
        const end = new Date(params.to);
        end.setHours(23, 59, 59, 999);
        dateRange.$lte = end;
      }
      filter.date = dateRange;
    }

    const col = db.collection<TimeLogDoc>(SABHRM_COLLECTIONS.timeLogs);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
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
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load time logs.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createTimeLog(
  form: TimeLogFormValues,
): Promise<ActionResult<TimeLogRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const employeeId = form.employeeId?.trim();
  if (!employeeId || !ObjectId.isValid(employeeId)) {
    return { ok: false, error: 'Select an employee.' };
  }
  if (!form.date) return { ok: false, error: 'A date is required.' };
  const hours = Number(form.hours);
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ok: false, error: 'Enter the number of hours logged.' };
  }
  if (hours > 24) return { ok: false, error: 'Hours cannot exceed 24 in a single log.' };

  try {
    const employeeName = await resolveEmployeeName(db, workspaceId, employeeId);
    if (!employeeName) return { ok: false, error: 'Employee not found.' };

    const now = new Date();
    const doc: Omit<TimeLogDoc, '_id'> = {
      workspaceId,
      employeeId,
      employeeName,
      date: new Date(form.date),
      project: form.project?.trim() || undefined,
      task: form.task?.trim() || undefined,
      hours,
      billable: Boolean(form.billable),
      approved: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await db
      .collection<TimeLogDoc>(SABHRM_COLLECTIONS.timeLogs)
      .insertOne(doc as TimeLogDoc);
    revalidatePath('/sabhrm/time-logs');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as TimeLogDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to log time.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateTimeLog(
  id: string,
  form: Partial<TimeLogFormValues>,
): Promise<ActionResult<TimeLogRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid time log id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<TimeLogDoc>(SABHRM_COLLECTIONS.timeLogs);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Time log not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (form.employeeId !== undefined) {
      const employeeId = form.employeeId.trim();
      if (!ObjectId.isValid(employeeId)) return { ok: false, error: 'Select a valid employee.' };
      const employeeName = await resolveEmployeeName(db, workspaceId, employeeId);
      if (!employeeName) return { ok: false, error: 'Employee not found.' };
      set.employeeId = employeeId;
      set.employeeName = employeeName;
    }
    if (form.date !== undefined) {
      if (!form.date) return { ok: false, error: 'A date is required.' };
      set.date = new Date(form.date);
    }
    if (form.project !== undefined) set.project = form.project.trim() || undefined;
    if (form.task !== undefined) set.task = form.task.trim() || undefined;
    if (form.hours !== undefined) {
      const hours = Number(form.hours);
      if (!Number.isFinite(hours) || hours <= 0) return { ok: false, error: 'Enter the number of hours logged.' };
      if (hours > 24) return { ok: false, error: 'Hours cannot exceed 24 in a single log.' };
      set.hours = hours;
    }
    if (form.billable !== undefined) set.billable = Boolean(form.billable);

    await col.updateOne({ _id: existing._id }, { $set: set });
    const updated = await col.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/time-logs');
    return { ok: true, data: toRow(updated as TimeLogDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update time log.' };
  }
}

/* ── approve ─────────────────────────────────────────────────────────── */

export async function approveTimeLog(id: string): Promise<ActionResult<TimeLogRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid time log id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<TimeLogDoc>(SABHRM_COLLECTIONS.timeLogs);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Time log not found.' };
    await col.updateOne({ _id: existing._id }, { $set: { approved: true, updatedAt: new Date() } });
    const updated = await col.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/time-logs');
    return { ok: true, data: toRow(updated as TimeLogDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to approve time log.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteTimeLog(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid time log id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<TimeLogDoc>(SABHRM_COLLECTIONS.timeLogs)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Time log not found.' };
    revalidatePath('/sabhrm/time-logs');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete time log.' };
  }
}

/* ── employee picker for the form ────────────────────────────────────── */

export interface TimeLogPickerOptions {
  employees: Array<{ value: string; label: string }>;
}

export async function getTimeLogPickerOptions(): Promise<ActionResult<TimeLogPickerOptions>> {
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
