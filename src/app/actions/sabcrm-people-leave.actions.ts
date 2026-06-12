'use server';

/**
 * SabCRM People — Leave surface server actions
 * (`/sabcrm/people/leave`, spec WI-26).
 *
 * Drives BOTH subtrees of the project-scoped `crm-leaves` mount:
 * the leave-type catalog (`/types`) and the per-employee applications
 * (`/applications`, incl. the `POST /{id}/approve` workflow action).
 *
 * Display-readiness rule: list actions resolve FK labels server-side
 * (leave types via one catalog fetch, applicants via the bounded
 * employees resolver) — raw ObjectIds never reach the client as the
 * only representation of a person.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the invoices flagship. The Rust engine may be down at dev time —
 * failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleLeaveApi,
  type CrmLeaveDoc,
  type CrmLeaveStatus,
  type SabcrmLeaveTypeDoc,
} from '@/lib/rust-client/sabcrm-people-leave';
import {
  employeeLabel,
  employeeMeta,
  resolveEmployeeLabels,
  sabcrmPeopleHrPickersApi,
} from '@/lib/rust-client/sabcrm-people-hr-pickers';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmLeaveApplicationDetail,
  SabcrmLeaveApplicationInput,
  SabcrmLeaveApplicationListPage,
  SabcrmLeaveApplicationPatch,
  SabcrmLeaveApplicationRow,
  SabcrmLeaveEntityOption,
  SabcrmLeaveKpis,
  SabcrmLeaveListFilters,
  SabcrmLeaveTypeInput,
  SabcrmLeaveTypeListPage,
  SabcrmLeaveTypeRow,
} from './sabcrm-people-leave.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const LEAVE_PATH = '/sabcrm/people/leave';

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

/* ─── Row mappers ─────────────────────────────────────────────── */

function typeLabel(t: SabcrmLeaveTypeDoc): string {
  return t.code ? `${t.code} — ${t.name}` : t.name;
}

