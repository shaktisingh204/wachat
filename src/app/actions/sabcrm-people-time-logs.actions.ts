'use server';

/**
 * SabCRM People — Time Logs server actions (people-suite WI-34).
 *
 * Drives the `/sabcrm/people/time-logs` timesheet surface over the
 * project-scoped `crm-time-logs` mount, honouring the WI-13 tenant-key
 * exception: the SabCRM tenant scope travels as `tenantProjectId`
 * (handled by the rust client) because `projectId` on this entity is
 * the WORK-project FK.
 *
 *   - display-ready list rows (employee + work-item labels resolved
 *     server-side — raw ObjectIds never reach the client) + capped CSV;
 *   - timesheet KPIs (tracked / billable minutes, billable amount,
 *     running timers, pending approvals);
 *   - full-DTO create/update (`saveSabcrmTimeLog`) + delete;
 *   - timer verbs: `startSabcrmTimer` (creates a `running` log stamped
 *     now) and `stopSabcrmTimer` (stamps `endedAt` + computed
 *     `durationMinutes`, flips → `stopped`);
 *   - approval verbs: `approveSabcrmTimeLogs` / `rejectSabcrmTimeLogs`
 *     (bulk PATCH `status` + `approvedBy`/`approvedAt`, signed as the
 *     gated session user);
 *   - pickers: employees (people mount) and work items (records engine
 *     over the `projects` / `tasks` / `issues` / `tickets` objects).
 *
 * Wire traps handled here:
 *   - the engine list supports `q`/`status`/`projectId`/`taskId`/
 *     `entityKind` only — the employee filter and the date range are
 *     applied as page post-filters (documented coverage gap);
 *   - docs are deflated from MongoDB extended JSON before use.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the finance invoices actions (verbatim recipe). Engine failures
 * normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeopleTimeLogsApi,
  type CrmTimeLogCreateInput,
  type CrmTimeLogDoc,
  type CrmTimeLogEntityKind,
  type CrmTimeLogStatus,
  type CrmTimeLogUpdateInput,
} from '@/lib/rust-client/sabcrm-people-time-logs';
import {
  sabcrmPeoplePayrollEmployeesApi,
  type CrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-payroll-runs';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  formatDurationMinutes,
  type SabcrmStartTimerInput,
  type SabcrmTimeLogInput,
  type SabcrmTimeLogKpis,
  type SabcrmTimeLogListFilters,
  type SabcrmTimeLogListPage,
  type SabcrmTimeLogListRow,
  type SabcrmTimeLogView,
} from './sabcrm-people-time-logs.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const TIME_LOGS_PATH = '/sabcrm/people/time-logs';
const CURRENCY = 'INR';
const PAGE_SIZE = 20;

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

/** Coerce a `datetime-local` / ISO string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Label resolution ───────────────────────────────────────────── */

function employeeDisplayLabel(e: CrmEmployeeDoc): string {
  const display = e.displayName?.trim();
  if (display) return display;
  const full = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  return full || e.employeeId || 'Employee';
}

async function employeeLabelMap(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const want = new Set(ids.filter(Boolean));
  if (want.size === 0) return map;
  try {
    for (let page = 1; page <= 3; page++) {
      const docs = deflateDocs<CrmEmployeeDoc>(
        await sabcrmPeoplePayrollEmployeesApi.list(projectId, {
          page,
          limit: 100,
        }),
      );
      for (const e of docs) {
        if (want.has(e._id)) map.set(e._id, employeeDisplayLabel(e));
      }
      if (docs.length < 100 || map.size >= want.size) break;
    }
  } catch {
    // Engine hiccup — rows render the muted fallback.
  }
  return map;
}

/** Work-item kind → records-engine object slug. */
const WORK_ITEM_SLUGS: Record<string, string> = {
  project: 'projects',
  task: 'tasks',
  project_task: 'tasks',
  issue: 'issues',
  ticket: 'tickets',
};

const WORK_ITEM_KIND_LABELS: Record<string, string> = {
  project: 'Project',
  task: 'Task',
  project_task: 'Project task',
  issue: 'Issue',
  ticket: 'Ticket',
};

