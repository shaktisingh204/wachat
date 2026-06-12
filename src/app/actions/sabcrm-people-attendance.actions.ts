'use server';

/**
 * SabCRM People — Attendance server actions (P7 People suite, spec
 * `docs/sabcrm/rnd/people-suite.md` WI-17/WI-25).
 *
 * Data paths for `/sabcrm/people/attendance`:
 *
 *   - display-ready list rows (employee + shift labels resolved
 *     server-side — raw ObjectIds never reach the client) with the
 *     present/absent/late-today KPI strip;
 *   - full create / update / delete over the project-scoped engine
 *     mount (whole `CreateAttendanceInput` surface incl. punch points
 *     and break slots);
 *   - the `punch-in` / `punch-out` shorthand flows.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * `sabcrm-finance-invoices.actions.ts`. Engine failures normalise into
 * `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleAttendanceApi,
  type CrmAttendanceCreateInput,
  type CrmAttendanceDoc,
  type CrmAttendanceUpdateInput,
  type CrmBreakSlot,
  type CrmPunchPoint,
} from '@/lib/rust-client/sabcrm-people-attendance';
import {
  sabcrmPeopleEmployeesApi,
  sabcrmPeopleEmployeeOptionsApi,
  type SabcrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-employees';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmAttendanceDetail,
  SabcrmAttendanceFormValues,
  SabcrmAttendanceKpis,
  SabcrmAttendanceListFilters,
  SabcrmAttendanceListPage,
  SabcrmAttendanceListRow,
  SabcrmPunchPointValues,
  SabcrmPunchValues,
} from './sabcrm-people-attendance.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const PEOPLE_ATTENDANCE_PATH = '/sabcrm/people/attendance';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  const allowed = await canServer(MODULE_KEY, action, requested);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Coerce a date / datetime-local string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Label resolution ────────────────────────────────────────── */

function employeeLabel(doc: SabcrmEmployeeDoc): string {
  const full = [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim();
  return doc.displayName?.trim() || full || doc.employeeId || 'Employee';
}

async function resolveEmployeeLabels(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const doc = await sabcrmPeopleEmployeesApi.getById(projectId, id);
        map.set(id, employeeLabel(doc));
      } catch {
        // Gone / cross-tenant — render "Unknown", never the id.
      }
    }),
  );
  return map;
}

async function resolveShiftLabels(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const doc = await sabcrmPeopleEmployeeOptionsApi.getShift(projectId, id);
        if (doc?.name) map.set(id, doc.name);
      } catch {
        // Tolerated.
      }
    }),
  );
  return map;
}

/** `2026-06-13T09:12:00Z` → `09:12` (UTC wall time, deterministic). */
function toHhMm(iso: string | undefined): string {
  if (!iso) return '';
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m?.[1] ?? '';
}

function hoursText(h: number | undefined): string {
  if (h === undefined || h === null) return '';
  return `${h.toFixed(1)}h`;
}

function toListRow(
  doc: CrmAttendanceDoc,
  employees: Map<string, string>,
  shifts: Map<string, string>,
): SabcrmAttendanceListRow {
  return {
    id: doc._id,
    date: doc.date,
    employeeId: doc.employeeId,
    employeeLabel: employees.get(doc.employeeId) ?? null,
    shiftId: doc.shiftId,
    shiftLabel: doc.shiftId ? (shifts.get(doc.shiftId) ?? null) : null,
    punchInAt: toHhMm(doc.punchIn?.at),
    punchOutAt: toHhMm(doc.punchOut?.at),
    totalHours: hoursText(doc.totalHours),
    overtimeHours: hoursText(doc.overtimeHours),
    lateByMinutes: doc.lateByMinutes ?? 0,
    status: doc.status ?? 'present',
    source: doc.source ?? 'manual',
  };
}

/** Day-key bounds → inclusive ISO instants the engine filter expects. */
function dayBounds(from?: string, to?: string): {
  dateFrom?: string;
  dateTo?: string;
} {
  return {
    dateFrom: from ? `${from}T00:00:00Z` : undefined,
    dateTo: to ? `${to}T23:59:59Z` : undefined,
  };
}

