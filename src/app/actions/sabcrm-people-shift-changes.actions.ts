'use server';

/**
 * SabCRM People — Shift Change Requests surface server actions
 * (`/sabcrm/people/shift-changes`, spec WI-30).
 *
 * Wraps the project-scoped `crm-shift-change-requests` mount (the
 * crate's FIRST live consumer — it was dead code until P7). The engine
 * wire is snake_case; these actions translate to camelCase view types.
 *
 * Approval flow: a PATCH carrying `status` (`approved` / `rejected`) +
 * `approver_id` (the caller) + `response_notes`; the engine stamps
 * `approved_at` server-side on terminal transitions.
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
  sabcrmPeopleShiftChangesApi,
  type CrmShiftChangeRequestDoc,
  type CrmShiftChangeStatus,
} from '@/lib/rust-client/sabcrm-people-shift-changes';
import { sabcrmPeopleShiftsApi } from '@/lib/rust-client/sabcrm-people-shifts';
import {
  employeeLabel,
  employeeMeta,
  resolveEmployeeLabels,
  sabcrmPeopleHrPickersApi,
} from '@/lib/rust-client/sabcrm-people-hr-pickers';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmShiftChangeDecision,
  SabcrmShiftChangeEntityOption,
  SabcrmShiftChangeInput,
  SabcrmShiftChangeKpis,
  SabcrmShiftChangeListFilters,
  SabcrmShiftChangeListPage,
  SabcrmShiftChangePatch,
  SabcrmShiftChangeRow,
} from './sabcrm-people-shift-changes.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const SHIFT_CHANGES_PATH = '/sabcrm/people/shift-changes';

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

/* ─── Row mapping (snake wire → camel view) ───────────────────── */

function toRow(
  doc: CrmShiftChangeRequestDoc,
  employeeMap: Map<string, string>,
): SabcrmShiftChangeRow {
  return {
    id: doc._id,
    employeeId: doc.employee_id,
    employeeName:
      doc.employee_name ?? employeeMap.get(doc.employee_id) ?? null,
    currentShiftId: doc.current_shift_id,
    currentShiftName: doc.current_shift_name ?? null,
    requestedShiftId: doc.requested_shift_id,
    requestedShiftName: doc.requested_shift_name ?? null,
    effectiveDate: doc.effective_date,
    reason: doc.reason ?? null,
    status: doc.status,
    approverId: doc.approver_id ?? null,
    approverLabel: doc.approver_id
      ? (employeeMap.get(doc.approver_id) ?? null)
      : null,
    approvedAt: doc.approved_at ?? null,
    responseNotes: doc.response_notes ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

/** Resolve labels only for docs missing the write-time caches. */
async function resolveRowLabels(
  projectId: string,
  docs: readonly CrmShiftChangeRequestDoc[],
): Promise<Map<string, string>> {
  const ids = docs.flatMap((d) => [
    ...(d.employee_name ? [] : [d.employee_id]),
    ...(d.approver_id ? [d.approver_id] : []),
  ]);
  return resolveEmployeeLabels(projectId, ids);
}

/* ═══ CRUD + approval ════════════════════════════════════════════ */

export async function listSabcrmShiftChangesPage(
  filters: SabcrmShiftChangeListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmPeopleShiftChangesApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: (filters.status || undefined) as
        | CrmShiftChangeStatus
        | undefined,
      employee_id: filters.employeeId || undefined,
    });

    // In-page date-range refinement (inclusive bounds on effective_date).
    let pageDocs = res.items;
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      pageDocs = pageDocs.filter((d) => {
        const day = (d.effective_date ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }

    const employeeMap = await resolveRowLabels(g.ctx.projectId, pageDocs);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toRow(d, employeeMap)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list shift change requests.');
  }
}

export async function getSabcrmShiftChange(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeRow>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmPeopleShiftChangesApi.getById(g.ctx.projectId, id);
    const employeeMap = await resolveRowLabels(g.ctx.projectId, [doc]);
    return { ok: true, data: toRow(doc, employeeMap) };
  } catch (e) {
    return fail(e, 'Failed to load the shift change request.');
  }
}

