'use server';

/**
 * Worksuite Employee Shifts, Rotations & Attendance — server actions.
 *
 * Collections:
 *  - crm_employee_shifts
 *  - crm_shift_change_requests
 *  - crm_shift_schedules
 *  - crm_shift_rotations
 *  - crm_shift_rotation_sequences
 *  - crm_automate_shifts
 *  - crm_rotation_automate_logs
 *
 * Every tenant-scoped query applies `userId = new ObjectId(session.user._id)`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type {
  WsEmployeeShift,
  WsEmployeeShiftChangeRequest,
  WsEmployeeShiftSchedule,
  WsShiftRotation,
  WsShiftRotationSequence,
  WsAutomateShift,
  WsRotationAutomateLog,
  WsShiftChangeStatus,
  WsAutomateShiftStatus,
} from '@/lib/worksuite/shifts-types';

type ActionResult<T = unknown> = { success: boolean; error?: string; data?: T; id?: string };

const COLL = {
  SHIFTS: 'crm_employee_shifts',
  CHANGE_REQ: 'crm_shift_change_requests',
  SCHEDULE: 'crm_shift_schedules',
  ROTATION: 'crm_shift_rotations',
  ROTATION_SEQ: 'crm_shift_rotation_sequences',
  AUTOMATE: 'crm_automate_shifts',
  AUTOMATE_LOG: 'crm_rotation_automate_logs',
} as const;

async function requireTenant() {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false as const, error: 'Access denied' };
  }
  return { ok: true as const, userId: new ObjectId(session.user._id) };
}

function toPlain<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function tryObjectId(id: string | undefined | null): ObjectId | null {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Employee shifts                                                     */
/* ------------------------------------------------------------------ */

export async function getEmployeeShifts(): Promise<WsEmployeeShift[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.SHIFTS)
      .find({ userId: t.userId })
      .sort({ name: 1 })
      .toArray();
    return toPlain<WsEmployeeShift[]>(rows);
  } catch (e) {
    console.error('[shifts] getEmployeeShifts failed:', e);
    return [];
  }
}

export async function getEmployeeShift(id: string): Promise<WsEmployeeShift | null> {
  const t = await requireTenant();
  if (!t.ok) return null;
  const oid = tryObjectId(id);
  if (!oid) return null;
  try {
    const { db } = await connectToDatabase();
    const row = await db.collection(COLL.SHIFTS).findOne({ _id: oid, userId: t.userId });
    return row ? toPlain<WsEmployeeShift>(row) : null;
  } catch (e) {
    console.error('[shifts] getEmployeeShift failed:', e);
    return null;
  }
}

export async function saveEmployeeShift(
  input: Partial<WsEmployeeShift> & { _id?: string },
): Promise<ActionResult<WsEmployeeShift>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.name) return { success: false, error: 'Shift name is required.' };

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const doc = {
      userId: t.userId,
      name: input.name,
      color_code: input.color_code ?? '#EAB308',
      clock_in_time: input.clock_in_time ?? '',
      clock_out_time: input.clock_out_time ?? '',
      total_hours: input.total_hours ?? 0,
      late_mark_after: input.late_mark_after ?? 0,
      early_clock_in: input.early_clock_in ?? 0,
      office_open_days: input.office_open_days ?? [],
      office_start_time: input.office_start_time ?? '09:00',
      office_end_time: input.office_end_time ?? '18:00',
      office_hours: input.office_hours ?? 0,
      days_off_type: input.days_off_type ?? 'week-off',
      break_time_hours: input.break_time_hours ?? 0,
      half_day_after: input.half_day_after ?? 0,
      half_day_start: input.half_day_start ?? '',
      half_day_end: input.half_day_end ?? '',
      updatedAt: now,
    };

    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db.collection(COLL.SHIFTS).updateOne(
        { _id: oid, userId: t.userId },
        { $set: doc },
      );
      revalidatePath('/dashboard/hrm/payroll/shifts');
      return { success: true, id: input._id };
    }

    const result = await db.collection(COLL.SHIFTS).insertOne({ ...doc, createdAt: now });
    revalidatePath('/dashboard/hrm/payroll/shifts');
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteEmployeeShift(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL.SHIFTS).deleteOne({ _id: oid, userId: t.userId });
    revalidatePath('/dashboard/hrm/payroll/shifts');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Shift schedule (assignments)                                        */
