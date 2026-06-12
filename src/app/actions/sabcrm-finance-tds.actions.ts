'use server';

/**
 * SabCRM Finance — TDS-records surface server actions
 * (`/sabcrm/finance/tds`, crate `crm-tds`).
 *
 * Full doc-surface adopter actions for per-deductee quarterly TDS:
 *
 *   - paged display-ready list (FY + quarter engine filters, in-page
 *     date refinement);
 *   - KPI scan scoped to the CURRENT Indian financial year (Apr–Mar):
 *     pending deposit amount, deposited this quarter, filed
 *     certificates, FY total;
 *   - capped CSV export;
 *   - full create/update (people-picker id + free-text deductee name,
 *     FY/quarter vocabulary, deposit challan + date) and validated
 *     status transitions pending → deposited → filed.
 *
 * NB: the crate is crm-common style — list pagination is 0-INDEXED on
 * the wire, so these actions translate the kit's 1-based pages. The TS
 * client has no by-id getter on the project mount, so the deep-link
 * fallback (`getSabcrmTdsRecordRow`) scans the capped list instead.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings; engine failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceTdsApi,
  type SabcrmTdsRecordDoc,
  type SabcrmTdsUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmTdsStatus } from '@/lib/rust-client/crm-tds';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_TDS_QUARTERS,
  SABCRM_TDS_TRANSITIONS,
  type SabcrmTdsFullInput,
  type SabcrmTdsFullPatch,
  type SabcrmTdsKpis,
  type SabcrmTdsListFilters,
  type SabcrmTdsListPage,
  type SabcrmTdsListRow,
} from './sabcrm-finance-tds.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const TDS_PATH = '/sabcrm/finance/tds';

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

/* ─── Indian FY helpers ───────────────────────────────────────── */

/** Current Indian financial year, e.g. `"2026-27"` (Apr–Mar). */
function currentFinancialYear(now = new Date()): string {
  const month = now.getUTCMonth() + 1; // 1..12
  const startYear = month >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Current FY quarter: Q1=Apr–Jun … Q4=Jan–Mar. */
function currentQuarter(now = new Date()): string {
  const month = now.getUTCMonth() + 1;
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4';
}

/* ─── Row mapping ─────────────────────────────────────────────── */

function toListRow(doc: SabcrmTdsRecordDoc): SabcrmTdsListRow {
  return {
    id: doc._id,
    employeeId: doc.employeeId ?? '',
    employeeName: doc.employeeName,
    financialYear: doc.financialYear,
    quarter: doc.quarter,
    tdsAmount: doc.tdsAmount ?? 0,
    grossAmount: doc.grossAmount ?? 0,
    certificateNumber: doc.certificateNumber ?? '',
    depositChallanNumber: doc.depositChallanNumber ?? '',
    depositDate: doc.depositDate ?? null,
    status: (doc.status ?? 'pending') as CrmTdsStatus,
    notes: doc.notes ?? '',
    createdAt: doc.createdAt,
  };
}

/** Inclusive `YYYY-MM-DD` refinement on depositDate ?? createdAt. */
function inRange(doc: SabcrmTdsRecordDoc, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const day = (doc.depositDate ?? doc.createdAt ?? '').slice(0, 10);
  if (!day) return false;
  return day >= (from ?? '0000-00-00') && day <= (to ?? '9999-12-31');
}

/* ─── List page ───────────────────────────────────────────────── */

/** Lists a page of display-ready TDS rows (FY/quarter engine filters). */
export async function listSabcrmTdsRecordsPage(
  filters: SabcrmTdsListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceTdsApi.list(g.ctx.projectId, {
      // crm-common pagination is 0-indexed.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status ? filters.status : 'all',
      financialYear: filters.financialYear || undefined,
      quarter: filters.quarter || undefined,
      employeeId: filters.employeeId || undefined,
    });
    const rows = res.items
      .filter((d) => inRange(d, filters.from, filters.to))
      .map(toListRow);
    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list TDS records.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

const SCAN_MAX_PAGES = 5;

async function scanAll(
  projectId: string,
  filters?: Pick<
    SabcrmTdsListFilters,
    'q' | 'status' | 'financialYear' | 'quarter' | 'employeeId'
  >,
): Promise<{ docs: SabcrmTdsRecordDoc[]; sampled: boolean }> {
  const docs: SabcrmTdsRecordDoc[] = [];
  let sampled = false;
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    const res = await sabcrmFinanceTdsApi.list(projectId, {
      page,
      limit: 100,
      q: filters?.q || undefined,
      status: filters?.status ? filters.status : 'all',
      financialYear: filters?.financialYear || undefined,
      quarter: filters?.quarter || undefined,
      employeeId: filters?.employeeId || undefined,
    });
    docs.push(...res.items);
    if (!res.hasMore || res.items.length === 0) break;
    if (page === SCAN_MAX_PAGES - 1) sampled = true;
  }
  return { docs, sampled };
}

/**
 * Computes the KPI strip over a capped scan (up to 500 records),
 * scoped to the current Indian FY + quarter.
 */
export async function getSabcrmTdsKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmTdsKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs, sampled } = await scanAll(g.ctx.projectId);
    const fy = currentFinancialYear();
    const quarter = currentQuarter();
    let pendingAmount = 0;
    let pendingCount = 0;
    let depositedThisQuarter = 0;
    let filedCount = 0;
    let fyTotal = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'pending') as CrmTdsStatus;
      if (status === 'archived') continue;
      const amount = doc.tdsAmount ?? 0;
      if (status === 'pending') {
        pendingAmount += amount;
        pendingCount += 1;
      }
      if (status === 'filed') filedCount += 1;
      if (doc.financialYear === fy) {
        fyTotal += amount;
        if (
          doc.quarter === quarter &&
          (status === 'deposited' || status === 'filed')
        ) {
          depositedThisQuarter += amount;
        }
      }
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        pendingAmount: round2(pendingAmount),
        pendingCount,
        depositedThisQuarter: round2(depositedThisQuarter),
        filedCount,
        fyTotal: round2(fyTotal),
        financialYear: fy,
        quarter,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute TDS KPIs.');
  }
}

