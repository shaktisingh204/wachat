'use server';

/**
 * CRM Attendance server actions.
 *
 * Thin shims over the Rust BFF (`crmAttendanceApi`). No direct Mongo
 * access. FormData callers (the create/edit pages) hit
 * `saveAttendanceAction` / `deleteAttendanceAction`; programmatic
 * callers can use the typed helpers (`listAttendance`, `getAttendance`,
 * etc.).
 *
 * Note: `'attendance'` is **not** a `WsCustomFieldBelongsTo` value, so
 * the custom-field plumbing used by `leads.actions.ts` is intentionally
 * absent from this module.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmAttendanceApi,
  type CrmAttendanceCreateInput,
  type CrmAttendanceDoc,
  type CrmAttendanceListParams,
  type CrmAttendancePunchInput,
  type CrmAttendanceSource,
  type CrmAttendanceStatus,
  type CrmAttendanceUpdateInput,
} from '@/lib/rust-client/crm-attendance';

const LIST_PATH = '/dashboard/crm/hr-payroll/attendance';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

const ALLOWED_STATUS: ReadonlySet<CrmAttendanceStatus> = new Set([
  'present',
  'absent',
  'half_day',
  'leave',
  'holiday',
  'wfh',
]);

const ALLOWED_SOURCES: ReadonlySet<CrmAttendanceSource> = new Set([
  'manual',
  'biometric',
  'web',
  'mobile',
]);

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface AttendanceListResult {
  records: CrmAttendanceDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listAttendance(
  params: CrmAttendanceListParams = {},
): Promise<AttendanceListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const records = await crmAttendanceApi.list({ ...params, page, limit });
    return { records, page, limit, hasMore: records.length === limit };
  } catch (e) {
    recordRustFallback({ entity: 'attendance', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { records: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

/**
 * §1D.1 — KPI snapshot for the attendance list-page strip.
 *
 * Pulls a representative 200-row Rust window and aggregates locally so
 * the list page renders the strip server-side. Returns a zeroed
 * snapshot on Rust failure (never throws). Replace with a dedicated
 * `/v1/crm/attendance/kpis` aggregate once tenant volumes blow past
 * the 200 ceiling.
 */
export interface AttendanceKpiSummary {
  presentToday: number;
  absentToday: number;
  halfDayToday: number;
  lateToday: number;
  wfhThisWeek: number;
}