/* ------------------------------------------------------------------ */

export async function getShiftSchedules(range?: {
  from?: Date | string;
  to?: Date | string;
  employeeIds?: string[];
}): Promise<WsEmployeeShiftSchedule[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = { userId: t.userId };
    if (range?.from || range?.to) {
      const dateClause: Record<string, Date> = {};
      if (range.from) dateClause.$gte = new Date(range.from);
      if (range.to) dateClause.$lte = new Date(range.to);
      query.date = dateClause;
    }
    if (range?.employeeIds?.length) {
      query.user_id = { $in: range.employeeIds };
    }
    const rows = await db
      .collection(COLL.SCHEDULE)
      .find(query)
      .sort({ date: 1 })
      .toArray();
    return toPlain<WsEmployeeShiftSchedule[]>(rows);
  } catch (e) {
    console.error('[shifts] getShiftSchedules failed:', e);
    return [];
  }
}

export async function saveShiftSchedule(
  input: Partial<WsEmployeeShiftSchedule> & { _id?: string },
): Promise<ActionResult<WsEmployeeShiftSchedule>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.user_id || !input.employee_shift_id || !input.date) {
    return { success: false, error: 'employee, shift and date are required' };
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const scheduleDate = new Date(input.date);
    scheduleDate.setHours(0, 0, 0, 0);

    const doc = {
      userId: t.userId,
      user_id: input.user_id,
      employee_shift_id: input.employee_shift_id,
      date: scheduleDate,
      updatedAt: now,
    };

    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db.collection(COLL.SCHEDULE).updateOne(
        { _id: oid, userId: t.userId },
        { $set: doc },
      );
      revalidatePath('/dashboard/hrm/payroll/shifts/schedule');
      return { success: true, id: input._id };
    }

    // Upsert by (userId, user_id, date)
    const result = await db.collection(COLL.SCHEDULE).updateOne(
      { userId: t.userId, user_id: input.user_id, date: scheduleDate },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    revalidatePath('/dashboard/hrm/payroll/shifts/schedule');
    return {
      success: true,
      id: result.upsertedId ? result.upsertedId.toString() : undefined,
    };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteShiftSchedule(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL.SCHEDULE).deleteOne({ _id: oid, userId: t.userId });
    revalidatePath('/dashboard/hrm/payroll/shifts/schedule');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Bulk-assign a shift to an employee across a contiguous date range
 * (inclusive). Upserts one row per day.
 */
export async function assignShiftToEmployee(
  userId: string,
  shiftId: string,
  dateRange: { from: Date | string; to: Date | string },
): Promise<ActionResult<{ inserted: number }>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!userId || !shiftId || !dateRange?.from || !dateRange?.to) {
    return { success: false, error: 'userId, shiftId and date range are required' };
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const start = new Date(dateRange.from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.to);
    end.setHours(0, 0, 0, 0);
    if (end.getTime() < start.getTime()) {
      return { success: false, error: 'to must be on/after from' };
    }

    const ops: Array<Promise<unknown>> = [];
    let cursor = new Date(start);
    let count = 0;
    while (cursor.getTime() <= end.getTime()) {
      const day = new Date(cursor);
      ops.push(
        db.collection(COLL.SCHEDULE).updateOne(
          { userId: t.userId, user_id: userId, date: day },
          {
            $set: {
              userId: t.userId,
              user_id: userId,
              employee_shift_id: shiftId,
              date: day,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true },
        ),
      );
      count += 1;
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    await Promise.all(ops);
    revalidatePath('/dashboard/hrm/payroll/shifts/schedule');
    return { success: true, data: { inserted: count } };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Shift change requests                                               */
/* ------------------------------------------------------------------ */

export async function getShiftChangeRequests(
  status?: WsShiftChangeStatus,
): Promise<WsEmployeeShiftChangeRequest[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = { userId: t.userId };
    if (status) query.status = status;
    const rows = await db
      .collection(COLL.CHANGE_REQ)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    return toPlain<WsEmployeeShiftChangeRequest[]>(rows);
  } catch (e) {
    console.error('[shifts] getShiftChangeRequests failed:', e);
    return [];
  }
}

export async function saveShiftChangeRequest(
  input: Partial<WsEmployeeShiftChangeRequest> & { _id?: string },
): Promise<ActionResult<WsEmployeeShiftChangeRequest>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.user_id || !input.current_shift_id || !input.requested_shift_id || !input.date) {
    return { success: false, error: 'user_id, shifts and date required' };
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const doc = {
      userId: t.userId,
      user_id: input.user_id,
      date: new Date(input.date),
      current_shift_id: input.current_shift_id,
      requested_shift_id: input.requested_shift_id,
      status: input.status ?? ('pending' as WsShiftChangeStatus),
      reason: input.reason ?? '',
      approved_by: input.approved_by,
      updatedAt: now,
    };

    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db.collection(COLL.CHANGE_REQ).updateOne(
        { _id: oid, userId: t.userId },
        { $set: doc },
      );
      revalidatePath('/dashboard/hrm/payroll/shift-change-requests');
      return { success: true, id: input._id };
    }
    const result = await db
      .collection(COLL.CHANGE_REQ)
      .insertOne({ ...doc, createdAt: now });
    revalidatePath('/dashboard/hrm/payroll/shift-change-requests');
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteShiftChangeRequest(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL.CHANGE_REQ).deleteOne({ _id: oid, userId: t.userId });
    revalidatePath('/dashboard/hrm/payroll/shift-change-requests');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Approve a shift change request. Also writes a schedule row for the
 * requested shift on that date (upserts existing schedule).
 */
export async function approveShiftChange(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    const session = await getSession();
    const approvedBy = session?.user?._id ? String(session.user._id) : undefined;
    const now = new Date();

    const req = await db
      .collection(COLL.CHANGE_REQ)
      .findOne({ _id: oid, userId: t.userId });
    if (!req) return { success: false, error: 'Request not found' };

    await db.collection(COLL.CHANGE_REQ).updateOne(
      { _id: oid, userId: t.userId },
      {
        $set: {
          status: 'approved' as WsShiftChangeStatus,
          approved_by: approvedBy,
          approved_at: now,
          updatedAt: now,
        },
      },
    );

    const day = new Date(req.date);
    day.setHours(0, 0, 0, 0);
    await db.collection(COLL.SCHEDULE).updateOne(
      { userId: t.userId, user_id: req.user_id, date: day },
      {
        $set: {
          userId: t.userId,
          user_id: req.user_id,
          employee_shift_id: req.requested_shift_id,
          date: day,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    revalidatePath('/dashboard/hrm/payroll/shift-change-requests');
    revalidatePath('/dashboard/hrm/payroll/shifts/schedule');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function rejectShiftChange(id: string, reason: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    const session = await getSession();
    const approvedBy = session?.user?._id ? String(session.user._id) : undefined;
    const now = new Date();
    await db.collection(COLL.CHANGE_REQ).updateOne(
      { _id: oid, userId: t.userId },
      {
        $set: {
          status: 'rejected' as WsShiftChangeStatus,
          approved_by: approvedBy,
          rejection_reason: reason ?? '',
          updatedAt: now,
        },
      },
    );
    revalidatePath('/dashboard/hrm/payroll/shift-change-requests');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Shift rotations                                                     */
/* ------------------------------------------------------------------ */

export async function getShiftRotations(): Promise<WsShiftRotation[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.ROTATION)
      .find({ userId: t.userId })
      .sort({ name: 1 })
      .toArray();
    return toPlain<WsShiftRotation[]>(rows);
  } catch (e) {
    console.error('[shifts] getShiftRotations failed:', e);
    return [];
  }
}

export async function getShiftRotation(id: string): Promise<WsShiftRotation | null> {
  const t = await requireTenant();
  if (!t.ok) return null;
  const oid = tryObjectId(id);
  if (!oid) return null;
  try {
    const { db } = await connectToDatabase();
    const row = await db
      .collection(COLL.ROTATION)
      .findOne({ _id: oid, userId: t.userId });
    return row ? toPlain<WsShiftRotation>(row) : null;
  } catch (e) {
    console.error('[shifts] getShiftRotation failed:', e);
    return null;
  }
}

export async function saveShiftRotation(
  input: Partial<WsShiftRotation> & { _id?: string },
): Promise<ActionResult<WsShiftRotation>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.name) return { success: false, error: 'Name is required.' };
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const doc = {
      userId: t.userId,
      name: input.name,
      description: input.description ?? '',
      is_active: input.is_active ?? true,
      updatedAt: now,
    };
    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db.collection(COLL.ROTATION).updateOne(
        { _id: oid, userId: t.userId },
        { $set: doc },
      );
      revalidatePath('/dashboard/hrm/payroll/shift-rotations');
      return { success: true, id: input._id };
    }
    const result = await db
      .collection(COLL.ROTATION)
      .insertOne({ ...doc, createdAt: now });
    revalidatePath('/dashboard/hrm/payroll/shift-rotations');
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteShiftRotation(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(COLL.ROTATION)
      .deleteOne({ _id: oid, userId: t.userId });
    // Also remove sequences
    await db
      .collection(COLL.ROTATION_SEQ)
      .deleteMany({ userId: t.userId, shift_rotation_id: id });
    revalidatePath('/dashboard/hrm/payroll/shift-rotations');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Shift rotation sequences                                            */
/* ------------------------------------------------------------------ */

export async function getRotationSequences(
  rotationId: string,
): Promise<WsShiftRotationSequence[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.ROTATION_SEQ)
      .find({ userId: t.userId, shift_rotation_id: rotationId })
      .sort({ sequence_order: 1 })
      .toArray();
    return toPlain<WsShiftRotationSequence[]>(rows);
  } catch (e) {
    console.error('[shifts] getRotationSequences failed:', e);
    return [];
  }
}

export async function saveRotationSequence(
  input: Partial<WsShiftRotationSequence> & { _id?: string },
): Promise<ActionResult<WsShiftRotationSequence>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.shift_rotation_id || !input.shift_id || !input.duration_days) {
    return { success: false, error: 'rotation, shift, duration required' };
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const doc = {
      userId: t.userId,
      shift_rotation_id: input.shift_rotation_id,
      shift_id: input.shift_id,
      duration_days: input.duration_days,
      sequence_order: input.sequence_order ?? 1,
      updatedAt: now,
    };
    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db
        .collection(COLL.ROTATION_SEQ)
        .updateOne({ _id: oid, userId: t.userId }, { $set: doc });
      revalidatePath(`/dashboard/hrm/payroll/shift-rotations/${input.shift_rotation_id}`);
      return { success: true, id: input._id };
    }
    const result = await db
      .collection(COLL.ROTATION_SEQ)
      .insertOne({ ...doc, createdAt: now });
    revalidatePath(`/dashboard/hrm/payroll/shift-rotations/${input.shift_rotation_id}`);
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteRotationSequence(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(COLL.ROTATION_SEQ)
      .deleteOne({ _id: oid, userId: t.userId });
    revalidatePath('/dashboard/hrm/payroll/shift-rotations');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Automate shift                                                      */
/* ------------------------------------------------------------------ */

export async function getAutomateShifts(): Promise<WsAutomateShift[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.AUTOMATE)
      .find({ userId: t.userId })
      .sort({ createdAt: -1 })
      .toArray();
    return toPlain<WsAutomateShift[]>(rows);
  } catch (e) {
    console.error('[shifts] getAutomateShifts failed:', e);
    return [];
  }
}