/** The single work-item ref a log points at (slug + id + kind label). */
function workItemRef(
  doc: CrmTimeLogDoc,
): { slug: string; id: string; kindLabel: string } | null {
  if (doc.taskId) return { slug: 'tasks', id: doc.taskId, kindLabel: 'Task' };
  if (doc.issueId) {
    return { slug: 'issues', id: doc.issueId, kindLabel: 'Issue' };
  }
  if (doc.entityId && doc.entityKind) {
    return {
      slug: WORK_ITEM_SLUGS[doc.entityKind] ?? 'tasks',
      id: doc.entityId,
      kindLabel: WORK_ITEM_KIND_LABELS[doc.entityKind] ?? 'Work item',
    };
  }
  if (doc.projectId) {
    return { slug: 'projects', id: doc.projectId, kindLabel: 'Project' };
  }
  return null;
}

/**
 * Batch work-item label resolution over the records engine. Each
 * (slug, id) pair resolves with ONE `get`; unresolvable ids fall back
 * to the kind label so a raw ObjectId never reaches the client.
 */
async function workItemLabelMap(
  projectId: string,
  refs: { slug: string; id: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = new Map<string, { slug: string; id: string }>();
  for (const ref of refs) {
    if (ref.id && !unique.has(`${ref.slug}:${ref.id}`)) {
      unique.set(`${ref.slug}:${ref.id}`, ref);
    }
  }
  const bounded = [...unique.values()].slice(0, 30);
  if (bounded.length === 0) return map;
  try {
    const objects = await sabcrmObjectsApi.list(projectId);
    await Promise.all(
      bounded.map(async ({ slug, id }) => {
        const object = objects.find((o) => o.slug === slug);
        if (!object) return;
        try {
          const record = await sabcrmRecordsApi.get(slug, id, projectId);
          map.set(id, sabcrmRecordLabel(object, record));
        } catch {
          // Gone / foreign scope — the kind label fallback applies.
        }
      }),
    );
  } catch {
    // Objects listing failed — every row keeps its kind fallback.
  }
  return map;
}

/* ─── Row mapping ────────────────────────────────────────────────── */

function rowAmount(doc: CrmTimeLogDoc): number {
  if (!doc.isBillable || !doc.hourlyRate) return 0;
  const minutes = doc.durationMinutes ?? 0;
  return Math.round((minutes / 60) * doc.hourlyRate * 100) / 100;
}

function toRow(
  doc: CrmTimeLogDoc,
  employeeLabels: Map<string, string>,
  workLabels: Map<string, string>,
): SabcrmTimeLogListRow {
  const ref = workItemRef(doc);
  return {
    id: doc._id,
    employeeLabel: doc.userLogId
      ? (employeeLabels.get(doc.userLogId) ?? null)
      : null,
    workItemLabel: ref ? (workLabels.get(ref.id) ?? ref.kindLabel) : null,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt ?? null,
    durationMinutes: doc.durationMinutes ?? 0,
    durationLabel: formatDurationMinutes(doc.durationMinutes ?? 0),
    isBillable: Boolean(doc.isBillable),
    hourlyRate: doc.hourlyRate ?? null,
    amount: rowAmount(doc),
    status: doc.status ?? 'stopped',
    description: doc.description?.trim() || null,
    currency: CURRENCY,
  };
}

/** Page post-filters for engine-unsupported employee + date range. */
function applyClientFilters(
  docs: CrmTimeLogDoc[],
  filters: SabcrmTimeLogListFilters & { employeeId?: string },
): CrmTimeLogDoc[] {
  let out = docs;
  if (filters.employeeId) {
    out = out.filter((d) => d.userLogId === filters.employeeId);
  }
  if (filters.from) {
    const from = new Date(filters.from).getTime();
    if (Number.isFinite(from)) {
      out = out.filter((d) => new Date(d.startedAt).getTime() >= from);
    }
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime() + 24 * 3600 * 1000 - 1;
    if (Number.isFinite(to)) {
      out = out.filter((d) => new Date(d.startedAt).getTime() <= to);
    }
  }
  return out;
}

async function rowsFromDocs(
  projectId: string,
  docs: CrmTimeLogDoc[],
): Promise<SabcrmTimeLogListRow[]> {
  const [employeeLabels, workLabels] = await Promise.all([
    employeeLabelMap(
      projectId,
      docs.map((d) => d.userLogId ?? '').filter(Boolean),
    ),
    workItemLabelMap(
      projectId,
      docs
        .map(workItemRef)
        .filter((r): r is NonNullable<ReturnType<typeof workItemRef>> => !!r),
    ),
  ]);
  return docs.map((d) => toRow(d, employeeLabels, workLabels));
}

/* ─── List + export + KPIs ───────────────────────────────────────── */

export async function listSabcrmTimeLogsPage(
  filters: SabcrmTimeLogListFilters & { employeeId?: string },
  projectId?: string,
): Promise<ActionResult<SabcrmTimeLogListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPeopleTimeLogsApi.list(g.ctx.projectId, {
      page: Math.max(1, filters.page),
      limit: PAGE_SIZE,
      q: filters.q?.trim() || undefined,
      status: (filters.status || undefined) as CrmTimeLogStatus | undefined,
    });
    const docs = applyClientFilters(
      deflateDocs<CrmTimeLogDoc>(res.items),
      filters,
    );
    return {
      ok: true,
      data: {
        rows: await rowsFromDocs(g.ctx.projectId, docs),
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load time logs.');
  }
}

/** Capped fetch-all for the CSV export (≤ 5 pages of 100). */
export async function exportSabcrmTimeLogRows(
  filters: SabcrmTimeLogListFilters & { employeeId?: string },
  projectId?: string,
): Promise<ActionResult<SabcrmTimeLogListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const all: CrmTimeLogDoc[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await sabcrmPeopleTimeLogsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q?.trim() || undefined,
        status: (filters.status || undefined) as CrmTimeLogStatus | undefined,
      });
      all.push(...deflateDocs<CrmTimeLogDoc>(res.items));
      if (!res.hasMore) break;
    }
    const docs = applyClientFilters(all, filters);
    return { ok: true, data: await rowsFromDocs(g.ctx.projectId, docs) };
  } catch (e) {
    return fail(e, 'Failed to export time logs.');
  }
}