export async function getAttendanceKpis(): Promise<AttendanceKpiSummary> {
  const empty: AttendanceKpiSummary = {
    presentToday: 0,
    absentToday: 0,
    halfDayToday: 0,
    lateToday: 0,
    wfhThisWeek: 0,
  };
  try {
    const docs = await crmAttendanceApi.list({ page: 1, limit: 200 });
    const todayIso = new Date().toISOString().slice(0, 10);
    const sevenAgo = Date.now() - 7 * 86_400_000;
    const out = { ...empty };
    for (const a of docs) {
      const sameDay = a.date?.slice(0, 10) === todayIso;
      if (sameDay) {
        if (a.status === 'present') out.presentToday += 1;
        else if (a.status === 'absent') out.absentToday += 1;
        else if (a.status === 'half_day') out.halfDayToday += 1;
        if ((a.lateByMinutes ?? 0) > 0) out.lateToday += 1;
      }
      if (a.status === 'wfh' && a.date) {
        const t = new Date(a.date).getTime();
        if (!Number.isNaN(t) && t >= sevenAgo) out.wfhThisWeek += 1;
      }
    }
    return out;
  } catch (e) {
    recordRustFallback({
      entity: 'attendance',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return empty;
  }
}

export async function getAttendance(
  id: string,
): Promise<{ record: CrmAttendanceDoc | null; error?: string }> {
  if (!id) return { record: null, error: 'Missing attendance id.' };
  try {
    const record = await crmAttendanceApi.getById(id);
    return { record };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { record: null, error: 'Attendance record not found.' };
    }
    recordRustFallback({ entity: 'attendance', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { record: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Convert a `<input type="date">` value (`YYYY-MM-DD`) to an ISO-8601
 * UTC datetime. Returns `undefined` for empty or unparsable strings.
 */
function pickDateIso(formData: FormData, key: string): string | undefined {
  const raw = pickString(formData, key);
  if (!raw) return undefined;
  // Treat as a calendar day in the tenant timezone — appending the
  // midnight UTC suffix matches the Rust handler's start-of-day
  // normalization.
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Combine a `YYYY-MM-DD` date and an `HH:MM` time into an ISO-8601 UTC
 * datetime. Returns `undefined` when either side is missing or invalid.
 */
function combineDateTime(
  dateStr: string | undefined,
  timeStr: string | undefined,
): string | undefined {
  if (!dateStr || !timeStr) return undefined;
  const datePart = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const iso = `${datePart}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function pickStatus(formData: FormData): CrmAttendanceStatus | undefined {
  const v = pickString(formData, 'status');
  if (!v) return undefined;
  return ALLOWED_STATUS.has(v as CrmAttendanceStatus)
    ? (v as CrmAttendanceStatus)
    : undefined;
}

function pickSource(formData: FormData): CrmAttendanceSource | undefined {
  const v = pickString(formData, 'source');
  if (!v) return undefined;
  return ALLOWED_SOURCES.has(v as CrmAttendanceSource)
    ? (v as CrmAttendanceSource)
    : undefined;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. `checkInTime` / `checkOutTime` are HTML `<input type="time">`
 * values combined with `date` to build the wire-format `punchIn` /
 * `punchOut` instants.
 */
export async function saveAttendanceAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission(
    'crm_attendance',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  // Keep the flag referenced so the dual-impl helper survives lint.
  void useRustCrm();

  const employeeId = pickString(formData, 'employeeId');
  const dateIso = pickDateIso(formData, 'date');
  const status = pickStatus(formData);

  if (!employeeId) return { error: 'Employee is required.' };
  if (!dateIso) return { error: 'Date is required.' };
  if (!status) return { error: 'Status is required.' };

  // The check-in / check-out controls are pure `<input type="time">`
  // values — combine them with the same calendar day for the punch
  // timestamps.
  const dateRaw = pickString(formData, 'date');
  const checkInTime = pickString(formData, 'checkInTime');
  const checkOutTime = pickString(formData, 'checkOutTime');
  const punchInAt = combineDateTime(dateRaw, checkInTime);
  const punchOutAt = combineDateTime(dateRaw, checkOutTime);

  // Compute `totalHours` from the punch window when both sides are
  // present and the caller didn't supply an override. Anything over a
  // single day is clamped — payroll edge cases (overnight shifts) go
  // through the manual override path.
  let totalHours = pickNumber(formData, 'totalHours');
  if (totalHours === undefined && punchInAt && punchOutAt) {
    const diffMs = new Date(punchOutAt).getTime() - new Date(punchInAt).getTime();
    if (Number.isFinite(diffMs) && diffMs > 0) {
      totalHours = Math.min(24, Math.round((diffMs / 3_600_000) * 100) / 100);
    }
  }

  const draft: CrmAttendanceCreateInput = {
    date: dateIso,
    employeeId,
    status,
    shiftId: pickString(formData, 'shiftId'),
    punchIn: punchInAt ? { at: punchInAt } : undefined,
    punchOut: punchOutAt ? { at: punchOutAt } : undefined,
    totalHours,
    overtimeHours: pickNumber(formData, 'overtimeHours'),
    lateByMinutes: pickNumber(formData, 'lateByMinutes'),
    earlyOutByMinutes: pickNumber(formData, 'earlyOutByMinutes'),
    source: pickSource(formData),
    approverId: pickString(formData, 'approverId'),
    notes: pickString(formData, 'notes'),
  };

  try {
    let result: CrmAttendanceDoc;
    if (id) {
      const patch: CrmAttendanceUpdateInput = { ...draft };
      result = await crmAttendanceApi.update(id, patch);
    } else {
      result = await crmAttendanceApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'attendance',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Attendance updated.' : 'Attendance recorded.',
      id: String(result._id),
    };
  } catch (e) {
    recordRustFallback({ entity: 'attendance', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete an attendance record. The Rust handler removes the row
 * from the collection — no soft-delete flag.
 */
export async function deleteAttendanceAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing attendance id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_attendance', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmAttendanceApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'attendance',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Attendance record not found.' };
    }
    recordRustFallback({ entity: 'attendance', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmAttendanceApi.x(...)`.

export async function createAttendance(input: CrmAttendanceCreateInput) {
  return crmAttendanceApi.create(input);
}

export async function updateAttendance(
  id: string,
  patch: CrmAttendanceUpdateInput,
) {
  return crmAttendanceApi.update(id, patch);
}

export async function deleteAttendance(id: string) {
  return crmAttendanceApi.delete(id);
}

/**
 * Mobile-flow shorthand: stamp today's punch-in for `employeeId`.
 * Mirror of `crmAttendanceApi.punchIn` — exposed as a server action so
 * client components can call it without minting a Rust JWT themselves.
 */
export async function punchInAction(
  input: CrmAttendancePunchInput,
): Promise<{ record?: CrmAttendanceDoc; error?: string }> {
  if (!input.employeeId) return { error: 'Employee is required.' };

  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const guard = await requirePermission('crm_attendance', 'create');
  if (!guard.ok) return { error: guard.error };

  try {
    const record = await crmAttendanceApi.punchIn(input);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'punch_in',
        entityKind: 'attendance',
        entityId: String(record._id ?? ''),
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { record };
  } catch (e) {
    recordRustFallback({ entity: 'attendance', op: 'other', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/** Mirror of {@link punchInAction} for clock-out. */
export async function punchOutAction(
  input: CrmAttendancePunchInput,
): Promise<{ record?: CrmAttendanceDoc; error?: string }> {
  if (!input.employeeId) return { error: 'Employee is required.' };

  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const guard = await requirePermission('crm_attendance', 'edit');
  if (!guard.ok) return { error: guard.error };

  try {
    const record = await crmAttendanceApi.punchOut(input);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'punch_out',
        entityKind: 'attendance',
        entityId: String(record._id ?? ''),
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { record };
  } catch (e) {
    recordRustFallback({ entity: 'attendance', op: 'other', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}