/* ─── CSV export ──────────────────────────────────────────────── */

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmTdsRows(
  filters: SabcrmTdsListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs } = await scanAll(g.ctx.projectId, filters);
    return {
      ok: true,
      data: docs
        .filter((d) => inRange(d, filters.from, filters.to))
        .map(toListRow),
    };
  } catch (e) {
    return fail(e, 'Failed to export TDS records.');
  }
}

/* ─── By-id (deep-linked edit dialog) ─────────────────────────── */

/**
 * Loads one record as a display row for cold `?edit=` deep links. The
 * project mount's TS client has no by-id getter, so this scans the
 * capped list (500) — fine for the rare cold-link case; warm clicks
 * hit the client-side row cache instead.
 */
export async function getSabcrmTdsRecordRow(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsListRow>> {
  if (!id) return { ok: false, error: 'Record id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const { docs } = await scanAll(g.ctx.projectId);
    const doc = docs.find((d) => d._id === id);
    if (!doc) return { ok: false, error: 'TDS record not found.' };
    return { ok: true, data: toListRow(doc) };
  } catch (e) {
    return fail(e, 'Failed to load the TDS record.');
  }
}

/* ─── Create / update ─────────────────────────────────────────── */

const QUARTERS = new Set<string>(SABCRM_TDS_QUARTERS.map((q) => q.value));
const FY_RE = /^\d{4}-\d{2}$/;

function cleanAmount(
  v: number | undefined,
  label: string,
  required: boolean,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) {
    return required
      ? { ok: false, error: `${label} is required.` }
      : { ok: true, value: undefined };
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `${label} must be a non-negative number.` };
  }
  return { ok: true, value: round2(n) };
}