export async function getSabcrmTimeLogKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmTimeLogKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPeopleTimeLogsApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    const docs = deflateDocs<CrmTimeLogDoc>(res.items);

    let totalMinutes = 0;
    let billableMinutes = 0;
    let billableAmount = 0;
    let runningCount = 0;
    let pendingApprovalCount = 0;
    for (const doc of docs) {
      const minutes = doc.durationMinutes ?? 0;
      totalMinutes += minutes;
      if (doc.isBillable) {
        billableMinutes += minutes;
        billableAmount += rowAmount(doc);
      }
      if (doc.status === 'running') runningCount += 1;
      if (doc.status === 'stopped') pendingApprovalCount += 1;
    }
    return {
      ok: true,
      data: {
        totalMinutes,
        billableMinutes,
        billableAmount: Math.round(billableAmount * 100) / 100,
        runningCount,
        pendingApprovalCount,
        currency: CURRENCY,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load timesheet KPIs.');
  }
}

/* ─── Pickers ────────────────────────────────────────────────────── */

export async function searchSabcrmTimeLogEmployees(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = deflateDocs<CrmEmployeeDoc>(
      await sabcrmPeoplePayrollEmployeesApi.list(g.ctx.projectId, {
        q: q.trim() || undefined,
        limit: 12,
      }),
    );
    return {
      ok: true,
      data: docs.map((e) => ({
        id: e._id,
        label: employeeDisplayLabel(e),
        meta:
          [e.employeeId, e.workEmail].filter(Boolean).join(' · ') || undefined,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search employees.');
  }
}

/**
 * Work-item picker over the records engine. `kind` selects the object:
 * `project` → projects, `task`/`project_task` → tasks, `issue` →
 * issues, `ticket` → tickets. A missing object resolves to an empty
 * list (the picker shows "No matches").
 */
export async function searchSabcrmTimeLogWorkItems(
  kind: 'project' | CrmTimeLogEntityKind,
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const slug = WORK_ITEM_SLUGS[kind];
  if (!slug) return { ok: true, data: [] };

  try {
    const objects = await sabcrmObjectsApi.list(g.ctx.projectId);
    const object = objects.find((o) => o.slug === slug);
    if (!object) return { ok: true, data: [] };
    const page = await sabcrmRecordsApi.list(slug, {
      projectId: g.ctx.projectId,
      q: q.trim() || undefined,
      limit: 12,
    });
    return {
      ok: true,
      data: page.records.map((record) => ({
        id: record.id,
        label: sabcrmRecordLabel(object, record),
        meta: WORK_ITEM_KIND_LABELS[kind],
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search work items.');
  }
}

/* ─── Detail (edit seed) ─────────────────────────────────────────── */

export async function getSabcrmTimeLog(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmTimeLogView>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = deflateDoc<CrmTimeLogDoc>(
      await sabcrmPeopleTimeLogsApi.getById(g.ctx.projectId, id),
    );
    const refs: { slug: string; id: string }[] = [];
    if (doc.projectId) refs.push({ slug: 'projects', id: doc.projectId });
    if (doc.taskId) refs.push({ slug: 'tasks', id: doc.taskId });
    if (doc.issueId) refs.push({ slug: 'issues', id: doc.issueId });
    const [employeeLabels, workLabels] = await Promise.all([
      employeeLabelMap(g.ctx.projectId, doc.userLogId ? [doc.userLogId] : []),
      workItemLabelMap(g.ctx.projectId, refs),
    ]);
    return {
      ok: true,
      data: {
        doc,
        employeeLabel: doc.userLogId
          ? (employeeLabels.get(doc.userLogId) ?? null)
          : null,
        projectLabel: doc.projectId
          ? (workLabels.get(doc.projectId) ?? null)
          : null,
        taskLabel: doc.taskId ? (workLabels.get(doc.taskId) ?? null) : null,
        issueLabel: doc.issueId ? (workLabels.get(doc.issueId) ?? null) : null,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the time log.');
  }
}

/* ─── Save / delete (full DTO) ───────────────────────────────────── */

function validateLogInput(
  input: SabcrmTimeLogInput,
):
  | { ok: true; payload: CrmTimeLogCreateInput }
  | { ok: false; error: string } {
  const startedAt = input.startedAt ? toIso(input.startedAt) : null;
  if (!startedAt) return { ok: false, error: 'Start time is required.' };
  const endedAt = input.endedAt ? toIso(input.endedAt) : null;
  if (input.endedAt && !endedAt) {
    return { ok: false, error: 'End time is invalid.' };
  }
  if (endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
    return { ok: false, error: 'End time must be after the start time.' };
  }

  for (const [label, value] of [
    ['Employee', input.userLogId],
    ['Project', input.projectId],
    ['Task', input.taskId],
    ['Issue', input.issueId],
    ['Work item', input.entityId],
  ] as const) {
    if (value && !ObjectId.isValid(value)) {
      return {
        ok: false,
        error: `${label} is invalid — pick it from the list.`,
      };
    }
  }

  let durationMinutes = input.durationMinutes;
  if (durationMinutes != null) {
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
      return { ok: false, error: 'Duration must be ≥ 0 minutes.' };
    }
    durationMinutes = Math.round(durationMinutes);
  } else if (endedAt) {
    durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000,
      ),
    );
  }

  if (
    input.hourlyRate != null &&
    (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0)
  ) {
    return { ok: false, error: 'Hourly rate must be ≥ 0.' };
  }

  return {
    ok: true,
    payload: {
      userLogId: input.userLogId || undefined,
      projectId: input.projectId || undefined,
      taskId: input.taskId || undefined,
      issueId: input.issueId || undefined,
      entityKind: (input.entityKind || undefined) as
        | CrmTimeLogEntityKind
        | undefined,
      entityId: input.entityId || undefined,
      startedAt,
      endedAt: endedAt ?? undefined,
      durationMinutes: durationMinutes ?? 0,
      description: input.description?.trim() || undefined,
      isBillable: Boolean(input.isBillable),
      hourlyRate: input.hourlyRate ?? undefined,
      status: input.status || (endedAt ? 'stopped' : 'running'),
    },
  };
}

/** Create (`id` null) or full-field update of one time log. */
export async function saveSabcrmTimeLog(
  id: string | null,
  input: SabcrmTimeLogInput,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  const g = await gate(id ? 'edit' : 'create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const v = validateLogInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  try {
    let savedId = id;
    if (id) {
      await sabcrmPeopleTimeLogsApi.update(g.ctx.projectId, id, v.payload);
    } else {
      const res = await sabcrmPeopleTimeLogsApi.create(
        g.ctx.projectId,
        v.payload,
      );
      savedId = res.id ?? res.entity?._id;
    }
    revalidatePath(TIME_LOGS_PATH);
    if (id) revalidatePath(`${TIME_LOGS_PATH}/${id}`);
    return { ok: true, data: { id: savedId ?? '' } };
  } catch (e) {
    return fail(e, 'Failed to save the time log.');
  }
}

export async function deleteSabcrmTimeLog(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeopleTimeLogsApi.delete(g.ctx.projectId, id);
    revalidatePath(TIME_LOGS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the time log.');
  }
}

/* ─── Timer verbs ────────────────────────────────────────────────── */

export async function startSabcrmTimer(
  input: SabcrmStartTimerInput,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  for (const [label, value] of [
    ['Employee', input.userLogId],
    ['Project', input.projectId],
    ['Task', input.taskId],
  ] as const) {
    if (value && !ObjectId.isValid(value)) {
      return {
        ok: false,
        error: `${label} is invalid — pick it from the list.`,
      };
    }
  }
  if (
    input.hourlyRate != null &&
    (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0)
  ) {
    return { ok: false, error: 'Hourly rate must be ≥ 0.' };
  }

  try {
    const res = await sabcrmPeopleTimeLogsApi.create(g.ctx.projectId, {
      userLogId: input.userLogId || undefined,
      projectId: input.projectId || undefined,
      taskId: input.taskId || undefined,
      description: input.description?.trim() || undefined,
      isBillable: Boolean(input.isBillable),
      hourlyRate: input.hourlyRate ?? undefined,
      startedAt: new Date().toISOString(),
      durationMinutes: 0,
      status: 'running',
    });
    revalidatePath(TIME_LOGS_PATH);
    return { ok: true, data: { id: res.id ?? res.entity?._id ?? '' } };
  } catch (e) {
    return fail(e, 'Failed to start the timer.');
  }
}

/** Stamps `endedAt` now + the computed duration, flips → `stopped`. */
export async function stopSabcrmTimer(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ durationMinutes: number }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = deflateDoc<CrmTimeLogDoc>(
      await sabcrmPeopleTimeLogsApi.getById(g.ctx.projectId, id),
    );
    if (doc.status !== 'running') {
      return { ok: false, error: 'Only running timers can be stopped.' };
    }
    const now = new Date();
    const started = new Date(doc.startedAt).getTime();
    const durationMinutes = Number.isFinite(started)
      ? Math.max(1, Math.round((now.getTime() - started) / 60000))
      : (doc.durationMinutes ?? 0);
    await sabcrmPeopleTimeLogsApi.update(g.ctx.projectId, id, {
      endedAt: now.toISOString(),
      durationMinutes,
      status: 'stopped',
    });
    revalidatePath(TIME_LOGS_PATH);
    revalidatePath(`${TIME_LOGS_PATH}/${id}`);
    return { ok: true, data: { durationMinutes } };
  } catch (e) {
    return fail(e, 'Failed to stop the timer.');
  }
}

/* ─── Approval verbs (signed as the gated session user) ─────────── */

async function transitionLogs(
  ids: string[],
  status: 'approved' | 'rejected',
  projectId?: string,
): Promise<ActionResult<{ updated: number }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  if (unique.length === 0) {
    return { ok: false, error: 'Select at least one time log.' };
  }

  try {
    const patch: CrmTimeLogUpdateInput = {
      status,
      approvedBy: g.ctx.userId,
      approvedAt: new Date().toISOString(),
    };
    let updated = 0;
    for (const id of unique) {
      await sabcrmPeopleTimeLogsApi.update(g.ctx.projectId, id, patch);
      updated += 1;
    }
    revalidatePath(TIME_LOGS_PATH);
    return { ok: true, data: { updated } };
  } catch (e) {
    return fail(e, `Failed to ${status === 'approved' ? 'approve' : 'reject'} the time logs.`);
  }
}

export async function approveSabcrmTimeLogs(
  ids: string[],
  projectId?: string,
): Promise<ActionResult<{ updated: number }>> {
  return transitionLogs(ids, 'approved', projectId);
}

export async function rejectSabcrmTimeLogs(
  ids: string[],
  projectId?: string,
): Promise<ActionResult<{ updated: number }>> {
  return transitionLogs(ids, 'rejected', projectId);
}