export async function createSabcrmShiftChange(
  input: SabcrmShiftChangeInput,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeRow>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  if (!input.employeeId) return { ok: false, error: 'Pick an employee.' };
  if (!input.currentShiftId || !input.requestedShiftId) {
    return { ok: false, error: 'Pick both the current and requested shifts.' };
  }
  if (input.currentShiftId === input.requestedShiftId) {
    return { ok: false, error: 'The requested shift must differ from the current shift.' };
  }
  const effectiveIso = toIso(input.effectiveDate);
  if (!effectiveIso) return { ok: false, error: 'A valid effective date is required.' };

  try {
    const res = await sabcrmPeopleShiftChangesApi.create(g.ctx.projectId, {
      employee_id: input.employeeId,
      employee_name: input.employeeName,
      current_shift_id: input.currentShiftId,
      current_shift_name: input.currentShiftName,
      requested_shift_id: input.requestedShiftId,
      requested_shift_name: input.requestedShiftName,
      effective_date: effectiveIso,
      reason: input.reason?.trim() || undefined,
    });
    revalidatePath(SHIFT_CHANGES_PATH);
    const employeeMap = await resolveRowLabels(g.ctx.projectId, [res.entity]);
    return { ok: true, data: toRow(res.entity, employeeMap) };
  } catch (e) {
    return fail(e, 'Failed to create the shift change request.');
  }
}

export async function updateSabcrmShiftChange(
  id: string,
  patch: SabcrmShiftChangePatch,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const body: Record<string, unknown> = {};
  if (patch.employeeId) {
    body.employee_id = patch.employeeId;
    body.employee_name = patch.employeeName;
  }
  if (patch.currentShiftId) {
    body.current_shift_id = patch.currentShiftId;
    body.current_shift_name = patch.currentShiftName;
  }
  if (patch.requestedShiftId) {
    body.requested_shift_id = patch.requestedShiftId;
    body.requested_shift_name = patch.requestedShiftName;
  }
  if (patch.effectiveDate) {
    const iso = toIso(patch.effectiveDate);
    if (!iso) return { ok: false, error: 'Invalid effective date.' };
    body.effective_date = iso;
  }
  if (patch.reason !== undefined) body.reason = patch.reason;
  if (Object.keys(body).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    await sabcrmPeopleShiftChangesApi.update(
      g.ctx.projectId,
      id,
      body as never,
    );
    revalidatePath(SHIFT_CHANGES_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to update the shift change request.');
  }
}

/**
 * Approve / reject a request (binding name per spec §4.2). PATCHes
 * `status` + `approver_id` (the caller) + `response_notes`; the engine
 * stamps `approved_at` on terminal transitions.
 */
export async function approveSabcrmShiftChange(
  id: string,
  decision: SabcrmShiftChangeDecision,
  responseNotes?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeRow>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmPeopleShiftChangesApi.getById(
      g.ctx.projectId,
      id,
    );
    if (current.status !== 'pending') {
      return {
        ok: false,
        error: `This request is already ${current.status} and cannot be decided again.`,
      };
    }
    const doc = await sabcrmPeopleShiftChangesApi.update(g.ctx.projectId, id, {
      status: decision,
      approver_id: g.ctx.userId,
      response_notes: responseNotes?.trim() || undefined,
    });
    revalidatePath(SHIFT_CHANGES_PATH);
    const employeeMap = await resolveRowLabels(g.ctx.projectId, [doc]);
    return { ok: true, data: toRow(doc, employeeMap) };
  } catch (e) {
    return fail(e, 'Failed to decide the shift change request.');
  }
}

/** Applicant withdrawal — flips a pending request to `cancelled`. */
export async function cancelSabcrmShiftChange(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleShiftChangesApi.update(g.ctx.projectId, id, {
      status: 'cancelled',
    });
    revalidatePath(SHIFT_CHANGES_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to cancel the shift change request.');
  }
}

export async function deleteSabcrmShiftChange(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleShiftChangesApi.delete(g.ctx.projectId, id);
    revalidatePath(SHIFT_CHANGES_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the shift change request.');
  }
}

/* ─── Pickers (scoped to this surface) ────────────────────────── */

export async function searchSabcrmShiftChangeEmployees(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeEntityOption[]>> {
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

export async function searchSabcrmShiftChangeShifts(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeEntityOption[]>> {
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

export async function getSabcrmShiftChangeKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmShiftChangeKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmPeopleShiftChangesApi.list(g.ctx.projectId, {
      limit: 100,
    });
    const monthKey = new Date().toISOString().slice(0, 7);
    const items = res.items;
    return {
      ok: true,
      data: {
        pending: items.filter((r) => r.status === 'pending').length,
        approvedThisMonth: items.filter(
          (r) =>
            r.status === 'approved' &&
            (r.approved_at ?? '').slice(0, 7) === monthKey,
        ).length,
        rejected: items.filter((r) => r.status === 'rejected').length,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load shift change KPIs.');
  }
}
