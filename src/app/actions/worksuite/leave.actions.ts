'use server';

/**
 * Worksuite Leave Management — server actions.
 *
 * Collections:
 *  - crm_leave_types
 *  - crm_leaves
 *  - crm_leave_files
 *  - crm_leave_settings
 *
 * Every tenant-scoped query applies `userId = new ObjectId(session.user._id)`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type {
  WsLeave,
  WsLeaveType,
  WsLeaveFile,
  WsLeaveSetting,
  WsLeaveStatus,
  WsLeaveDuration,
  WsLeaveBalanceEmployee,
  WsLeaveBalanceRow,
  WsLeaveCalendarEntry,
  WsLeaveReportRow,
} from '@/lib/worksuite/leave-types';

type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
  id?: string;
};

const COLL = {
  TYPES: 'crm_leave_types',
  LEAVES: 'crm_leaves',
  FILES: 'crm_leave_files',
  SETTINGS: 'crm_leave_settings',
} as const;

const ROUTE = '/dashboard/crm/hr-payroll/leave';

const DEFAULT_SETTINGS: Omit<WsLeaveSetting, '_id' | 'userId'> = {
  monthly_leaves_allowed: 2,
  allowed_leaves_per_week: 1,
  require_approval: true,
  allow_half_day: true,
  allow_hourly: false,
  allow_future_leave: true,
  max_days_advance: 365,
  hours_per_day: 8,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requireTenant() {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false as const, error: 'Access denied' };
  }
  return {
    ok: true as const,
    userId: new ObjectId(session.user._id),
    userIdString: String(session.user._id),
  };
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

function toDateOnly(value: string | Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysInclusive(from: Date, to: Date): number {
  const f = toDateOnly(from).getTime();
  const t = toDateOnly(to).getTime();
  if (t < f) return 0;
  return Math.floor((t - f) / (24 * 60 * 60 * 1000)) + 1;
}

async function computeDaysCount(
  input: Partial<WsLeave>,
  hoursPerDay: number,
): Promise<number> {
  const duration = (input.duration || 'full-day') as WsLeaveDuration;
  if (duration === 'half-day') return 0.5;
  if (duration === 'hours') {
    const h = Number(input.hours || 0);
    if (hoursPerDay <= 0) return 0;
    return Math.round((h / hoursPerDay) * 100) / 100;
  }
  if (duration === 'multiple' && input.leave_date && input.end_date) {
    return daysInclusive(new Date(input.leave_date), new Date(input.end_date));
  }
  return 1;
}

/* ------------------------------------------------------------------ */
/* Leave types                                                         */
/* ------------------------------------------------------------------ */

export async function getLeaveTypes(): Promise<WsLeaveType[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.TYPES)
      .find({ userId: t.userId })
      .sort({ type_name: 1 })
      .toArray();
    return toPlain<WsLeaveType[]>(rows);
  } catch (e) {
    console.error('[leave] getLeaveTypes failed:', e);
    return [];
  }
}

export async function getLeaveType(id: string): Promise<WsLeaveType | null> {
  const t = await requireTenant();
  if (!t.ok) return null;
  const oid = tryObjectId(id);
  if (!oid) return null;
  try {
    const { db } = await connectToDatabase();
    const row = await db
      .collection(COLL.TYPES)
      .findOne({ _id: oid, userId: t.userId });
    return row ? toPlain<WsLeaveType>(row) : null;
  } catch (e) {
    console.error('[leave] getLeaveType failed:', e);
    return null;
  }
}

/**
 * HrEntityPage-compatible save action for leave types.
 * Consumes FormData; returns `{ message, error, id }`.
 */