/* ─── List page (display-ready rows) ──────────────────────────── */

export async function listSabcrmAttendancePage(
  filters: SabcrmAttendanceListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmAttendanceListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmPeopleAttendanceApi.list(g.ctx.projectId, {
      page,
      limit,
      employeeId: filters.employeeId || undefined,
      status: filters.status || undefined,
      ...dayBounds(filters.from, filters.to),
    });
    const hasMore = docs.length === limit;

    const [employees, shifts] = await Promise.all([
      resolveEmployeeLabels(g.ctx.projectId, docs.map((d) => d.employeeId)),
      resolveShiftLabels(g.ctx.projectId, docs.map((d) => d.shiftId ?? '')),
    ]);

    let rows = docs.map((d) => toListRow(d, employees, shifts));
    // In-page free-text refinement (the crate exposes no `q`).
    const q = (filters.q ?? '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.employeeLabel ?? '', r.shiftLabel ?? '', r.status, r.source]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    return { ok: true, data: { rows, page, hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list attendance.');
  }
}

const SCAN_MAX_PAGES = 5;

/** Capped fetch-all (≤500) for CSV export, honouring filters. */
export async function exportSabcrmAttendanceRows(
  filters: SabcrmAttendanceListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmAttendanceListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmAttendanceDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmPeopleAttendanceApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        employeeId: filters.employeeId || undefined,
        status: filters.status || undefined,
        ...dayBounds(filters.from, filters.to),
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    const [employees, shifts] = await Promise.all([
      resolveEmployeeLabels(g.ctx.projectId, docs.map((d) => d.employeeId)),
      resolveShiftLabels(g.ctx.projectId, docs.map((d) => d.shiftId ?? '')),
    ]);
    let rows = docs.map((d) => toListRow(d, employees, shifts));
    const q = (filters.q ?? '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.employeeLabel ?? '', r.shiftLabel ?? '', r.status, r.source]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export attendance.');
  }
}

/* ─── KPIs (today) ────────────────────────────────────────────── */

export async function getSabcrmAttendanceKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmAttendanceKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const today = new Date().toISOString().slice(0, 10);

  try {
    const docs: CrmAttendanceDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmPeopleAttendanceApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        ...dayBounds(today, today),
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }

    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;
    for (const doc of docs) {
      const status = doc.status ?? 'present';
      if (status === 'present' || status === 'wfh' || status === 'half_day') {
        presentToday += 1;
      }
      if (status === 'absent') absentToday += 1;
      if ((doc.lateByMinutes ?? 0) > 0) lateToday += 1;
    }

    return {
      ok: true,
      data: { presentToday, absentToday, lateToday, markedToday: docs.length },
    };
  } catch (e) {
    return fail(e, 'Failed to compute attendance KPIs.');
  }
}

/* ─── Get (detail drawer) ─────────────────────────────────────── */

