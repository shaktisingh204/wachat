'use server';

/**
 * SabCRM People — Shift Rotations surface server actions
 * (`/sabcrm/people/shift-rotations`, spec WI-29).
 *
 * Wraps the project-scoped `crm-shift-rotations` mount. Display
 * readiness: the rotation target (employee | department | team)
 * resolves to a label server-side; pattern days carry the cached
 * `shiftName` (stamped at save time from the picker) with a roster
 * fallback resolution for legacy rows.
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
  sabcrmPeopleShiftRotationsApi,
  type CrmShiftRotationDoc,
  type CrmShiftRotationStatus,
} from '@/lib/rust-client/sabcrm-people-shift-rotations';
import { sabcrmPeopleShiftsApi } from '@/lib/rust-client/sabcrm-people-shifts';
import {
  employeeLabel,
  employeeMeta,
  resolveEmployeeLabels,
  sabcrmPeopleHrPickersApi,
} from '@/lib/rust-client/sabcrm-people-hr-pickers';
import { crmDepartmentsApi } from '@/lib/rust-client/crm-departments';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmRotationEntityOption,
  SabcrmRotationInput,
  SabcrmRotationKpis,
  SabcrmRotationListFilters,
  SabcrmRotationListPage,
  SabcrmRotationRow,
  SabcrmRotationTargetKind,
} from './sabcrm-people-shift-rotations.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const ROTATIONS_PATH = '/sabcrm/people/shift-rotations';

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

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Target + row mapping ────────────────────────────────────── */

function targetOf(
  doc: CrmShiftRotationDoc,
): { kind: SabcrmRotationTargetKind; id: string } | null {
  if (doc.employeeId) return { kind: 'employee', id: doc.employeeId };
  if (doc.departmentId) return { kind: 'department', id: doc.departmentId };
  if (doc.teamId) return { kind: 'team', id: doc.teamId };
  return null;
}

interface LabelMaps {
  employees: Map<string, string>;
  departments: Map<string, string>;
}

async function resolveLabelMaps(
  projectId: string,
  docs: readonly CrmShiftRotationDoc[],
): Promise<LabelMaps> {
  const employeeIds = docs
    .map((d) => d.employeeId ?? '')
    .filter(Boolean);
  const departmentIds = [
    ...new Set(docs.map((d) => d.departmentId ?? '').filter(Boolean)),
  ].slice(0, 50);

  const departments = new Map<string, string>();
  const [employees] = await Promise.all([
    resolveEmployeeLabels(projectId, employeeIds),
    Promise.all(
      departmentIds.map(async (id) => {
        try {
          const dept = await crmDepartmentsApi.getById(id);
          if (dept?.name) departments.set(id, dept.name);
        } catch {
          // unresolved → muted fallback
        }
      }),
    ),
  ]);
  return { employees, departments };
}

function toRow(doc: CrmShiftRotationDoc, maps: LabelMaps): SabcrmRotationRow {
  const target = targetOf(doc);
  const targetLabel = target
    ? target.kind === 'employee'
      ? (maps.employees.get(target.id) ?? null)
      : target.kind === 'department'
        ? (maps.departments.get(target.id) ?? null)
        : null // teams have no picker source yet (see surface gaps)
    : null;
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description ?? null,
    targetKind: target?.kind ?? null,
    targetId: target?.id ?? null,
    targetLabel,
    cycleDays: doc.cycleDays,
    startDate: doc.startDate,
    endDate: doc.endDate ?? null,
    pattern: (doc.pattern ?? []).map((p) => ({
      dayOffset: p.dayOffset,
      shiftId: p.shiftId,
      shiftName: p.shiftName ?? null,
      isOff: Boolean(p.isOff),
    })),
    isActive: doc.isActive !== false,
    status: doc.status,
    createdAt: doc.createdAt ?? null,
  };
}

/** Validate + normalise the full form payload. */
function validateInput(input: SabcrmRotationInput): string | null {
  if (!input.name.trim()) return 'Name is required.';
  if (!Number.isFinite(input.cycleDays) || input.cycleDays < 1) {
    return 'Cycle length must be at least 1 day.';
  }
  const targets = [input.employeeId, input.departmentId, input.teamId].filter(
    Boolean,
  );
  if (targets.length !== 1) {
    return 'Pick exactly one target (an employee or a department).';
  }
  if (!toIso(input.startDate)) return 'A valid start date is required.';
  if (input.endDate && !toIso(input.endDate)) return 'Invalid end date.';
  for (const day of input.pattern) {
    if (day.dayOffset < 0 || day.dayOffset >= input.cycleDays) {
      return `Pattern day offset ${day.dayOffset} is outside the ${input.cycleDays}-day cycle.`;
    }
    if (!day.shiftId) {
      return 'Every pattern day needs a shift (the engine stores one even on off days).';
    }
  }
  const offsets = input.pattern.map((p) => p.dayOffset);
  if (new Set(offsets).size !== offsets.length) {
    return 'Pattern day offsets must be unique.';
  }
  return null;
}