/** Creates a TDS record from the FULL dialog form. */
export async function createSabcrmTdsRecordFull(
  input: SabcrmTdsFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsRecordDoc>> {
  if (!input?.employeeName?.trim()) {
    return { ok: false, error: 'A deductee name is required.' };
  }
  if (!input.financialYear?.trim() || !FY_RE.test(input.financialYear.trim())) {
    return { ok: false, error: 'Pick a financial year (e.g. 2026-27).' };
  }
  const quarter = input.quarter?.trim().toUpperCase();
  if (!quarter || !QUARTERS.has(quarter)) {
    return { ok: false, error: 'Quarter must be Q1, Q2, Q3 or Q4.' };
  }
  if (input.employeeId && !ObjectId.isValid(input.employeeId)) {
    return { ok: false, error: 'The picked deductee record is invalid.' };
  }
  const tds = cleanAmount(input.tdsAmount, 'TDS amount', true);
  if (!tds.ok) return { ok: false, error: tds.error };
  const gross = cleanAmount(input.grossAmount, 'Gross amount', false);
  if (!gross.ok) return { ok: false, error: gross.error };
  let depositIso: string | undefined;
  if (input.depositDate) {
    const iso = toIso(input.depositDate);
    if (!iso) return { ok: false, error: 'The deposit date is invalid.' };
    depositIso = iso;
  }
  const status: CrmTdsStatus =
    input.status && input.status in SABCRM_TDS_TRANSITIONS
      ? input.status
      : 'pending';

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceTdsApi.create(g.ctx.projectId, {
      employeeId: input.employeeId || undefined,
      employeeName: input.employeeName.trim(),
      financialYear: input.financialYear.trim(),
      quarter,
      tdsAmount: tds.value,
      grossAmount: gross.value ?? 0,
      certificateNumber: input.certificateNumber?.trim() || undefined,
      depositChallanNumber: input.depositChallanNumber?.trim() || undefined,
      depositDate: depositIso,
      status,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(TDS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the TDS record.');
  }
}

/** Full-form partial update (status moves via the transition action). */
export async function updateSabcrmTdsRecordFull(
  id: string,
  patch: SabcrmTdsFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsRecordDoc>> {
  if (!id) return { ok: false, error: 'Record id is required.' };

  const wire: SabcrmTdsUpdateInput = {};
  if (patch.employeeName !== undefined) {
    if (!patch.employeeName.trim()) {
      return { ok: false, error: 'A deductee name is required.' };
    }
    wire.employeeName = patch.employeeName.trim();
  }
  if (patch.employeeId !== undefined) {
    if (patch.employeeId && !ObjectId.isValid(patch.employeeId)) {
      return { ok: false, error: 'The picked deductee record is invalid.' };
    }
    wire.employeeId = patch.employeeId || undefined;
  }
  if (patch.financialYear !== undefined) {
    if (!FY_RE.test(patch.financialYear.trim())) {
      return { ok: false, error: 'Pick a financial year (e.g. 2026-27).' };
    }
    wire.financialYear = patch.financialYear.trim();
  }
  if (patch.quarter !== undefined) {
    const quarter = patch.quarter?.trim().toUpperCase();
    if (!quarter || !QUARTERS.has(quarter)) {
      return { ok: false, error: 'Quarter must be Q1, Q2, Q3 or Q4.' };
    }
    wire.quarter = quarter;
  }
  if (patch.tdsAmount !== undefined) {
    const tds = cleanAmount(patch.tdsAmount, 'TDS amount', true);
    if (!tds.ok) return { ok: false, error: tds.error };
    wire.tdsAmount = tds.value;
  }
  if (patch.grossAmount !== undefined) {
    const gross = cleanAmount(patch.grossAmount, 'Gross amount', false);
    if (!gross.ok) return { ok: false, error: gross.error };
    wire.grossAmount = gross.value;
  }
  if (patch.certificateNumber !== undefined) {
    wire.certificateNumber = patch.certificateNumber.trim();
  }
  if (patch.depositChallanNumber !== undefined) {
    wire.depositChallanNumber = patch.depositChallanNumber.trim();
  }
  if (patch.depositDate !== undefined) {
    if (patch.depositDate) {
      const iso = toIso(patch.depositDate);
      if (!iso) return { ok: false, error: 'The deposit date is invalid.' };
      wire.depositDate = iso;
    } else {
      wire.depositDate = undefined;
    }
  }
  if (patch.notes !== undefined) wire.notes = patch.notes.trim();
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceTdsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(TDS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the TDS record.');
  }
}

/* ─── Status transitions ──────────────────────────────────────── */

/**
 * Applies a workflow transition (pending → deposited → filed)
 * validated against the allowed map. Marking `deposited` without a
 * stored deposit date stamps today.
 */
export async function transitionSabcrmTdsStatus(
  id: string,
  next: CrmTdsStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsRecordDoc>> {
  if (!id) return { ok: false, error: 'Record id is required.' };
  if (!(next in SABCRM_TDS_TRANSITIONS)) {
    return { ok: false, error: 'Invalid TDS status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs } = await scanAll(g.ctx.projectId);
    const current = docs.find((d) => d._id === id);
    if (!current) return { ok: false, error: 'TDS record not found.' };
    const from = (current.status ?? 'pending') as CrmTdsStatus;
    if (!SABCRM_TDS_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a TDS record from "${from}" to "${next}".`,
      };
    }
    const wire: SabcrmTdsUpdateInput = { status: next };
    if (next === 'deposited' && !current.depositDate) {
      wire.depositDate = new Date().toISOString();
    }
    const data = await sabcrmFinanceTdsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(TDS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the TDS status.');
  }
}
