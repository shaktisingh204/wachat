'use server';

/**
 * Worksuite Attendance (Extended) — server actions.
 * Collection: crm_attendance_ext
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { WsAttendanceExt } from '@/lib/worksuite/shifts-types';

type ActionResult<T = unknown> = { success: boolean; error?: string; data?: T; id?: string };

const COLL = 'crm_attendance_ext';
const ROUTE = '/dashboard/hrm/payroll/attendance';

async function requireTenant() {
  const session = await getSession();
  if (!session?.user) return { ok: false as const, error: 'Access denied' };
  return { ok: true as const, userId: new ObjectId(session.user._id) };
}

function toPlain<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function tryObjectId(id: string | undefined | null): ObjectId | null {
  if (!id) return null;
  try { return new ObjectId(id); } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* List & get                                                          */
/* ------------------------------------------------------------------ */

export async function getAttendanceExt(
  date?: Date | string,
  employeeId?: string,
): Promise<WsAttendanceExt[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = { userId: t.userId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    }
    if (employeeId) query.user_id = employeeId;
    const rows = await db.collection(COLL).find(query).sort({ date: -1, createdAt: -1 }).toArray();
    return toPlain<WsAttendanceExt[]>(rows);
  } catch (e) {
    console.error('[attendance] getAttendanceExt failed:', e);
    return [];
  }
}

export async function getAttendanceExtById(id: string): Promise<WsAttendanceExt | null> {
  const t = await requireTenant();
  if (!t.ok) return null;
  const oid = tryObjectId(id);
  if (!oid) return null;
  try {
    const { db } = await connectToDatabase();
    const row = await db.collection(COLL).findOne({ _id: oid, userId: t.userId });
    return row ? toPlain<WsAttendanceExt>(row) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Save / upsert                                                       */
/* ------------------------------------------------------------------ */

export async function saveAttendanceExt(
  input: Partial<WsAttendanceExt> & { _id?: string },
): Promise<ActionResult<WsAttendanceExt>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.user_id || !input.date) {
    return { success: false, error: 'user_id and date are required' };
  }

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const d = new Date(input.date);
    d.setHours(0, 0, 0, 0);

    const doc: Record<string, unknown> = {
      userId: t.userId,
      user_id: input.user_id,
      date: d,
      late: input.late ?? false,
      half_day: input.half_day ?? false,
      overwrite_attendance: input.overwrite_attendance ?? false,
      updatedAt: now,
    };

    if (input.clock_in_time !== undefined) doc.clock_in_time = input.clock_in_time;
    if (input.clock_out_time !== undefined) doc.clock_out_time = input.clock_out_time;
    if (input.clock_in_ip !== undefined) doc.clock_in_ip = input.clock_in_ip;
    if (input.clock_out_ip !== undefined) doc.clock_out_ip = input.clock_out_ip;
    if (input.working_from !== undefined) doc.working_from = input.working_from;
    if (input.working_hours !== undefined) doc.working_hours = input.working_hours;
    if (input.employee_shift_id !== undefined) doc.employee_shift_id = input.employee_shift_id;
    if (input.location_id !== undefined) doc.location_id = input.location_id;
    if (input.latitude !== undefined) doc.latitude = input.latitude;
    if (input.longitude !== undefined) doc.longitude = input.longitude;

    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db.collection(COLL).updateOne({ _id: oid, userId: t.userId }, { $set: doc });
      revalidatePath(ROUTE);
      return { success: true, id: input._id };
    }

    // Upsert by (userId, user_id, date)
    const res = await db.collection(COLL).updateOne(
      { userId: t.userId, user_id: input.user_id, date: d },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    revalidatePath(ROUTE);
    return {
      success: true,
      id: res.upsertedId ? res.upsertedId.toString() : input._id,
    };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Clock in / Clock out helpers                                        */
/* ------------------------------------------------------------------ */

export async function clockIn(
  employeeId: string,
  options?: {
    working_from?: string;
    employee_shift_id?: string;
    latitude?: string;
    longitude?: string;
    overwrite?: boolean;
  },
): Promise<ActionResult> {
  const now = new Date();
  return saveAttendanceExt({
    user_id: employeeId,
    date: now,
    clock_in_time: now.toISOString(),
    working_from: options?.working_from ?? 'office',
    employee_shift_id: options?.employee_shift_id,
    latitude: options?.latitude,
    longitude: options?.longitude,
    overwrite_attendance: options?.overwrite ?? false,
    late: false,
    half_day: false,
  });
}

export async function clockOut(
  employeeId: string,
  date?: Date,
): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };

  const d = date ?? new Date();
  const dayStart = new Date(d);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  try {
    const { db } = await connectToDatabase();
    const record = await db.collection(COLL).findOne({
      userId: t.userId,
      user_id: employeeId,
      date: { $gte: dayStart, $lt: dayEnd },
    });

    if (!record) {
      return { success: false, error: 'No clock-in record found for today' };
    }

    const now = new Date();
    let workingHours: number | undefined;
    if (record.clock_in_time) {
      const inTime = new Date(record.clock_in_time as string);
      workingHours = Math.round(((now.getTime() - inTime.getTime()) / 3600000) * 100) / 100;
    }

    await db.collection(COLL).updateOne(
      { _id: record._id },
      {
        $set: {
          clock_out_time: now.toISOString(),
          working_hours: workingHours,
          updatedAt: now,
        },
      },
    );
    revalidatePath(ROUTE);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteAttendanceExt(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL).deleteOne({ _id: oid, userId: t.userId });
    revalidatePath(ROUTE);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