function toWirePattern(input: SabcrmRotationInput) {
  return input.pattern.map((p) => ({
    dayOffset: p.dayOffset,
    shiftId: p.shiftId,
    shiftName: p.shiftName,
    isOff: Boolean(p.isOff),
  }));
}

/* ═══ CRUD ═══════════════════════════════════════════════════════ */

export async function listSabcrmShiftRotationsPage(
  filters: SabcrmRotationListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmPeopleShiftRotationsApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: (filters.status || undefined) as
        | CrmShiftRotationStatus
        | undefined,
      employeeId: filters.employeeId || undefined,
    });
    const maps = await resolveLabelMaps(g.ctx.projectId, res.items);
    return {
      ok: true,
      data: {
        rows: res.items.map((d) => toRow(d, maps)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list shift rotations.');
  }
}

export async function getSabcrmShiftRotation(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationRow>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmPeopleShiftRotationsApi.getById(
      g.ctx.projectId,
      id,
    );
    const maps = await resolveLabelMaps(g.ctx.projectId, [doc]);
    return { ok: true, data: toRow(doc, maps) };
  } catch (e) {
    return fail(e, 'Failed to load the shift rotation.');
  }
}

export async function createSabcrmShiftRotation(
  input: SabcrmRotationInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationRow>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const invalid = validateInput(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    const res = await sabcrmPeopleShiftRotationsApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      employeeId: input.employeeId || undefined,
      departmentId: input.departmentId || undefined,
      teamId: input.teamId || undefined,
      pattern: toWirePattern(input),
      cycleDays: input.cycleDays,
      startDate: toIso(input.startDate) as string,
      endDate: input.endDate ? (toIso(input.endDate) as string) : undefined,
      isActive: input.isActive,
    });
    const maps = await resolveLabelMaps(g.ctx.projectId, [res.entity]);
    revalidatePath(ROTATIONS_PATH);
    return { ok: true, data: toRow(res.entity, maps) };
  } catch (e) {
    return fail(e, 'Failed to create the shift rotation.');
  }
}

export async function updateSabcrmShiftRotation(
  id: string,
  input: SabcrmRotationInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationRow>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const invalid = validateInput(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    const doc = await sabcrmPeopleShiftRotationsApi.update(
      g.ctx.projectId,
      id,
      {
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        employeeId: input.employeeId || undefined,
        departmentId: input.departmentId || undefined,
        teamId: input.teamId || undefined,
        pattern: toWirePattern(input),
        cycleDays: input.cycleDays,
        startDate: toIso(input.startDate) as string,
        endDate: input.endDate ? (toIso(input.endDate) as string) : undefined,
        isActive: input.isActive,
        status: input.status,
      },
    );
    const maps = await resolveLabelMaps(g.ctx.projectId, [doc]);
    revalidatePath(ROTATIONS_PATH);
    return { ok: true, data: toRow(doc, maps) };
  } catch (e) {
    return fail(e, 'Failed to update the shift rotation.');
  }
}

/** Status-only transition (pause / resume / complete / archive). */
export async function setSabcrmShiftRotationStatus(
  id: string,
  status: CrmShiftRotationStatus,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleShiftRotationsApi.update(g.ctx.projectId, id, {
      status,
      isActive: status === 'active',
    });
    revalidatePath(ROTATIONS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to change the rotation status.');
  }
}

export async function deleteSabcrmShiftRotation(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleShiftRotationsApi.delete(g.ctx.projectId, id);
    revalidatePath(ROTATIONS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the shift rotation.');
  }
}

/* ─── Pickers (scoped to this surface) ────────────────────────── */

export async function searchSabcrmRotationEmployees(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmPeopleHrPickersApi.searchEmployees(
      g.ctx.projectId,
      q.trim() || undefined,
    );
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: employeeLabel(d),
        meta: employeeMeta(d),
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search employees.');
  }
}

export async function searchSabcrmRotationDepartments(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationEntityOption[]>> {
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

/** Shift picker for the pattern editor (project-scoped shifts). */
export async function searchSabcrmRotationShifts(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRotationEntityOption[]>> {
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
        meta: s.code || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search shifts.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export async function getSabcrmShiftRotationKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmRotationKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmPeopleShiftRotationsApi.list(g.ctx.projectId, {
      limit: 100,
    });
    const items = res.items;
    return {
      ok: true,
      data: {
        total: items.length,
        active: items.filter((r) => r.status === 'active').length,
        paused: items.filter((r) => r.status === 'paused').length,
        completed: items.filter((r) => r.status === 'completed').length,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load rotation KPIs.');
  }
}
