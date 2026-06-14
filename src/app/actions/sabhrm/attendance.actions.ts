'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  AttendanceRow,
  AttendanceStatus,
  ListParams,
  Paginated,
} from '@/lib/sabhrm/types';

/* ── form values (local — not in shared types) ───────────────────────── */

export interface AttendanceFormValues {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
}

/* ── doc shape (server-internal) ─────────────────────────────────────── */

interface AttendanceDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  status: AttendanceStatus;
  checkIn?: string; // HH:mm
  checkOut?: string; // HH:mm
  workedHours?: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

function toRow(d: AttendanceDoc): AttendanceRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    date: d.date ? d.date.toISOString().slice(0, 10) : '',
    status: d.status,
    checkIn: d.checkIn ?? null,
    checkOut: d.checkOut ?? null,
    workedHours: typeof d.workedHours === 'number' ? d.workedHours : null,
    note: d.note ?? null,
  };
}

/** Compute worked hours from HH:mm check-in/out (handles overnight). */
function computeWorkedHours(checkIn?: string, checkOut?: string): number | undefined {
  if (!checkIn || !checkOut) return undefined;
  const inMatch = /^(\d{1,2}):(\d{2})$/.exec(checkIn.trim());
  const outMatch = /^(\d{1,2}):(\d{2})$/.exec(checkOut.trim());
  if (!inMatch || !outMatch) return undefined;
  const inMin = Number(inMatch[1]) * 60 + Number(inMatch[2]);
  let outMin = Number(outMatch[1]) * 60 + Number(outMatch[2]);
  if (outMin < inMin) outMin += 24 * 60; // overnight shift
  const hours = (outMin - inMin) / 60;
  return Math.round(hours * 100) / 100;
}

/* ── list ────────────────────────────────────────────────────────────── */

export async function listAttendance(
  params: ListParams & { employeeId?: string } = {},
): Promise<ActionResult<Paginated<AttendanceRow>>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  try {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const filter: Record<string, unknown> = { workspaceId };
    if (params.status) filter.status = params.status;
    if (params.employeeId) filter.employeeId = params.employeeId;
    if (params.from || params.to) {
      const range: Record<string, Date> = {};
      if (params.from) range.$gte = new Date(`${params.from}T00:00:00.000Z`);
      if (params.to) range.$lte = new Date(`${params.to}T23:59:59.999Z`);
      filter.date = range;
    }
    if (params.q) {
      const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.employeeName = rx;
    }

    const col = db.collection<AttendanceDoc>(SABHRM_COLLECTIONS.attendance);
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
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load attendance.' };
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

export async function createAttendance(
  form: AttendanceFormValues,
): Promise<ActionResult<AttendanceRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  const employeeId = form.employeeId?.trim();
  if (!employeeId || !ObjectId.isValid(employeeId)) {
    return { ok: false, error: 'Select an employee.' };
  }
  if (!form.date) return { ok: false, error: 'A date is required.' };
  if (!form.status) return { ok: false, error: 'A status is required.' };

  try {
    // Resolve employeeName from the employees collection.
    const emp = (await db
      .collection(SABHRM_COLLECTIONS.employees)
      .findOne(
        { _id: new ObjectId(employeeId), workspaceId },
        { projection: { displayName: 1, firstName: 1, lastName: 1 } },
      )) as Record<string, unknown> | null;
    if (!emp) return { ok: false, error: 'Employee not found.' };
    const employeeName = String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());

    const checkIn = form.checkIn?.trim() || undefined;
    const checkOut = form.checkOut?.trim() || undefined;
    const workedHours = computeWorkedHours(checkIn, checkOut);

    const now = new Date();
    const doc: Omit<AttendanceDoc, '_id'> = {
      workspaceId,
      employeeId,
      employeeName,
      date: new Date(`${form.date}T00:00:00.000Z`),
      status: form.status,
      checkIn,
      checkOut,
      workedHours,
      note: form.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };
    const ins = await db
      .collection<AttendanceDoc>(SABHRM_COLLECTIONS.attendance)
      .insertOne(doc as AttendanceDoc);
    revalidatePath('/sabhrm/attendance');
    revalidatePath('/sabhrm');
    return { ok: true, data: toRow({ ...(doc as AttendanceDoc), _id: ins.insertedId }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to mark attendance.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateAttendance(
  id: string,
  form: Partial<AttendanceFormValues>,
): Promise<ActionResult<AttendanceRow>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid attendance id.' };
  const { db, workspaceId } = g.ctx;

  try {
    const col = db.collection<AttendanceDoc>(SABHRM_COLLECTIONS.attendance);
    const existing = await col.findOne({ _id: new ObjectId(id), workspaceId });
    if (!existing) return { ok: false, error: 'Attendance record not found.' };

    const set: Record<string, unknown> = { updatedAt: new Date() };

    if (form.employeeId !== undefined) {
      const employeeId = form.employeeId.trim();
      if (!ObjectId.isValid(employeeId)) return { ok: false, error: 'Select a valid employee.' };
      const emp = (await db
        .collection(SABHRM_COLLECTIONS.employees)
        .findOne(
          { _id: new ObjectId(employeeId), workspaceId },
          { projection: { displayName: 1, firstName: 1, lastName: 1 } },
        )) as Record<string, unknown> | null;
      if (!emp) return { ok: false, error: 'Employee not found.' };
      set.employeeId = employeeId;
      set.employeeName = String(emp.displayName || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim());
    }
    if (form.date !== undefined) set.date = new Date(`${form.date}T00:00:00.000Z`);
    if (form.status !== undefined) set.status = form.status;
    if (form.note !== undefined) set.note = form.note.trim() || undefined;

    const nextCheckIn = form.checkIn !== undefined ? form.checkIn.trim() || undefined : existing.checkIn;
    const nextCheckOut = form.checkOut !== undefined ? form.checkOut.trim() || undefined : existing.checkOut;
    if (form.checkIn !== undefined) set.checkIn = nextCheckIn;
    if (form.checkOut !== undefined) set.checkOut = nextCheckOut;
    if (form.checkIn !== undefined || form.checkOut !== undefined) {
      set.workedHours = computeWorkedHours(nextCheckIn, nextCheckOut);
    }

    await col.updateOne({ _id: existing._id }, { $set: set });
    const updated = await col.findOne({ _id: existing._id });
    revalidatePath('/sabhrm/attendance');
    return { ok: true, data: toRow(updated as AttendanceDoc) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update attendance.' };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteAttendance(id: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid attendance id.' };
  const { db, workspaceId } = g.ctx;
  try {
    const res = await db
      .collection<AttendanceDoc>(SABHRM_COLLECTIONS.attendance)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Attendance record not found.' };
    revalidatePath('/sabhrm/attendance');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete attendance.' };
  }
}

/* ── employee picker for the form / filter ───────────────────────────── */

export interface AttendancePickerOptions {
  employees: Array<{ value: string; label: string }>;
}

export async function getAttendancePickerOptions(): Promise<ActionResult<AttendancePickerOptions>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  try {
    const emps = await db
      .collection(SABHRM_COLLECTIONS.employees)
      .find({ workspaceId }, { projection: { displayName: 1, firstName: 1, lastName: 1 } })
      .sort({ displayName: 1 })
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
