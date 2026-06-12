'use server';

/**
 * SabCRM People — Payslips server actions (people-suite WI-33).
 *
 * Drives the `/sabcrm/people/payslips` surface over the project-scoped
 * `crm-payslips` mount, handling the WI-9 dual shape:
 *
 *   - unified list rows (rich rows read their frozen employee
 *     snapshot; flat rows batch-resolve `employeeId` labels — raw
 *     ObjectIds never reach the client) + capped CSV export;
 *   - the synthetic `generated` status filter (rich rows carry no wire
 *     status — filtering branches action-side on `runId` presence);
 *   - employee filter picker (`searchSabcrmPayslipEmployees`) over the
 *     project employees mount;
 *   - detail context for both shapes + the `mark-sent` delivery verb
 *     (the ONLY legal mutation on rich payslips — engine 409s the rest).
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * the finance invoices actions (verbatim recipe). Engine failures
 * normalise into `{ ok: false, error }`. All fetched docs are deflated
 * from MongoDB extended JSON before use.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmPeoplePayslipsApi,
  type SabcrmRichPayslipDoc,
  type SabcrmUnifiedPayslipDoc,
  type CrmPayslipDoc,
} from '@/lib/rust-client/sabcrm-people-payslips';
import {
  sabcrmPeoplePayrollEmployeesApi,
  type CrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-payroll-runs';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  PAYSLIP_RICH_STATUS,
  type SabcrmPayslipDetail,
  type SabcrmPayslipListFilters,
  type SabcrmPayslipListPage,
  type SabcrmPayslipListRow,
} from './sabcrm-people-payslips.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const PAYSLIPS_PATH = '/sabcrm/people/payslips';
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

/* ─── Shape helpers (WI-9 / risk R7) ────────────────────────────── */

function isRich(p: SabcrmUnifiedPayslipDoc): p is SabcrmRichPayslipDoc {
  return typeof (p as SabcrmRichPayslipDoc).runId === 'string';
}

function fmtMonth(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function richGross(p: SabcrmRichPayslipDoc): number {
  return (p.earnings ?? []).reduce((s, l) => s + (l.amount ?? 0), 0);
}

function richDeductions(p: SabcrmRichPayslipDoc): number {
  return (p.deductions ?? []).reduce((s, l) => s + (l.amount ?? 0), 0);
}

function toRow(
  p: SabcrmUnifiedPayslipDoc,
  labels: Map<string, string>,
): SabcrmPayslipListRow {
  if (isRich(p)) {
    return {
      id: p._id,
      kind: 'rich',
      periodLabel: p.header?.periodLabel || fmtMonth(p.periodFrom),
      employeeId: p.employeeId,
      employeeLabel:
        p.employeeSnapshot?.name ?? labels.get(p.employeeId) ?? null,
      gross: richGross(p),
      deductions: richDeductions(p),
      net: p.netPay ?? 0,
      sent: Boolean(p.sent),
      locked: Boolean(p.locked),
      status: PAYSLIP_RICH_STATUS,
      currency: CURRENCY,
      runId: p.runId,
    };
  }
  const flat = p as CrmPayslipDoc;
  return {
    id: flat._id,
    kind: 'flat',
    periodLabel: fmtMonth(flat.payPeriod),
    employeeId: flat.employeeId,
    employeeLabel:
      flat.employeeName?.trim() || labels.get(flat.employeeId) || null,
    gross: flat.gross ?? 0,
    deductions: flat.deductions ?? 0,
    net: flat.net ?? 0,
    sent: flat.status === 'issued' || flat.status === 'paid',
    locked: false,
    status: flat.status ?? 'draft',
    currency: CURRENCY,
    runId: null,
  };
}

/** Period date for the from/to post-filter (rich periodFrom, flat payPeriod). */
function rowPeriodMs(p: SabcrmUnifiedPayslipDoc): number {
  const iso = isRich(p) ? p.periodFrom : (p as CrmPayslipDoc).payPeriod;
  const t = new Date(iso ?? '').getTime();
  return Number.isFinite(t) ? t : 0;
}

/* ─── Employee label resolution (flat rows only) ────────────────── */

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
    // Engine hiccup — rows render "Unknown".
  }
  return map;
}

/* ─── List + export ──────────────────────────────────────────────── */

