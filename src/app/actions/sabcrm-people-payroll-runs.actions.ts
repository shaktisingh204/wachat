'use server';

/**
 * SabCRM People — Payroll Runs server actions (people-suite WI-32).
 *
 * Drives the `/sabcrm/people/payroll-runs` flagship surface over the
 * project-scoped `crm-payroll-runs` mount:
 *
 *   - display-ready paged list rows (period labels, denormalized
 *     totals — never raw ObjectIds) + capped CSV export;
 *   - KPI strip (FY net total / last run net / headcount paid / next
 *     pay date);
 *   - full create/update of the curated draft fields (period, pay /
 *     lock dates, bank-file format);
 *   - the compute → approve → disburse → generate-payslips lifecycle
 *     (server re-validates every transition; the approve step signs as
 *     the gated session user);
 *   - detail context: employee rows + approval chain with labels
 *     batch-resolved server-side, plus the generated-payslips lineage.
 *
 * Wire traps handled here:
 *   - the engine list is a BARE ARRAY with 1-indexed pages and supports
 *     only a `status` filter — free-text `q` and the date range are
 *     applied as page post-filters (documented coverage gap);
 *   - the gen-1 `PayrollRun` entity serializes ObjectId/DateTime as
 *     MongoDB extended JSON — every fetched doc is deflated via
 *     `finance-extjson` before use (run money stays engine-computed,
 *     risk R8: totals are NEVER re-derived here).
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the finance invoices actions (verbatim recipe). Engine failures
 * normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeoplePayrollRunsApi,
  sabcrmPeoplePayrollEmployeesApi,
  type CrmEmployeeDoc,
  type CrmPayrollRunDoc,
  type CrmPayrollRunStatus,
  type SabcrmGeneratePayslipsResponse,
} from '@/lib/rust-client/sabcrm-people-payroll-runs';
import {
  sabcrmPeoplePayslipsApi,
  type SabcrmRichPayslipDoc,
} from '@/lib/rust-client/sabcrm-people-payslips';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmPayrollRunDetail,
  SabcrmPayrollRunFormInput,
  SabcrmPayrollRunKpis,
  SabcrmPayrollRunListFilters,
  SabcrmPayrollRunListPage,
  SabcrmPayrollRunListRow,
  SabcrmPayrollRunPayslipRef,
} from './sabcrm-people-payroll-runs.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const PAYROLL_RUNS_PATH = '/sabcrm/people/payroll-runs';
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

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Display helpers ─────────────────────────────────────────────── */

function fmtDay(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function runPeriodLabel(run: CrmPayrollRunDoc): string {
  return `${fmtDay(run.periodFrom)} – ${fmtDay(run.periodTo)}`;
}

function toListRow(run: CrmPayrollRunDoc): SabcrmPayrollRunListRow {
  return {
    id: run._id,
    periodFrom: run.periodFrom,
    periodTo: run.periodTo,
    periodLabel: runPeriodLabel(run),
    payDate: run.payDate ?? null,
    lockDate: run.lockDate ?? null,
    employeeCount: run.totals?.employeeCount ?? run.employees?.length ?? 0,
    gross: run.totals?.gross ?? 0,
    net: run.totals?.net ?? 0,
    ctc: run.totals?.ctc ?? 0,
    bankFileFormat: run.bankFileFormat ?? null,
    status: (run.status ?? 'draft') as CrmPayrollRunStatus,
    currency: CURRENCY,
  };
}

/** Page post-filter for the engine-unsupported `q` / date range. */
function applyClientFilters(
  rows: SabcrmPayrollRunListRow[],
  filters: SabcrmPayrollRunListFilters,
): SabcrmPayrollRunListRow[] {
  let out = rows;
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    out = out.filter((r) => r.periodLabel.toLowerCase().includes(q));
  }
  if (filters.from) {
    const from = new Date(filters.from).getTime();
    if (Number.isFinite(from)) {
      out = out.filter((r) => new Date(r.periodFrom).getTime() >= from);
    }
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime() + 24 * 3600 * 1000 - 1;
    if (Number.isFinite(to)) {
      out = out.filter((r) => new Date(r.periodFrom).getTime() <= to);
    }
  }
  return out;
}

/* ─── Employee label resolution (batched, never an id on screen) ── */

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
    const missing = [...want].filter((id) => !map.has(id)).slice(0, 25);
    await Promise.all(
      missing.map(async (id) => {
        try {
          const e = deflateDoc<CrmEmployeeDoc>(
            await sabcrmPeoplePayrollEmployeesApi.getById(projectId, id),
          );
          map.set(id, employeeDisplayLabel(e));
        } catch {
          // Employee gone — the view falls back to "Former employee".
        }
      }),
    );
  } catch {
    // Engine hiccup — rows render with the fallback label.
  }
  return map;
}

/* ─── Input validation ────────────────────────────────────────────── */