export async function getSabcrmAttendance(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmAttendanceDetail>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmPeopleAttendanceApi.getById(g.ctx.projectId, id);
    const [employees, shifts] = await Promise.all([
      resolveEmployeeLabels(g.ctx.projectId, [
        doc.employeeId,
        doc.approverId ?? '',
      ]),
      resolveShiftLabels(g.ctx.projectId, [doc.shiftId ?? '']),
    ]);
    return {
      ok: true,
      data: {
        doc,
        employeeLabel: employees.get(doc.employeeId) ?? null,
        shiftLabel: doc.shiftId ? (shifts.get(doc.shiftId) ?? null) : null,
        approverLabel: doc.approverId
          ? (employees.get(doc.approverId) ?? null)
          : null,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the attendance record.');
  }
}

/* ─── Create / update / delete ────────────────────────────────── */

function toWirePunch(
  p: SabcrmPunchPointValues | null | undefined,
): CrmPunchPoint | undefined {
  if (!p || !p.at) return undefined;
  const at = toIso(p.at);
  if (!at) return undefined;
  const lat = p.lat?.trim() ? Number(p.lat) : undefined;
  const lng = p.lng?.trim() ? Number(p.lng) : undefined;
  return {
    at,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    ip: p.ip?.trim() || undefined,
    device: p.device?.trim() || undefined,
    selfieFileId: p.selfieFileId || undefined,
  };
}

function toWireBreaks(
  rows: { in: string; out?: string }[],
): CrmBreakSlot[] | undefined {
  const out: CrmBreakSlot[] = [];
  for (const row of rows) {
    if (!row.in) continue;
    const inIso = toIso(row.in);
    if (!inIso) continue;
    out.push({
      in: inIso,
      out: row.out ? (toIso(row.out) ?? undefined) : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

function buildCreateInput(
  values: SabcrmAttendanceFormValues,
): CrmAttendanceCreateInput | string {
  if (!values.employeeId) return 'Pick an employee.';
  if (!values.status) return 'Pick a status.';
  const date = toIso(values.date);
  if (!date) return 'Date is required.';

  return {
    date,
    employeeId: values.employeeId,
    status: values.status,
    shiftId: values.shiftId || undefined,
    punchIn: toWirePunch(values.punchIn),
    punchOut: toWirePunch(values.punchOut),
    breaks: toWireBreaks(values.breaks ?? []),
    totalHours: values.totalHours,
    overtimeHours: values.overtimeHours,
    lateByMinutes: values.lateByMinutes,
    earlyOutByMinutes: values.earlyOutByMinutes,
    source: values.source || undefined,
    approverId: values.approverId || undefined,
    notes: values.notes?.trim() || undefined,
  };
}

export async function createSabcrmAttendance(
  values: SabcrmAttendanceFormValues,
  projectId?: string,
): Promise<ActionResult<CrmAttendanceDoc>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const input = buildCreateInput(values);
  if (typeof input === 'string') return { ok: false, error: input };

  try {
    const doc = await sabcrmPeopleAttendanceApi.create(g.ctx.projectId, input);
    revalidatePath(PEOPLE_ATTENDANCE_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to log the attendance record.');
  }
}

export async function updateSabcrmAttendance(
  id: string,
  values: SabcrmAttendanceFormValues,
  projectId?: string,
): Promise<ActionResult<CrmAttendanceDoc>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const built = buildCreateInput(values);
  if (typeof built === 'string') return { ok: false, error: built };
  const { ...patch } = built;
  // PATCH replaces the breaks array wholesale; send [] to clear.
  const wire: CrmAttendanceUpdateInput = {
    ...patch,
    breaks: toWireBreaks(values.breaks ?? []) ?? [],
  };

  try {
    const doc = await sabcrmPeopleAttendanceApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(PEOPLE_ATTENDANCE_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the attendance record.');
  }
}

export async function deleteSabcrmAttendance(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeopleAttendanceApi.delete(g.ctx.projectId, id);
    revalidatePath(PEOPLE_ATTENDANCE_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the attendance record.');
  }
}

/* ─── Punch shorthand flows ───────────────────────────────────── */

export async function punchInSabcrm(
  values: SabcrmPunchValues,
  projectId?: string,
): Promise<ActionResult<CrmAttendanceDoc>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!values.employeeId) return { ok: false, error: 'Pick an employee.' };

  try {
    const doc = await sabcrmPeopleAttendanceApi.punchIn(g.ctx.projectId, {
      employeeId: values.employeeId,
      lat: values.lat,
      lng: values.lng,
      device: values.device,
      selfieFileId: values.selfieFileId || undefined,
      source: values.source ?? 'web',
    });
    revalidatePath(PEOPLE_ATTENDANCE_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to punch in.');
  }
}

export async function punchOutSabcrm(
  values: SabcrmPunchValues,
  projectId?: string,
): Promise<ActionResult<CrmAttendanceDoc>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!values.employeeId) return { ok: false, error: 'Pick an employee.' };

  try {
    const doc = await sabcrmPeopleAttendanceApi.punchOut(g.ctx.projectId, {
      employeeId: values.employeeId,
      lat: values.lat,
      lng: values.lng,
      device: values.device,
      selfieFileId: values.selfieFileId || undefined,
      source: values.source ?? 'web',
    });
    revalidatePath(PEOPLE_ATTENDANCE_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to punch out.');
  }
}