async function fetchPage(
  projectId: string,
  filters: SabcrmPayslipListFilters,
  limit: number,
): Promise<{ items: SabcrmUnifiedPayslipDoc[]; hasMore: boolean }> {
  // The synthetic `generated` status is action-side: rich docs carry no
  // wire `status`, so we drop the engine filter and keep rich rows only.
  const wantsRich = filters.status === PAYSLIP_RICH_STATUS;
  const res = await sabcrmPeoplePayslipsApi.list(projectId, {
    page: Math.max(1, filters.page),
    limit,
    q: filters.q?.trim() || undefined,
    status: wantsRich ? undefined : filters.status || undefined,
    employeeId: filters.employeeId || undefined,
    runId: filters.runId || undefined,
  });
  let items = deflateDocs(res.items);
  if (wantsRich) items = items.filter(isRich);
  if (filters.from) {
    const from = new Date(filters.from).getTime();
    if (Number.isFinite(from)) {
      items = items.filter((p) => rowPeriodMs(p) >= from);
    }
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime() + 24 * 3600 * 1000 - 1;
    if (Number.isFinite(to)) {
      items = items.filter((p) => rowPeriodMs(p) <= to);
    }
  }
  return { items, hasMore: res.hasMore };
}

export async function listSabcrmPayslipsPage(
  filters: SabcrmPayslipListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPayslipListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { items, hasMore } = await fetchPage(
      g.ctx.projectId,
      filters,
      PAGE_SIZE,
    );
    const flatIds = items
      .filter((p) => !isRich(p) && !(p as CrmPayslipDoc).employeeName)
      .map((p) => (p as CrmPayslipDoc).employeeId);
    const labels = await employeeLabelMap(g.ctx.projectId, flatIds);
    return {
      ok: true,
      data: { rows: items.map((p) => toRow(p, labels)), hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to load payslips.');
  }
}

/** Capped fetch-all for the CSV export (≤ 5 pages of 100). */
export async function exportSabcrmPayslipRows(
  filters: SabcrmPayslipListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPayslipListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const all: SabcrmUnifiedPayslipDoc[] = [];
    for (let page = 1; page <= 5; page++) {
      const { items, hasMore } = await fetchPage(
        g.ctx.projectId,
        { ...filters, page },
        100,
      );
      all.push(...items);
      if (!hasMore) break;
    }
    const flatIds = all
      .filter((p) => !isRich(p) && !(p as CrmPayslipDoc).employeeName)
      .map((p) => (p as CrmPayslipDoc).employeeId);
    const labels = await employeeLabelMap(g.ctx.projectId, flatIds);
    return { ok: true, data: all.map((p) => toRow(p, labels)) };
  } catch (e) {
    return fail(e, 'Failed to export payslips.');
  }
}

/* ─── Employee picker (toolbar filter) ──────────────────────────── */

export async function searchSabcrmPayslipEmployees(
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

/* ─── Detail + delivery ──────────────────────────────────────────── */

export async function getSabcrmPayslip(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPayslipDetail>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const payslip = deflateDoc<SabcrmUnifiedPayslipDoc>(
      await sabcrmPeoplePayslipsApi.getById(g.ctx.projectId, id),
    );
    let employeeLabel: string | null = null;
    if (isRich(payslip)) {
      employeeLabel = payslip.employeeSnapshot?.name ?? null;
    } else {
      const flat = payslip as CrmPayslipDoc;
      employeeLabel = flat.employeeName?.trim() || null;
      if (!employeeLabel && flat.employeeId) {
        const labels = await employeeLabelMap(g.ctx.projectId, [
          flat.employeeId,
        ]);
        employeeLabel = labels.get(flat.employeeId) ?? null;
      }
    }
    return { ok: true, data: { payslip, employeeLabel } };
  } catch (e) {
    return fail(e, 'Failed to load the payslip.');
  }
}

export async function markSabcrmPayslipSent(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeoplePayslipsApi.markSent(g.ctx.projectId, id);
    revalidatePath(PAYSLIPS_PATH);
    revalidatePath(`${PAYSLIPS_PATH}/${id}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to mark the payslip as sent.');
  }
}

/** FLAT payslips only — the engine 409s rich payslips (WI-9). */
export async function deleteSabcrmPayslip(
  id: string,
  projectId?: string,
): Promise<ActionResult<null>> {
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmPeoplePayslipsApi.delete(g.ctx.projectId, id);
    revalidatePath(PAYSLIPS_PATH);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to delete the payslip.');
  }
}