function validateRunInput(
  input: SabcrmPayrollRunFormInput,
):
  | {
      ok: true;
      payload: {
        periodFrom: string;
        periodTo: string;
        payDate?: string;
        lockDate?: string;
        bankFileFormat?: string;
      };
    }
  | { ok: false; error: string } {
  const periodFrom = input.periodFrom ? toIso(input.periodFrom) : null;
  const periodTo = input.periodTo ? toIso(input.periodTo) : null;
  if (!periodFrom) return { ok: false, error: 'Period start is required.' };
  if (!periodTo) return { ok: false, error: 'Period end is required.' };
  if (new Date(periodTo).getTime() < new Date(periodFrom).getTime()) {
    return { ok: false, error: 'Period end must be after the period start.' };
  }
  const payDate = input.payDate ? toIso(input.payDate) : null;
  if (input.payDate && !payDate) {
    return { ok: false, error: 'Pay date is invalid.' };
  }
  const lockDate = input.lockDate ? toIso(input.lockDate) : null;
  if (input.lockDate && !lockDate) {
    return { ok: false, error: 'Lock date is invalid.' };
  }
  return {
    ok: true,
    payload: {
      periodFrom,
      periodTo,
      payDate: payDate ?? undefined,
      lockDate: lockDate ?? undefined,
      bankFileFormat: input.bankFileFormat || undefined,
    },
  };
}

/* ─── List + export ──────────────────────────────────────────────── */

export async function listSabcrmPayrollRunsPage(
  filters: SabcrmPayrollRunListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPayrollRunListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = deflateDocs<CrmPayrollRunDoc>(
      await sabcrmPeoplePayrollRunsApi.list(g.ctx.projectId, {
        page: Math.max(1, filters.page),
        limit: PAGE_SIZE,
        status: filters.status || undefined,
      }),
    );
    const rows = applyClientFilters(docs.map(toListRow), filters);
    return {
      ok: true,
      data: { rows, hasMore: docs.length >= PAGE_SIZE },
    };
  } catch (e) {
    return fail(e, 'Failed to load payroll runs.');
  }
}

