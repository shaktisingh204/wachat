'use server';

/**
 * SabCRM People — Shifts surface server actions
 * (`/sabcrm/people/shifts`, spec WI-28).
 *
 * Wraps the project-scoped `crm-shifts` mount. Display-readiness rule:
 * department FKs resolve to labels server-side (the departments
 * catalog lives on the legacy `/v1/crm/departments` mount per the
 * people-suite spec §4.2) — raw ObjectIds never reach the client as
 * the only representation of a department.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the invoices flagship; failures normalise into `{ ok:false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleShiftsApi,
  type CrmShiftDoc,
  type CrmShiftStatus,
} from '@/lib/rust-client/sabcrm-people-shifts';
import { crmDepartmentsApi } from '@/lib/rust-client/crm-departments';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmShiftEntityOption,
  SabcrmShiftInput,
  SabcrmShiftKpis,
  SabcrmShiftListFilters,
  SabcrmShiftListPage,
  SabcrmShiftRow,
} from './sabcrm-people-shifts.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const SHIFTS_PATH = '/sabcrm/people/shifts';

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

/* ─── Department label resolution ─────────────────────────────── */

/** Bounded batch resolve: department ids → labels (cache-per-call). */
async function resolveDepartmentLabels(
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const dept = await crmDepartmentsApi.getById(id);
        if (dept?.name) map.set(id, dept.name);
      } catch {
        // unresolved → UI renders a muted fallback
      }
    }),
  );
  return map;
}

function toRow(
  doc: CrmShiftDoc,
  deptMap: Map<string, string>,
): SabcrmShiftRow {
  return {
    id: doc._id,
    name: doc.name,
    code: doc.code ?? null,
    startTime: doc.startTime,
    endTime: doc.endTime,
    breakMinutes: doc.breakMinutes ?? null,
    graceMinutes: doc.graceMinutes ?? null,
    isNightShift: Boolean(doc.isNightShift),
    workingDays: doc.workingDays ?? [],
    color: doc.color ?? null,
    description: doc.description ?? null,
    isDefault: Boolean(doc.isDefault),
    departments: (doc.departmentIds ?? []).map((id) => ({
      id,
      label: deptMap.get(id) ?? null,
    })),
    isActive: doc.isActive !== false,
    status: doc.status,
    createdAt: doc.createdAt ?? null,
  };
}

function toCreatePayload(input: SabcrmShiftInput) {
  return {
    name: input.name.trim(),
    code: input.code?.trim() || undefined,
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    graceMinutes: input.graceMinutes,
    isNightShift: input.isNightShift,
    workingDays: input.workingDays,
    color: input.color || undefined,
    description: input.description?.trim() || undefined,
    isDefault: input.isDefault,
    departmentIds: input.departmentIds,
    isActive: input.isActive,
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ═══ CRUD ═══════════════════════════════════════════════════════ */

export async function listSabcrmShiftsPage(
  filters: SabcrmShiftListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmPeopleShiftsApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: (filters.status || undefined) as CrmShiftStatus | undefined,
      departmentId: filters.departmentId || undefined,
    });
    const deptMap = await resolveDepartmentLabels(
      res.items.flatMap((s) => s.departmentIds ?? []),
    );
    return {
      ok: true,
      data: {
        rows: res.items.map((d) => toRow(d, deptMap)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list shifts.');
  }
}

export async function getSabcrmShift(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftRow>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmPeopleShiftsApi.getById(g.ctx.projectId, id);
    const deptMap = await resolveDepartmentLabels(doc.departmentIds ?? []);
    return { ok: true, data: toRow(doc, deptMap) };
  } catch (e) {
    return fail(e, 'Failed to load the shift.');
  }
}

export async function createSabcrmShift(
  input: SabcrmShiftInput,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftRow>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) {
    return { ok: false, error: 'Start and end times must be HH:MM (24h).' };
  }

  try {
    const res = await sabcrmPeopleShiftsApi.create(
      g.ctx.projectId,
      toCreatePayload(input),
    );
    const deptMap = await resolveDepartmentLabels(
      res.entity.departmentIds ?? [],
    );
    revalidatePath(SHIFTS_PATH);
    return { ok: true, data: toRow(res.entity, deptMap) };
  } catch (e) {
    return fail(e, 'Failed to create the shift.');
  }
}

export async function updateSabcrmShift(
  id: string,
  input: SabcrmShiftInput,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftRow>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) {
    return { ok: false, error: 'Start and end times must be HH:MM (24h).' };
  }

  try {
    const doc = await sabcrmPeopleShiftsApi.update(g.ctx.projectId, id, {
      ...toCreatePayload(input),
      status: input.status,
    });
    const deptMap = await resolveDepartmentLabels(doc.departmentIds ?? []);
    revalidatePath(SHIFTS_PATH);
    return { ok: true, data: toRow(doc, deptMap) };
  } catch (e) {
    return fail(e, 'Failed to update the shift.');
  }
}

/** Status-only transition (archive / restore / bulk actions). */
export async function setSabcrmShiftStatus(
  id: string,
  status: CrmShiftStatus,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleShiftsApi.update(g.ctx.projectId, id, { status });
    revalidatePath(SHIFTS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to change the shift status.');
  }
}

export async function deleteSabcrmShift(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleShiftsApi.delete(g.ctx.projectId, id);
    revalidatePath(SHIFTS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the shift.');
  }
}

/* ─── Pickers ─────────────────────────────────────────────────── */

/**
 * Shift picker (binding name per spec §4.2) — used by the rotations
 * pattern editor and the shift-change request form. Label =
 * `name (start–end)`, meta = code · night badge.
 */
export async function searchSabcrmShifts(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmPeopleShiftsApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: 20,
      status: 'active',
    });
    return {
      ok: true,
      data: res.items.map((s) => ({
        id: s._id,
        label: `${s.name} (${s.startTime}–${s.endTime})`,
        meta:
          [s.code, s.isNightShift ? 'Night shift' : null]
            .filter(Boolean)
            .join(' · ') || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search shifts.');
  }
}

/** Department picker over the legacy departments catalog (§4.2). */
export async function searchSabcrmShiftDepartments(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const depts = await crmDepartmentsApi.list({
      q: q.trim() || undefined,
      limit: 20,
    });
    return {
      ok: true,
      data: depts.map((d) => ({
        id: d._id,
        label: d.name,
        meta: d.code || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search departments.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export async function getSabcrmShiftKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmShiftKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmPeopleShiftsApi.list(g.ctx.projectId, {
      limit: 100,
    });
    const items = res.items;
    return {
      ok: true,
      data: {
        total: items.length,
        active: items.filter((s) => s.status === 'active').length,
        nightShifts: items.filter((s) => s.isNightShift).length,
        defaultShiftName: items.find((s) => s.isDefault)?.name ?? null,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load shift KPIs.');
  }
}
