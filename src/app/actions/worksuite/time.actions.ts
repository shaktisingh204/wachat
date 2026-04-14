'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import { wsComputeHours } from '@/lib/worksuite/time-types';
import type {
  WsProjectTimeLog,
  WsProjectTimeLogBreak,
  WsWeeklyTimesheet,
  WsWeeklyTimesheetEntry,
  WsLogTimeFor,
} from '@/lib/worksuite/time-types';

/**
 * Worksuite Time Tracking — server actions. Follows the same pattern
 * as `hr.actions.ts` (hrList/hrGetById/hrSave/hrDelete) for generic
 * CRUD, and adds domain-specific actions for timers, breaks, and
 * approval flows.
 */

const COL_LOG = 'crm_project_time_logs';
const COL_BREAK = 'crm_project_time_log_breaks';
const COL_TS = 'crm_weekly_timesheets';
const COL_TS_ENTRY = 'crm_weekly_timesheet_entries';
const COL_SETTINGS = 'crm_log_time_for';

const ROUTE_BASE = '/dashboard/crm/time-tracking';

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/* ─────────────────────────────────────────────
 *  Project Time Logs
 * ──────────────────────────────────────────── */

export async function getTimeLogs(filter?: {
  project_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
}): Promise<WsProjectTimeLog[]> {
  const extra: Record<string, unknown> = {};
  if (filter?.project_id && ObjectId.isValid(filter.project_id)) {
    extra.project_id = new ObjectId(filter.project_id);
  }
  if (filter?.user_id && ObjectId.isValid(filter.user_id)) {
    extra.user_id = new ObjectId(filter.user_id);
  }
  if (filter?.from || filter?.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = new Date(filter.from);
    if (filter.to) range.$lte = new Date(filter.to);
    extra.start_time = range;
  }
  const list = await hrList<WsProjectTimeLog>(COL_LOG, {
    extraFilter: extra,
    sortBy: { start_time: -1 },
  });
  return list as unknown as WsProjectTimeLog[];
}

export async function getTimeLogById(id: string) {
  return hrGetById<WsProjectTimeLog>(COL_LOG, id);
}