export async function saveAutomateShift(
  input: Partial<WsAutomateShift> & { _id?: string },
): Promise<ActionResult<WsAutomateShift>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.shift_rotation_id || !input.user_ids?.length || !input.start_date || !input.end_date) {
    return { success: false, error: 'rotation, users, and dates required' };
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const doc = {
      userId: t.userId,
      shift_rotation_id: input.shift_rotation_id,
      user_ids: input.user_ids,
      start_date: new Date(input.start_date),
      end_date: new Date(input.end_date),
      status: input.status ?? ('scheduled' as WsAutomateShiftStatus),
      updatedAt: now,
    };
    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db
        .collection(COLL.AUTOMATE)
        .updateOne({ _id: oid, userId: t.userId }, { $set: doc });
      revalidatePath('/dashboard/hrm/payroll/shift-rotations/automate');
      return { success: true, id: input._id };
    }
    const result = await db
      .collection(COLL.AUTOMATE)
      .insertOne({ ...doc, createdAt: now });
    revalidatePath('/dashboard/hrm/payroll/shift-rotations/automate');
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteAutomateShift(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(COLL.AUTOMATE)
      .deleteOne({ _id: oid, userId: t.userId });
    revalidatePath('/dashboard/hrm/payroll/shift-rotations/automate');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/**
 * Expand a rotation's sequence into concrete schedule rows for the
 * given employees between start and end date (inclusive).
 *
 * Day N gets the shift whose cumulative duration window contains N
 * (0-indexed). Sequences repeat modulo the total duration.
 */
export async function runRotation(
  rotationId: string,
  startDate: Date | string,
  endDate: Date | string,
  employeeIds: string[],
): Promise<ActionResult<{ inserted: number; days: number }>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!rotationId || !employeeIds?.length) {
    return { success: false, error: 'rotationId and employeeIds required' };
  }

  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    const seqRows = await db
      .collection(COLL.ROTATION_SEQ)
      .find({ userId: t.userId, shift_rotation_id: rotationId })
      .sort({ sequence_order: 1 })
      .toArray();

    if (!seqRows.length) {
      return { success: false, error: 'Rotation has no sequence entries' };
    }

    const totalCycle = seqRows.reduce(
      (acc, r) => acc + Number(r.duration_days ?? 0),
      0,
    );
    if (totalCycle <= 0) {
      return { success: false, error: 'Rotation cycle length is zero' };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (end.getTime() < start.getTime()) {
      return { success: false, error: 'endDate must be on/after startDate' };
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor((end.getTime() - start.getTime()) / oneDayMs) + 1;

    const ops: Array<Promise<unknown>> = [];
    let inserted = 0;

    for (let i = 0; i < days; i++) {
      const dayIdx = i % totalCycle;
      // find which sequence row covers this dayIdx
      let cursor = 0;
      let shiftId: string | null = null;
      for (const s of seqRows) {
        const dur = Number(s.duration_days ?? 0);
        if (dayIdx < cursor + dur) {
          shiftId = String(s.shift_id);
          break;
        }
        cursor += dur;
      }
      if (!shiftId) continue;

      const day = new Date(start.getTime() + i * oneDayMs);
      for (const userId of employeeIds) {
        ops.push(
          db.collection(COLL.SCHEDULE).updateOne(
            { userId: t.userId, user_id: userId, date: day },
            {
              $set: {
                userId: t.userId,
                user_id: userId,
                employee_shift_id: shiftId,
                date: day,
                updatedAt: now,
              },
              $setOnInsert: { createdAt: now },
            },
            { upsert: true },
          ),
        );
        inserted += 1;
      }
    }

    await Promise.all(ops);

    const logDoc: Omit<WsRotationAutomateLog, '_id'> = {
      userId: String(t.userId),
      automate_shift_id: '',
      run_at: now,
      inserted_count: inserted,
      success: true,
      message: `Expanded rotation ${rotationId} across ${days} day(s) for ${employeeIds.length} employee(s).`,
    };
    await db.collection(COLL.AUTOMATE_LOG).insertOne({
      ...logDoc,
      userId: t.userId,
    });

    revalidatePath('/dashboard/hrm/payroll/shifts/schedule');
    revalidatePath('/dashboard/hrm/payroll/shift-rotations/automate');

    return { success: true, data: { inserted, days } };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Rotation automate logs                                              */
/* ------------------------------------------------------------------ */

export async function getRotationAutomateLogs(): Promise<WsRotationAutomateLog[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.AUTOMATE_LOG)
      .find({ userId: t.userId })
      .sort({ run_at: -1 })
      .limit(200)
      .toArray();
    return toPlain<WsRotationAutomateLog[]>(rows);
  } catch (e) {
    console.error('[shifts] getRotationAutomateLogs failed:', e);
    return [];
  }
}