export async function saveLeaveType(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const t = await requireTenant();
  if (!t.ok) return { error: t.error };
  try {
    const { db } = await connectToDatabase();
    const _id = (formData.get('_id') as string) || '';
    const type_name = (formData.get('type_name') as string) || '';
    if (!type_name) return { error: 'Leave type name is required.' };

    const doc = {
      userId: t.userId,
      type_name,
      no_of_leaves: Number(formData.get('no_of_leaves') || 0),
      color: (formData.get('color') as string) || '#EAB308',
      monthly_limit: Number(formData.get('monthly_limit') || 0),
      paid:
        formData.get('paid') === 'true' ||
        formData.get('paid') === 'on' ||
        formData.get('paid') === '1',
      leave_unit: ((formData.get('leave_unit') as string) || 'days') as WsLeaveType['leave_unit'],
      status: ((formData.get('status') as string) || 'active') as WsLeaveType['status'],
      updatedAt: new Date(),
    };

    if (_id) {
      const oid = tryObjectId(_id);
      if (!oid) return { error: 'Invalid id' };
      await db
        .collection(COLL.TYPES)
        .updateOne({ _id: oid, userId: t.userId }, { $set: doc });
      revalidatePath(`${ROUTE}/types`);
      return { message: 'Leave type saved.', id: _id };
    }
    const res = await db
      .collection(COLL.TYPES)
      .insertOne({ ...doc, createdAt: new Date() });
    revalidatePath(`${ROUTE}/types`);
    return { message: 'Leave type created.', id: res.insertedId.toString() };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function deleteLeaveType(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL.TYPES).deleteOne({ _id: oid, userId: t.userId });
    revalidatePath(`${ROUTE}/types`);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Leaves                                                              */
/* ------------------------------------------------------------------ */

export async function getLeaves(filters?: {
  status?: WsLeaveStatus;
  employeeId?: string;
  leave_type_id?: string;
}): Promise<WsLeave[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = { userId: t.userId };
    if (filters?.status) query.status = filters.status;
    if (filters?.employeeId) query.user_id = filters.employeeId;
    if (filters?.leave_type_id) query.leave_type_id = filters.leave_type_id;
    const rows = await db
      .collection(COLL.LEAVES)
      .find(query)
      .sort({ leave_date: -1, createdAt: -1 })
      .toArray();
    return toPlain<WsLeave[]>(rows);
  } catch (e) {
    console.error('[leave] getLeaves failed:', e);
    return [];
  }
}

export async function getLeave(id: string): Promise<WsLeave | null> {
  const t = await requireTenant();
  if (!t.ok) return null;
  const oid = tryObjectId(id);
  if (!oid) return null;
  try {
    const { db } = await connectToDatabase();
    const row = await db
      .collection(COLL.LEAVES)
      .findOne({ _id: oid, userId: t.userId });
    return row ? toPlain<WsLeave>(row) : null;
  } catch (e) {
    console.error('[leave] getLeave failed:', e);
    return null;
  }
}

export async function saveLeave(
  input: Partial<WsLeave> & { _id?: string },
): Promise<ActionResult<WsLeave>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.user_id || !input.leave_type_id || !input.leave_date) {
    return { success: false, error: 'Employee, type and date are required.' };
  }
  try {
    const { db } = await connectToDatabase();
    const settings = await getLeaveSettingsInternal(db, t.userId);
    const hoursPerDay = settings.hours_per_day || 8;
    const now = new Date();

    const duration = (input.duration || 'full-day') as WsLeaveDuration;
    const leaveDate = toDateOnly(input.leave_date);
    const endDate =
      duration === 'multiple' && input.end_date
        ? toDateOnly(input.end_date)
        : undefined;
    const daysCount =
      input.days_count !== undefined && input.days_count !== null
        ? Number(input.days_count)
        : await computeDaysCount(
            { ...input, leave_date: leaveDate, end_date: endDate },
            hoursPerDay,
          );

    const doc: Record<string, unknown> = {
      userId: t.userId,
      user_id: input.user_id,
      leave_type_id: input.leave_type_id,
      duration,
      half_day_type: duration === 'half-day' ? input.half_day_type ?? 'first-half' : undefined,
      leave_date: leaveDate,
      end_date: endDate,
      hours: duration === 'hours' ? Number(input.hours || 0) : undefined,
      reason: input.reason ?? '',
      status: (input.status ?? 'pending') as WsLeaveStatus,
      reject_reason: input.reject_reason ?? '',
      approved_by: input.approved_by,
      approved_at: input.approved_at ? new Date(input.approved_at) : undefined,
      applied_at: input.applied_at ? new Date(input.applied_at) : now,
      days_count: daysCount,
      updatedAt: now,
    };

    if (input._id) {
      const oid = tryObjectId(input._id);
      if (!oid) return { success: false, error: 'Invalid id' };
      await db
        .collection(COLL.LEAVES)
        .updateOne({ _id: oid, userId: t.userId }, { $set: doc });
      revalidatePath(ROUTE);
      revalidatePath(`${ROUTE}/${input._id}`);
      return { success: true, id: input._id };
    }

    const res = await db
      .collection(COLL.LEAVES)
      .insertOne({ ...doc, createdAt: now });
    revalidatePath(ROUTE);
    return { success: true, id: res.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteLeave(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(COLL.LEAVES).deleteOne({ _id: oid, userId: t.userId });
    await db.collection(COLL.FILES).deleteMany({ userId: t.userId, leave_id: id });
    revalidatePath(ROUTE);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

export async function approveLeave(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    await db.collection(COLL.LEAVES).updateOne(
      { _id: oid, userId: t.userId },
      {
        $set: {
          status: 'approved' as WsLeaveStatus,
          approved_by: t.userIdString,
          approved_at: now,
          updatedAt: now,
          reject_reason: '',
        },
      },
    );
    revalidatePath(ROUTE);
    revalidatePath(`${ROUTE}/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function rejectLeave(id: string, reason: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    await db.collection(COLL.LEAVES).updateOne(
      { _id: oid, userId: t.userId },
      {
        $set: {
          status: 'rejected' as WsLeaveStatus,
          approved_by: t.userIdString,
          approved_at: now,
          reject_reason: reason ?? '',
          updatedAt: now,
        },
      },
    );
    revalidatePath(ROUTE);
    revalidatePath(`${ROUTE}/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Leave files                                                         */
/* ------------------------------------------------------------------ */

export async function getLeaveFiles(leaveId: string): Promise<WsLeaveFile[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL.FILES)
      .find({ userId: t.userId, leave_id: leaveId })
      .sort({ createdAt: -1 })
      .toArray();
    return toPlain<WsLeaveFile[]>(rows);
  } catch (e) {
    console.error('[leave] getLeaveFiles failed:', e);
    return [];
  }
}

export async function saveLeaveFile(
  input: Partial<WsLeaveFile>,
): Promise<ActionResult<WsLeaveFile>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  if (!input.leave_id || !input.filename || !input.url) {
    return { success: false, error: 'leave_id, filename and url are required.' };
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const doc = {
      userId: t.userId,
      leave_id: input.leave_id,
      filename: input.filename,
      url: input.url,
      size: input.size ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    const res = await db.collection(COLL.FILES).insertOne(doc);
    revalidatePath(`${ROUTE}/${input.leave_id}`);
    return { success: true, id: res.insertedId.toString() };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteLeaveFile(id: string): Promise<ActionResult> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  const oid = tryObjectId(id);
  if (!oid) return { success: false, error: 'Invalid id' };
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection(COLL.FILES)
      .findOne({ _id: oid, userId: t.userId });
    await db.collection(COLL.FILES).deleteOne({ _id: oid, userId: t.userId });
    if (doc?.leave_id) revalidatePath(`${ROUTE}/${doc.leave_id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

async function getLeaveSettingsInternal(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  userId: ObjectId,
): Promise<WsLeaveSetting> {
  const row = await db.collection(COLL.SETTINGS).findOne({ userId });
  if (row) return toPlain<WsLeaveSetting>(row);
  return {
    userId: String(userId),
    ...DEFAULT_SETTINGS,
  };
}

export async function getLeaveSettings(): Promise<WsLeaveSetting> {
  const t = await requireTenant();
  if (!t.ok) {
    return {
      userId: '',
      ...DEFAULT_SETTINGS,
    };
  }
  const { db } = await connectToDatabase();
  return getLeaveSettingsInternal(db, t.userId);
}

export async function saveLeaveSettings(
  input: Partial<WsLeaveSetting>,
): Promise<ActionResult<WsLeaveSetting>> {
  const t = await requireTenant();
  if (!t.ok) return { success: false, error: t.error };
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const doc: Record<string, unknown> = {
      userId: t.userId,
      monthly_leaves_allowed: Number(
        input.monthly_leaves_allowed ?? DEFAULT_SETTINGS.monthly_leaves_allowed,
      ),
      allowed_leaves_per_week: Number(
        input.allowed_leaves_per_week ?? DEFAULT_SETTINGS.allowed_leaves_per_week,
      ),
      require_approval: Boolean(input.require_approval ?? DEFAULT_SETTINGS.require_approval),
      allow_half_day: Boolean(input.allow_half_day ?? DEFAULT_SETTINGS.allow_half_day),
      allow_hourly: Boolean(input.allow_hourly ?? DEFAULT_SETTINGS.allow_hourly),
      allow_future_leave: Boolean(
        input.allow_future_leave ?? DEFAULT_SETTINGS.allow_future_leave,
      ),
      max_days_advance: Number(
        input.max_days_advance ?? DEFAULT_SETTINGS.max_days_advance,
      ),
      hours_per_day: Number(input.hours_per_day ?? DEFAULT_SETTINGS.hours_per_day),
      updatedAt: now,
    };
    await db.collection(COLL.SETTINGS).updateOne(
      { userId: t.userId },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    revalidatePath(`${ROUTE}/settings`);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Balances, calendar, reports                                         */
/* ------------------------------------------------------------------ */

/**
 * Per-employee balance: allocated - sum(approved days_count by type).
 * If `employeeId` is null, returns matrix for every employee in
 * `crm_employees` for the tenant.
 */
export async function getLeaveBalance(
  employeeId?: string,
): Promise<WsLeaveBalanceEmployee[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();

    const typeRows = await db
      .collection(COLL.TYPES)
      .find({ userId: t.userId })
      .sort({ type_name: 1 })
      .toArray();
    const types = toPlain<WsLeaveType[]>(typeRows);

    const empQuery: Record<string, unknown> = { userId: t.userId };
    if (employeeId) {
      const eoid = tryObjectId(employeeId);
      if (eoid) empQuery._id = eoid;
    }
    const employees = await db
      .collection('crm_employees')
      .find(empQuery)
      .project({ firstName: 1, lastName: 1 })
      .sort({ firstName: 1, lastName: 1 })
      .toArray();

    const employeePlain = toPlain<Array<{ _id: string; firstName?: string; lastName?: string }>>(
      employees,
    );

    // Aggregate approved days per (employee, type)
    const agg = await db
      .collection(COLL.LEAVES)
      .aggregate([
        { $match: { userId: t.userId, status: 'approved' } },
        {
          $group: {
            _id: { user_id: '$user_id', leave_type_id: '$leave_type_id' },
            total: { $sum: '$days_count' },
          },
        },
      ])
      .toArray();

    const usedMap = new Map<string, number>();
    for (const a of agg) {
      const k = `${(a as any)._id.user_id}::${(a as any)._id.leave_type_id}`;
      usedMap.set(k, Number((a as any).total || 0));
    }

    const result: WsLeaveBalanceEmployee[] = employeePlain.map((emp) => {
      const rows: WsLeaveBalanceRow[] = types.map((type) => {
        const k = `${emp._id}::${type._id}`;
        const used = usedMap.get(k) ?? 0;
        const allocated = Number(type.no_of_leaves || 0);
        return {
          leave_type_id: String(type._id),
          type_name: type.type_name,
          color: type.color,
          allocated,
          used,
          remaining: Math.max(0, allocated - used),
          monthly_limit: Number(type.monthly_limit || 0),
          paid: Boolean(type.paid),
        };
      });
      const name =
        [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() ||
        'Unnamed';
      return {
        employee_id: String(emp._id),
        employee_name: name,
        rows,
      };
    });

    return result;
  } catch (e) {
    console.error('[leave] getLeaveBalance failed:', e);
    return [];
  }
}

/**
 * Expand all (approved) leaves in [from, to] into daily calendar
 * entries (one row per leave-day per employee).
 */
export async function getLeavesForDateRange(
  from: string | Date,
  to: string | Date,
  employeeId?: string,
): Promise<WsLeaveCalendarEntry[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const start = toDateOnly(from);
    const end = toDateOnly(to);

    // Fetch anything overlapping the window.
    const query: Record<string, unknown> = {
      userId: t.userId,
      status: 'approved',
      $or: [
        { leave_date: { $gte: start, $lte: end } },
        { end_date: { $gte: start, $lte: end } },
        {
          $and: [
            { leave_date: { $lte: start } },
            { end_date: { $gte: end } },
          ],
        },
      ],
    };
    if (employeeId) query.user_id = employeeId;

    const [leaveRows, typeRows, empRows] = await Promise.all([
      db.collection(COLL.LEAVES).find(query).toArray(),
      db.collection(COLL.TYPES).find({ userId: t.userId }).toArray(),
      db
        .collection('crm_employees')
        .find({ userId: t.userId })
        .project({ firstName: 1, lastName: 1 })
        .toArray(),
    ]);

    const typeMap = new Map<string, WsLeaveType>();
    for (const r of toPlain<WsLeaveType[]>(typeRows)) {
      typeMap.set(String(r._id), r);
    }
    const empMap = new Map<string, string>();
    for (const r of toPlain<Array<{ _id: string; firstName?: string; lastName?: string }>>(empRows)) {
      empMap.set(
        String(r._id),
        [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || 'Unnamed',
      );
    }

    const entries: WsLeaveCalendarEntry[] = [];
    for (const row of toPlain<WsLeave[]>(leaveRows)) {
      const type = typeMap.get(String(row.leave_type_id));
      const typeName = type?.type_name ?? 'Leave';
      const color = type?.color ?? '#94A3B8';
      const employeeName = empMap.get(String(row.user_id));

      const dayStart = toDateOnly(row.leave_date);
      const dayEnd =
        row.duration === 'multiple' && row.end_date
          ? toDateOnly(row.end_date)
          : dayStart;

      const clampStart = dayStart < start ? start : dayStart;
      const clampEnd = dayEnd > end ? end : dayEnd;

      for (
        let cursor = new Date(clampStart);
        cursor.getTime() <= clampEnd.getTime();
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
      ) {
        entries.push({
          _id: String(row._id),
          user_id: String(row.user_id),
          leave_type_id: String(row.leave_type_id),
          type_name: typeName,
          color,
          date: cursor.toISOString().slice(0, 10),
          duration: row.duration,
          half_day_type: row.half_day_type,
          days_count: Number(row.days_count || 0),
          employeeName,
        });
      }
    }

    return entries;
  } catch (e) {
    console.error('[leave] getLeavesForDateRange failed:', e);
    return [];
  }
}

/**
 * Aggregated leave report for the requested period — grouped by
 * (employee, type) with approved/pending/rejected day totals.
 */
export async function getLeaveReport(period: {
  from: string | Date;
  to: string | Date;
}): Promise<WsLeaveReportRow[]> {
  const t = await requireTenant();
  if (!t.ok) return [];
  try {
    const { db } = await connectToDatabase();
    const start = toDateOnly(period.from);
    const end = toDateOnly(period.to);

    const [leaveRows, typeRows, empRows] = await Promise.all([
      db
        .collection(COLL.LEAVES)
        .find({
          userId: t.userId,
          leave_date: { $gte: start, $lte: end },
        })
        .toArray(),
      db.collection(COLL.TYPES).find({ userId: t.userId }).toArray(),
      db
        .collection('crm_employees')
        .find({ userId: t.userId })
        .project({ firstName: 1, lastName: 1 })
        .toArray(),
    ]);

    const typeMap = new Map<string, WsLeaveType>();
    for (const r of toPlain<WsLeaveType[]>(typeRows)) {
      typeMap.set(String(r._id), r);
    }
    const empMap = new Map<string, string>();
    for (const r of toPlain<Array<{ _id: string; firstName?: string; lastName?: string }>>(empRows)) {
      empMap.set(
        String(r._id),
        [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || 'Unnamed',
      );
    }

    const accum = new Map<string, WsLeaveReportRow>();
    for (const l of toPlain<WsLeave[]>(leaveRows)) {
      const type = typeMap.get(String(l.leave_type_id));
      const key = `${l.user_id}::${l.leave_type_id}`;
      if (!accum.has(key)) {
        accum.set(key, {
          employee_id: String(l.user_id),
          employee_name: empMap.get(String(l.user_id)) ?? 'Unnamed',
          leave_type_id: String(l.leave_type_id),
          type_name: type?.type_name ?? 'Leave',
          color: type?.color ?? '#94A3B8',
          approved_days: 0,
          pending_days: 0,
          rejected_days: 0,
        });
      }
      const row = accum.get(key)!;
      const days = Number(l.days_count || 0);
      if (l.status === 'approved') row.approved_days += days;
      else if (l.status === 'pending') row.pending_days += days;
      else if (l.status === 'rejected') row.rejected_days += days;
    }

    return Array.from(accum.values()).sort((a, b) =>
      a.employee_name.localeCompare(b.employee_name),
    );
  } catch (e) {
    console.error('[leave] getLeaveReport failed:', e);
    return [];
  }
}
