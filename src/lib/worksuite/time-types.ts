/**
 * Worksuite Time Tracking — TypeScript types mirroring the Laravel
 * models (`ProjectTimeLog`, `ProjectTimeLogBreak`, `WeeklyTimesheet`,
 * `WeeklyTimesheetEntries`, `LogTimeFor`). All IDs are stored as
 * string representations of Mongo ObjectIds on the client side; the
 * CRUD helpers coerce them back to ObjectId on write.
 */

export type WsTimeLogApproval = 'pending' | 'approved' | 'rejected';

export interface WsProjectTimeLog {
  _id?: string;
  userId: string;               // tenant
  project_id?: string;          // optional; standalone logs allowed
  task_id?: string;             // optional (when log-time-for = projects only)
  user_id: string;              // employee logging the time
  memo?: string;
  start_time: string | Date;
  end_time?: string | Date | null;
  total_hours?: number;
  total_minutes?: number;
  earnings?: number;
  hourly_rate?: number;
  approved: boolean;
  approved_by?: string;
  reason?: string;              // rejection reason
  status?: WsTimeLogApproval;   // derived convenience
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface WsProjectTimeLogBreak {
  _id?: string;
  userId: string;
  project_time_log_id: string;
  start_time: string | Date;
  end_time?: string | Date | null;
  reason?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type WsWeeklyTimesheetStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface WsWeeklyTimesheet {
  _id?: string;
  userId: string;
  user_id: string;              // employee
  week_start_date: string | Date;
  week_end_date: string | Date;
  total_hours: number;
  total_minutes: number;
  status: WsWeeklyTimesheetStatus;
  reason?: string;              // rejection reason
  submitted_at?: string | Date;
  approved_by?: string;
  approved_at?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface WsWeeklyTimesheetEntry {
  _id?: string;
  userId: string;
  weekly_timesheet_id: string;
  task_id?: string;
  project_id?: string;
  date: string | Date;          // YYYY-MM-DD day
  hours: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type WsLogTimeModule = 'projects' | 'tasks';

export interface WsLogTimeFor {
  _id?: string;
  userId: string;
  module: WsLogTimeModule;
  is_enabled: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/* ───────────────────────────────
 *  Helpers (pure — safe for both client + server components)
 * ────────────────────────────── */

export function wsComputeHours(
  start?: string | Date | null,
  end?: string | Date | null,
): { hours: number; minutes: number } {
  if (!start || !end) return { hours: 0, minutes: 0 };
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!isFinite(a) || !isFinite(b) || b <= a) return { hours: 0, minutes: 0 };
  const totalMinutes = Math.floor((b - a) / 60000);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function wsFormatDuration(
  start?: string | Date | null,
  end?: string | Date | null,
): string {
  const { hours, minutes } = wsComputeHours(start, end);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** Returns YYYY-MM-DD for a local Date (no timezone shift). */
export function wsToISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Week start (Monday) and end (Sunday) for a given date. */
export function wsWeekBounds(ref: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();               // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7;   // Mon=0, Sun=6
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