function toTypeRow(doc: SabcrmLeaveTypeDoc): SabcrmLeaveTypeRow {
  return {
    id: doc._id,
    code: doc.code,
    name: doc.name,
    // `paid: true` is the persisted default and skip-serialized.
    paid: doc.paid !== false,
    accrualRule: doc.accrualRule ?? 'none',
    maxBalance: doc.maxBalance ?? null,
    carryForward: Boolean(doc.carryForward),
    encashable: Boolean(doc.encashable),
    genderRestricted: doc.genderRestricted ?? null,
    minServiceMonths: doc.minServiceMonths ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

function toApplicationRow(
  doc: CrmLeaveDoc,
  typeMap: Map<string, string>,
  employeeMap: Map<string, string>,
): SabcrmLeaveApplicationRow {
  const employeeId = doc.assignedTo ?? null;
  return {
    id: doc._id,
    employeeId,
    employeeLabel: employeeId ? (employeeMap.get(employeeId) ?? null) : null,
    leaveTypeId: doc.leaveTypeId,
    leaveTypeLabel: typeMap.get(doc.leaveTypeId) ?? null,
    from: doc.from,
    to: doc.to,
    days: doc.days,
    halfDay: Boolean(doc.halfDay),
    balanceSnapshot: doc.balanceSnapshot ?? null,
    reason: doc.reason ?? null,
    status: doc.status,
    attachmentCount: doc.attachments?.length ?? 0,
    createdAt: doc.createdAt ?? null,
  };
}

/** Catalog fetch → `Map<typeId, label>` (bounded: limit 100). */
async function fetchTypeLabelMap(
  projectId: string,
): Promise<Map<string, string>> {
  try {
    const types = await sabcrmPeopleLeaveApi.listTypes(projectId, {
      limit: 100,
    });
    return new Map(types.map((t) => [t._id, typeLabel(t)]));
  } catch {
    return new Map();
  }
}

/* ═══ Leave types — catalog CRUD ═════════════════════════════════ */

export async function listSabcrmLeaveTypesPage(
  filters: { page: number; q?: string; limit?: number },
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveTypeListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  try {
    const docs = await sabcrmPeopleLeaveApi.listTypes(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
    });
    return {
      ok: true,
      data: {
        rows: docs.map(toTypeRow),
        page,
        hasMore: docs.length === limit,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list leave types.');
  }
}

/** Create (no id) or update (id set) a catalog row — full field set. */
export async function saveSabcrmLeaveType(
  input: SabcrmLeaveTypeInput,
  id?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveTypeRow>> {
  const g = await gate(id ? 'edit' : 'create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  if (!input.code.trim() || !input.name.trim()) {
    return { ok: false, error: 'Code and name are required.' };
  }

  const payload = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    paid: input.paid,
    accrualRule: input.accrualRule.trim() || 'none',
    maxBalance: input.maxBalance,
    carryForward: input.carryForward,
    encashable: input.encashable,
    genderRestricted: input.genderRestricted || undefined,
    minServiceMonths: input.minServiceMonths,
  };

  try {
    const doc = id
      ? await sabcrmPeopleLeaveApi.updateType(g.ctx.projectId, id, payload)
      : await sabcrmPeopleLeaveApi.createType(g.ctx.projectId, payload);
    revalidatePath(LEAVE_PATH);
    return { ok: true, data: toTypeRow(doc) };
  } catch (e) {
    return fail(e, 'Failed to save the leave type.');
  }
}

export async function deleteSabcrmLeaveType(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleLeaveApi.deleteType(g.ctx.projectId, id);
    revalidatePath(LEAVE_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the leave type.');
  }
}

/** Picker search over the catalog (label = `code — name`). */
export async function searchSabcrmLeaveTypes(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const types = await sabcrmPeopleLeaveApi.listTypes(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: 20,
    });
    return {
      ok: true,
      data: types.map((t) => ({
        id: t._id,
        label: typeLabel(t),
        meta: t.paid === false ? 'Unpaid' : 'Paid',
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search leave types.');
  }
}

/* ═══ Applications — CRUD + approve ══════════════════════════════ */

export async function listSabcrmLeaveApplicationsPage(
  filters: SabcrmLeaveListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveApplicationListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmPeopleLeaveApi.listApplications(g.ctx.projectId, {
      page,
      limit,
      employeeId: filters.employeeId || undefined,
      status: (filters.status || undefined) as CrmLeaveStatus | undefined,
    });
    const hasMore = docs.length === limit;

    // In-page refinements the engine query doesn't support:
    // date range (on the leave `from` day) + free-text q.
    let pageDocs = docs;
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      pageDocs = pageDocs.filter((d) => {
        const day = (d.from ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }

    const [typeMap, employeeMap] = await Promise.all([
      fetchTypeLabelMap(g.ctx.projectId),
      resolveEmployeeLabels(
        g.ctx.projectId,
        pageDocs.map((d) => d.assignedTo ?? '').filter(Boolean),
      ),
    ]);

    let rows = pageDocs.map((d) => toApplicationRow(d, typeMap, employeeMap));

    const needle = filters.q?.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((r) =>
        [r.employeeLabel, r.leaveTypeLabel, r.reason]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle)),
      );
    }

    return { ok: true, data: { rows, page, hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list leave applications.');
  }
}

export async function getSabcrmLeaveApplication(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveApplicationDetail>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmPeopleLeaveApi.getApplication(g.ctx.projectId, id);
    const approverIds = (doc.approverChain ?? [])
      .map((s) => s.approverId ?? '')
      .filter(Boolean);
    const [typeMap, employeeMap] = await Promise.all([
      fetchTypeLabelMap(g.ctx.projectId),
      resolveEmployeeLabels(g.ctx.projectId, [
        ...(doc.assignedTo ? [doc.assignedTo] : []),
        ...approverIds,
      ]),
    ]);
    const row = toApplicationRow(doc, typeMap, employeeMap);
    return {
      ok: true,
      data: {
        ...row,
        approverChain: (doc.approverChain ?? []).map((s) => ({
          approverId: s.approverId ?? null,
          approverLabel: s.approverId
            ? (employeeMap.get(s.approverId) ?? null)
            : null,
          status: s.status ?? 'pending',
          decidedAt: s.decidedAt ?? null,
          comment: s.comment ?? null,
        })),
        attachments: (doc.attachments ?? [])
          .filter((a) => a.fileId)
          .map((a) => ({
            fileId: String(a.fileId),
            name: a.name ?? null,
            mimeType:
              (a as { mimeType?: string }).mimeType ?? a.mime ?? null,
            size: a.size ?? null,
          })),
        updatedAt: doc.updatedAt ?? null,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the leave application.');
  }
}

export async function createSabcrmLeaveApplication(
  input: SabcrmLeaveApplicationInput,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  if (!input.leaveTypeId) {
    return { ok: false, error: 'Pick a leave type.' };
  }
  const fromIso = toIso(input.from);
  const toIso_ = toIso(input.to);
  if (!fromIso || !toIso_) {
    return { ok: false, error: 'Both dates are required.' };
  }
  if (toIso_ < fromIso) {
    return { ok: false, error: 'The end date must be on or after the start date.' };
  }

  try {
    const doc = await sabcrmPeopleLeaveApi.createApplication(g.ctx.projectId, {
      leaveTypeId: input.leaveTypeId,
      from: fromIso,
      to: toIso_,
      halfDay: input.halfDay,
      reason: input.reason?.trim() || undefined,
      employeeId: input.employeeId || undefined,
      attachments: input.attachments?.length
        ? input.attachments.map((a) => ({
            fileId: a.fileId,
            name: a.name,
            // wire key per crm_core::Attachment (camelCase)
            mimeType: a.mimeType,
            size: a.size,
          }) as never)
        : undefined,
    });
    revalidatePath(LEAVE_PATH);
    return { ok: true, data: { id: doc._id } };
  } catch (e) {
    return fail(e, 'Failed to create the leave application.');
  }
}

export async function updateSabcrmLeaveApplication(
  id: string,
  patch: SabcrmLeaveApplicationPatch,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const body: Record<string, unknown> = {};
  if (patch.leaveTypeId) body.leaveTypeId = patch.leaveTypeId;
  if (patch.from) {
    const iso = toIso(patch.from);
    if (!iso) return { ok: false, error: 'Invalid start date.' };
    body.from = iso;
  }
  if (patch.to) {
    const iso = toIso(patch.to);
    if (!iso) return { ok: false, error: 'Invalid end date.' };
    body.to = iso;
  }
  if (patch.halfDay !== undefined) body.halfDay = patch.halfDay;
  if (patch.reason !== undefined) body.reason = patch.reason;
  if (patch.attachments !== undefined) {
    body.attachments = patch.attachments.map((a) => ({
      fileId: a.fileId,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    }));
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    await sabcrmPeopleLeaveApi.updateApplication(
      g.ctx.projectId,
      id,
      body as never,
    );
    revalidatePath(LEAVE_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to update the leave application.');
  }
}

/**
 * Approve a PENDING application (the caller becomes the approver; the
 * engine appends an `ApproverStep` and flips the status atomically).
 * Already-decided applications surface the engine's 409 message.
 *
 * NB: the project mount exposes APPROVE only — there is no
 * reject/cancel endpoint on `crm-leaves` today (and `status` is
 * deliberately not PATCHable). Reject ships when the engine grows the
 * endpoint; the UI explains this instead of faking a transition.
 */
export async function approveSabcrmLeaveApplication(
  id: string,
  comment?: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleLeaveApi.approveApplication(
      g.ctx.projectId,
      id,
      comment,
    );
    revalidatePath(LEAVE_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to approve the leave application.');
  }
}

export async function deleteSabcrmLeaveApplication(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await sabcrmPeopleLeaveApi.deleteApplication(g.ctx.projectId, id);
    revalidatePath(LEAVE_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the leave application.');
  }
}

/* ─── Employee picker (scoped to this surface) ────────────────── */

/** Applicant/approver picker over the project roster. */
export async function searchSabcrmLeaveEmployees(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveEntityOption[]>> {
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

/* ─── KPIs ────────────────────────────────────────────────────── */

export async function getSabcrmLeaveKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmLeaveKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const [apps, types] = await Promise.all([
      sabcrmPeopleLeaveApi.listApplications(g.ctx.projectId, { limit: 100 }),
      sabcrmPeopleLeaveApi.listTypes(g.ctx.projectId, { limit: 100 }),
    ]);

    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    const todayKey = now.toISOString().slice(0, 10);

    let pendingCount = 0;
    let approvedThisMonth = 0;
    let onLeaveToday = 0;
    for (const a of apps) {
      if (a.status === 'pending') pendingCount += 1;
      if (
        a.status === 'approved' &&
        (a.updatedAt ?? a.createdAt ?? '').slice(0, 7) === monthKey
      ) {
        approvedThisMonth += 1;
      }
      if (
        a.status === 'approved' &&
        (a.from ?? '').slice(0, 10) <= todayKey &&
        (a.to ?? '').slice(0, 10) >= todayKey
      ) {
        onLeaveToday += 1;
      }
    }

    return {
      ok: true,
      data: {
        pendingCount,
        approvedThisMonth,
        onLeaveToday,
        typeCount: types.length,
        sampled: apps.length === 100,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load leave KPIs.');
  }
}