export async function saveTimeLog(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  try {
    const data: Record<string, unknown> = {};
    formData.forEach((v, k) => {
      data[k] = typeof v === 'string' ? v : v;
    });
    for (const k of ['total_hours', 'total_minutes', 'earnings', 'hourly_rate']) {
      if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
    }
    if (typeof data.approved === 'string') {
      data.approved = data.approved === 'true' || data.approved === 'on';
    }
    if (data.start_time && data.end_time) {
      const { hours, minutes } = wsComputeHours(
        data.start_time as string,
        data.end_time as string,
      );
      data.total_hours = hours;
      data.total_minutes = minutes;
    }
    const res = await hrSave(COL_LOG, data, {
      idFields: ['project_id', 'task_id', 'user_id', 'approved_by'],
      dateFields: ['start_time', 'end_time'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(`${ROUTE_BASE}/time-logs`);
    return { message: 'Saved.', id: res.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save';
    return { error: msg };
  }
}

export async function deleteTimeLog(id: string) {
  const r = await hrDelete(COL_LOG, id);
  revalidatePath(`${ROUTE_BASE}/time-logs`);
  return r;
}

/* ───────── Timer controls ───────── */

export async function startTimer(
  projectId?: string,
  taskId?: string,
  memo?: string,
): Promise<Result<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  const payload: Record<string, unknown> = {
    start_time: new Date().toISOString(),
    approved: false,
    memo: memo || '',
    user_id: user._id,
  };
  if (projectId) payload.project_id = projectId;
  if (taskId) payload.task_id = taskId;
  const res = await hrSave(COL_LOG, payload, {
    idFields: ['project_id', 'task_id', 'user_id'],
    dateFields: ['start_time'],
  });
  if (res.error || !res.id) {
    return { ok: false, error: res.error || 'Failed to start timer' };
  }
  revalidatePath(`${ROUTE_BASE}/time-logs`);
  return { ok: true, data: { id: res.id } };
}

export async function stopTimer(logId: string): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(logId)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const doc = await db.collection(COL_LOG).findOne({
    _id: new ObjectId(logId),
    userId: new ObjectId(user._id),
  });
  if (!doc) return { ok: false, error: 'Not found' };
  const end = new Date();
  const { hours, minutes } = wsComputeHours(doc.start_time as Date, end);
  await db.collection(COL_LOG).updateOne(
    { _id: new ObjectId(logId), userId: new ObjectId(user._id) },
    {
      $set: {
        end_time: end,
        total_hours: hours,
        total_minutes: minutes,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`${ROUTE_BASE}/time-logs`);
  revalidatePath(`${ROUTE_BASE}/time-logs/${logId}`);
  return { ok: true };
}

export async function approveTimeLog(logId: string): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(logId)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COL_LOG).updateOne(
    { _id: new ObjectId(logId), userId: new ObjectId(user._id) },
    {
      $set: {
        approved: true,
        status: 'approved',
        approved_by: new ObjectId(user._id),
        reason: '',
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`${ROUTE_BASE}/time-logs`);
  return { ok: true };
}

export async function rejectTimeLog(
  logId: string,
  reason: string,
): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(logId)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COL_LOG).updateOne(
    { _id: new ObjectId(logId), userId: new ObjectId(user._id) },
    {
      $set: {
        approved: false,
        status: 'rejected',
        reason,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`${ROUTE_BASE}/time-logs`);
  return { ok: true };
}

/* ─────────────────────────────────────────────
 *  Breaks
 * ──────────────────────────────────────────── */

export async function getBreaksForLog(
  logId: string,
): Promise<WsProjectTimeLogBreak[]> {
  if (!ObjectId.isValid(logId)) return [];
  const list = await hrList<WsProjectTimeLogBreak>(COL_BREAK, {
    extraFilter: { project_time_log_id: new ObjectId(logId) },
    sortBy: { start_time: 1 },
  });
  return list as unknown as WsProjectTimeLogBreak[];
}

export async function startBreak(
  logId: string,
  reason?: string,
): Promise<Result<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(logId)) return { ok: false, error: 'Invalid log' };
  const res = await hrSave(
    COL_BREAK,
    {
      project_time_log_id: logId,
      start_time: new Date().toISOString(),
      reason: reason || '',
    },
    {
      idFields: ['project_time_log_id'],
      dateFields: ['start_time'],
    },
  );
  if (res.error || !res.id) {
    return { ok: false, error: res.error || 'Failed to start break' };
  }
  revalidatePath(`${ROUTE_BASE}/time-logs/${logId}`);
  return { ok: true, data: { id: res.id } };
}

export async function stopBreak(breakId: string): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(breakId)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const doc = await db.collection(COL_BREAK).findOne({
    _id: new ObjectId(breakId),
    userId: new ObjectId(user._id),
  });
  if (!doc) return { ok: false, error: 'Not found' };
  await db.collection(COL_BREAK).updateOne(
    { _id: new ObjectId(breakId), userId: new ObjectId(user._id) },
    { $set: { end_time: new Date(), updatedAt: new Date() } },
  );
  const logId = String(doc.project_time_log_id);
  revalidatePath(`${ROUTE_BASE}/time-logs/${logId}`);
  return { ok: true };
}

export async function deleteBreak(id: string) {
  const r = await hrDelete(COL_BREAK, id);
  return r;
}

/* ─────────────────────────────────────────────
 *  Weekly Timesheets
 * ──────────────────────────────────────────── */

export async function getWeeklyTimesheets(): Promise<WsWeeklyTimesheet[]> {
  const list = await hrList<WsWeeklyTimesheet>(COL_TS, {
    sortBy: { week_start_date: -1 },
  });
  return list as unknown as WsWeeklyTimesheet[];
}

export async function getWeeklyTimesheetById(id: string) {
  return hrGetById<WsWeeklyTimesheet>(COL_TS, id);
}

export async function saveWeeklyTimesheet(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  try {
    const data: Record<string, unknown> = {};
    formData.forEach((v, k) => {
      data[k] = typeof v === 'string' ? v : v;
    });
    for (const k of ['total_hours', 'total_minutes']) {
      if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
    }
    if (!data.status) data.status = 'draft';
    const res = await hrSave(COL_TS, data, {
      idFields: ['user_id', 'approved_by'],
      dateFields: ['week_start_date', 'week_end_date', 'submitted_at', 'approved_at'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(`${ROUTE_BASE}/weekly-timesheets`);
    return { message: 'Saved.', id: res.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save';
    return { error: msg };
  }
}

export async function deleteWeeklyTimesheet(id: string) {
  const r = await hrDelete(COL_TS, id);
  revalidatePath(`${ROUTE_BASE}/weekly-timesheets`);
  return r;
}

async function recomputeTimesheetTotals(timesheetId: string) {
  const user = await requireSession();
  if (!user || !ObjectId.isValid(timesheetId)) return;
  const { db } = await connectToDatabase();
  const entries = await db
    .collection(COL_TS_ENTRY)
    .find({
      weekly_timesheet_id: new ObjectId(timesheetId),
      userId: new ObjectId(user._id),
    })
    .toArray();
  const totalHoursFloat = entries.reduce(
    (sum, e) => sum + (Number(e.hours) || 0),
    0,
  );
  const totalMinutes = Math.round(totalHoursFloat * 60);
  await db.collection(COL_TS).updateOne(
    { _id: new ObjectId(timesheetId), userId: new ObjectId(user._id) },
    {
      $set: {
        total_hours: Math.floor(totalMinutes / 60),
        total_minutes: totalMinutes % 60,
        updatedAt: new Date(),
      },
    },
  );
}

export async function submitWeeklyTimesheet(id: string): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COL_TS).updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    {
      $set: {
        status: 'submitted',
        submitted_at: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`${ROUTE_BASE}/weekly-timesheets`);
  revalidatePath(`${ROUTE_BASE}/weekly-timesheets/${id}`);
  return { ok: true };
}

export async function approveWeeklyTimesheet(id: string): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COL_TS).updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    {
      $set: {
        status: 'approved',
        approved_by: new ObjectId(user._id),
        approved_at: new Date(),
        reason: '',
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`${ROUTE_BASE}/weekly-timesheets`);
  return { ok: true };
}

export async function rejectWeeklyTimesheet(
  id: string,
  reason: string,
): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COL_TS).updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    {
      $set: { status: 'rejected', reason, updatedAt: new Date() },
    },
  );
  revalidatePath(`${ROUTE_BASE}/weekly-timesheets`);
  return { ok: true };
}