/** Capped fetch-all for the CSV export (≤ 5 pages of 100). */
export async function exportSabcrmPayrollRunRows(
  filters: SabcrmPayrollRunListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPayrollRunListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const all: CrmPayrollRunDoc[] = [];
    for (let page = 1; page <= 5; page++) {
      const docs = deflateDocs<CrmPayrollRunDoc>(
        await sabcrmPeoplePayrollRunsApi.list(g.ctx.projectId, {
          page,
          limit: 100,
          status: filters.status || undefined,
        }),
      );
      all.push(...docs);
      if (docs.length < 100) break;
    }
    return { ok: true, data: applyClientFilters(all.map(toListRow), filters) };
  } catch (e) {
    return fail(e, 'Failed to export payroll runs.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────────── */

export async function getSabcrmPayrollKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPayrollRunKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = deflateDocs<CrmPayrollRunDoc>(
      await sabcrmPeoplePayrollRunsApi.list(g.ctx.projectId, {
        page: 1,
        limit: 100,
      }),
    );

    const now = new Date();
    // Indian FY: 1 April → 31 March.
    const fyStartYear =
      now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const fyStart = Date.UTC(fyStartYear, 3, 1);

    let fyNetTotal = 0;
    let headcountPaid = 0;
    let nextPayDate: string | null = null;
    let lastRun: CrmPayrollRunDoc | null = null;
    let lastDisbursed: CrmPayrollRunDoc | null = null;

    for (const run of docs) {
      const periodTo = new Date(run.periodTo).getTime();
      const net = run.totals?.net ?? 0;
      if (Number.isFinite(periodTo) && periodTo >= fyStart) fyNetTotal += net;
      if (
        net > 0 &&
        (!lastRun ||
          new Date(run.periodTo).getTime() >
            new Date(lastRun.periodTo).getTime())
      ) {
        lastRun = run;
      }
      const status = run.status ?? 'draft';
      if (
        (status === 'disbursed' || status === 'closed') &&
        (!lastDisbursed ||
          new Date(run.periodTo).getTime() >
            new Date(lastDisbursed.periodTo).getTime())
      ) {
        lastDisbursed = run;
      }
      if (
        (status === 'draft' || status === 'processing' || status === 'approved') &&
        run.payDate &&
        new Date(run.payDate).getTime() >= now.getTime() - 24 * 3600 * 1000
      ) {
        if (
          !nextPayDate ||
          new Date(run.payDate).getTime() < new Date(nextPayDate).getTime()
        ) {
          nextPayDate = run.payDate;
        }
      }
    }
    headcountPaid = lastDisbursed?.totals?.employeeCount ?? 0;

    return {
      ok: true,
      data: {
        fyNetTotal,
        lastRunNet: lastRun?.totals?.net ?? 0,
        lastRunLabel: lastRun ? runPeriodLabel(lastRun) : null,
        headcountPaid,
        nextPayDate,
        runCount: docs.length,
        currency: CURRENCY,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load payroll KPIs.');
  }
}

/* ─── Detail ─────────────────────────────────────────────────────── */

export async function getSabcrmPayrollRun(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPayrollRunDetail>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const run = deflateDoc<CrmPayrollRunDoc>(
      await sabcrmPeoplePayrollRunsApi.getById(g.ctx.projectId, id),
    );

    const ids = [
      ...(run.employees ?? []).map((r) => r.employeeId),
      ...(run.approvals ?? []).map((a) => a.approverId),
    ];
    const labels = await employeeLabelMap(g.ctx.projectId, ids);

    let payslips: SabcrmPayrollRunPayslipRef[] = [];
    try {
      const res = await sabcrmPeoplePayslipsApi.list(g.ctx.projectId, {
        runId: id,
        limit: 100,
      });
      payslips = deflateDocs(res.items)
        .filter(
          (p): p is SabcrmRichPayslipDoc =>
            typeof (p as SabcrmRichPayslipDoc).runId === 'string',
        )
        .map((p) => ({
          id: p._id,
          employeeLabel:
            p.employeeSnapshot?.name ??
            labels.get(p.employeeId) ??
            'Employee',
          netPay: p.netPay ?? 0,
          sent: Boolean(p.sent),
        }));
    } catch {
      // Payslip rail is best-effort — the run page still renders.
    }

    return {
      ok: true,
      data: {
        run,
        employees: (run.employees ?? []).map((row) => ({
          ...row,
          employeeLabel: labels.get(row.employeeId) ?? 'Former employee',
        })),
        approvals: (run.approvals ?? []).map((step) => ({
          ...step,
          approverLabel: labels.get(step.approverId) ?? 'Approver',
        })),
        payslips,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the payroll run.');
  }
}

/* ─── Create / update / delete ───────────────────────────────────── */

export async function createSabcrmPayrollRun(
  input: SabcrmPayrollRunFormInput,
  projectId?: string,
): Promise<ActionResult<{ id: string; periodLabel: string }>> {
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const v = validateRunInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  try {
    const run = deflateDoc<CrmPayrollRunDoc>(
      await sabcrmPeoplePayrollRunsApi.create(g.ctx.projectId, v.payload),
    );
    revalidatePath(PAYROLL_RUNS_PATH);
    return {
      ok: true,
      data: { id: run._id, periodLabel: runPeriodLabel(run) },
    };
  } catch (e) {
    return fail(e, 'Failed to create the payroll run.');
  }
}

export async function updateSabcrmPayrollRun(
  id: string,
  input: SabcrmPayrollRunFormInput,
  projectId?: string,
): Promise<ActionResult<{ id: string; periodLabel: string }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const v = validateRunInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  try {
    const run = deflateDoc<CrmPayrollRunDoc>(
      await sabcrmPeoplePayrollRunsApi.update(g.ctx.projectId, id, v.payload),
    );
    revalidatePath(PAYROLL_RUNS_PATH);
    revalidatePath(`${PAYROLL_RUNS_PATH}/${id}`);
    return {
      ok: true,
      data: { id: run._id, periodLabel: runPeriodLabel(run) },
    };
  } catch (e) {
    return fail(e, 'Failed to update the payroll run.');
  }
}

export async function deleteSabcrmPayrollRun(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeoplePayrollRunsApi.delete(g.ctx.projectId, id);
    revalidatePath(PAYROLL_RUNS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the payroll run.');
  }
}

/* ─── Lifecycle verbs ────────────────────────────────────────────── */

export async function computeSabcrmPayrollRun(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ employeeCount: number; net: number }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const run = deflateDoc<CrmPayrollRunDoc>(
      await sabcrmPeoplePayrollRunsApi.compute(g.ctx.projectId, id),
    );
    revalidatePath(PAYROLL_RUNS_PATH);
    revalidatePath(`${PAYROLL_RUNS_PATH}/${id}`);
    return {
      ok: true,
      data: {
        employeeCount: run.totals?.employeeCount ?? 0,
        net: run.totals?.net ?? 0,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute the payroll run.');
  }
}

/** Signs the approval step as the gated session user. */
export async function approveSabcrmPayrollRun(
  id: string,
  comment?: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeoplePayrollRunsApi.approve(g.ctx.projectId, id, {
      approverId: g.ctx.userId,
      comment: comment?.trim() || undefined,
    });
    revalidatePath(PAYROLL_RUNS_PATH);
    revalidatePath(`${PAYROLL_RUNS_PATH}/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to approve the payroll run.');
  }
}

export async function disburseSabcrmPayrollRun(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeoplePayrollRunsApi.disburse(g.ctx.projectId, id);
    revalidatePath(PAYROLL_RUNS_PATH);
    revalidatePath(`${PAYROLL_RUNS_PATH}/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to disburse the payroll run.');
  }
}

export async function generateSabcrmPayslips(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmGeneratePayslipsResponse>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPeoplePayrollRunsApi.generatePayslips(
      g.ctx.projectId,
      id,
    );
    revalidatePath(PAYROLL_RUNS_PATH);
    revalidatePath(`${PAYROLL_RUNS_PATH}/${id}`);
    revalidatePath('/sabcrm/people/payslips');
    return { ok: true, data: res };
  } catch (e) {
    return fail(e, 'Failed to generate payslips for this run.');
  }
}