/* ───────── Weekly timesheet entries ───────── */

export async function getWeeklyEntries(
  timesheetId: string,
): Promise<WsWeeklyTimesheetEntry[]> {
  if (!ObjectId.isValid(timesheetId)) return [];
  const list = await hrList<WsWeeklyTimesheetEntry>(COL_TS_ENTRY, {
    extraFilter: { weekly_timesheet_id: new ObjectId(timesheetId) },
    sortBy: { date: 1 },
  });
  return list as unknown as WsWeeklyTimesheetEntry[];
}

export async function upsertWeeklyEntry(
  timesheetId: string,
  taskId: string,
  date: string,
  hours: number,
): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!ObjectId.isValid(timesheetId)) {
    return { ok: false, error: 'Invalid timesheet' };
  }
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = {
    userId: new ObjectId(user._id),
    weekly_timesheet_id: new ObjectId(timesheetId),
    date: new Date(date),
  };
  if (taskId && ObjectId.isValid(taskId)) {
    filter.task_id = new ObjectId(taskId);
  } else if (taskId) {
    filter.task_id = taskId;
  }
  if (!hours || hours <= 0) {
    await db.collection(COL_TS_ENTRY).deleteOne(filter);
  } else {
    await db.collection(COL_TS_ENTRY).updateOne(
      filter,
      {
        $set: {
          ...filter,
          hours: Number(hours),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  await recomputeTimesheetTotals(timesheetId);
  revalidatePath(`${ROUTE_BASE}/weekly-timesheets/${timesheetId}`);
  return { ok: true };
}

export async function deleteWeeklyEntry(id: string) {
  const r = await hrDelete(COL_TS_ENTRY, id);
  return r;
}

/* ─────────────────────────────────────────────
 *  Log-Time-For Settings
 * ──────────────────────────────────────────── */

export async function getLogTimeSettings(): Promise<WsLogTimeFor[]> {
  const list = await hrList<WsLogTimeFor>(COL_SETTINGS);
  return list as unknown as WsLogTimeFor[];
}

export async function setLogTimeFor(
  module: 'projects' | 'tasks',
  isEnabled: boolean,
): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  await db.collection(COL_SETTINGS).updateOne(
    { userId: new ObjectId(user._id), module },
    {
      $set: {
        module,
        is_enabled: isEnabled,
        userId: new ObjectId(user._id),
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  revalidatePath(`${ROUTE_BASE}/settings`);
  return { ok: true };
}

/* ─────────────────────────────────────────────
 *  Reports
 * ──────────────────────────────────────────── */

import type { WsTimeReportRow } from '@/lib/worksuite/time-types';

export async function getTimeReport(
  groupBy: 'employee' | 'project' | 'date' = 'project',
  from?: string,
  to?: string,
): Promise<WsTimeReportRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const match: Record<string, unknown> = {
    userId: new ObjectId(user._id),
    end_time: { $ne: null, $exists: true },
  };
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    match.start_time = range;
  }
  const rawLogs = await db.collection(COL_LOG).find(match).toArray();
  const buckets = new Map<string, WsTimeReportRow>();
  for (const log of rawLogs) {
    let key = 'unknown';
    if (groupBy === 'employee') key = String(log.user_id ?? 'unknown');
    else if (groupBy === 'project') key = String(log.project_id ?? 'unknown');
    else if (groupBy === 'date') {
      const d = log.start_time ? new Date(log.start_time as Date) : null;
      key = d ? d.toISOString().slice(0, 10) : 'unknown';
    }
    const prev = buckets.get(key) ?? {
      key,
      label: key,
      totalHours: 0,
      totalMinutes: 0,
      entries: 0,
    };
    prev.totalHours += Number(log.total_hours) || 0;
    prev.totalMinutes += Number(log.total_minutes) || 0;
    prev.entries += 1;
    buckets.set(key, prev);
  }
  // normalize minute overflow
  const rows = Array.from(buckets.values()).map((r) => {
    const extraHours = Math.floor(r.totalMinutes / 60);
    return {
      ...r,
      totalHours: r.totalHours + extraHours,
      totalMinutes: r.totalMinutes % 60,
    };
  });
  rows.sort((a, b) => b.totalHours * 60 + b.totalMinutes - (a.totalHours * 60 + a.totalMinutes));
  return serialize(rows);
}
