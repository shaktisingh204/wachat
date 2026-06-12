'use server';

/**
 * SabCRM Finance — voucher-books surface server actions
 * (`/sabcrm/finance/vouchers`, crate `crm-vouchers`).
 *
 * Full doc-surface adopter actions for the numbering-series books:
 * paged display-ready list (every authorable field surfaced), KPI
 * scan, capped CSV export, full create/update and an archive/restore
 * transition. NB: the crate is crm-common style — list pagination is
 * 0-INDEXED on the wire, so these actions translate the kit's 1-based
 * pages (`wire page = page - 1`); passing the kit page through verbatim
 * would silently skip the first page of books.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings; engine failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceVouchersApi,
  type SabcrmVoucherBookDoc,
  type SabcrmVoucherBookUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmVoucherBookStatus } from '@/lib/rust-client/crm-vouchers';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_VOUCHER_BOOK_TYPES,
  type SabcrmVoucherBookFullInput,
  type SabcrmVoucherBookFullPatch,
  type SabcrmVoucherBookKpis,
  type SabcrmVoucherBookListFilters,
  type SabcrmVoucherBookListPage,
  type SabcrmVoucherBookListRow,
  type SabcrmVoucherBookType,
} from './sabcrm-finance-vouchers.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const VOUCHERS_PATH = '/sabcrm/finance/vouchers';

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

/* ─── Validation helpers ──────────────────────────────────────── */

const BOOK_TYPES = new Set<string>(
  SABCRM_VOUCHER_BOOK_TYPES.map((t) => t.value),
);
const RESET_FREQUENCIES = new Set(['none', 'yearly', 'monthly']);

function cleanStartingNumber(
  v: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'Starting number must be a whole number ≥ 1.' };
  }
  return { ok: true, value: n };
}

function cleanPadding(
  v: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10) {
    return { ok: false, error: 'Padding must be between 0 and 10 digits.' };
  }
  return { ok: true, value: n };
}

/* ─── Row mapping ─────────────────────────────────────────────── */

/** `prefix + zero-padded startingNumber + suffix` (display preview). */
function nextNumberPreview(doc: SabcrmVoucherBookDoc): string {
  const start = doc.startingNumber ?? 1;
  const padded = String(start).padStart(Math.max(doc.padding ?? 0, 0), '0');
  return `${doc.prefix ?? ''}${padded}${doc.suffix ?? ''}`;
}

function toListRow(doc: SabcrmVoucherBookDoc): SabcrmVoucherBookListRow {
  return {
    id: doc._id,
    name: doc.name,
    type: doc.type,
    isDefault: doc.isDefault ?? false,
    prefix: doc.prefix ?? '',
    suffix: doc.suffix ?? '',
    startingNumber: doc.startingNumber ?? 1,
    padding: doc.padding ?? 0,
    nextNumberPreview: nextNumberPreview(doc),
    resetFrequency: doc.resetFrequency ?? '',
    approvalRequired: doc.approvalRequired ?? false,
    isActive: doc.isActive !== false && doc.status !== 'archived',
    status:
      doc.status ?? (doc.isActive === false ? 'archived' : 'active'),
    createdAt: doc.createdAt,
  };
}

/** Inclusive `YYYY-MM-DD` refinement on `createdAt` (in-page). */
function inRange(
  doc: SabcrmVoucherBookDoc,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  const day = (doc.createdAt ?? '').slice(0, 10);
  if (!day) return false;
  return day >= (from ?? '0000-00-00') && day <= (to ?? '9999-12-31');
}

/* ─── List page ───────────────────────────────────────────────── */

/**
 * Lists a page of display-ready voucher-book rows. The toolbar's "All
 * statuses" maps to the crate's `all` (the default Rust filter hides
 * archived books, which would make the status dropdown lie).
 */
export async function listSabcrmVoucherBooksPage(
  filters: SabcrmVoucherBookListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceVouchersApi.list(g.ctx.projectId, {
      // crm-common pagination is 0-indexed.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status ? filters.status : 'all',
      type: filters.type || undefined,
    });
    const rows = res.items
      .filter((d) => inRange(d, filters.from, filters.to))
      .map(toListRow);
    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list voucher books.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** Pages the list endpoint scans for KPIs / export (100 docs each). */
const SCAN_MAX_PAGES = 5;

async function scanAll(
  projectId: string,
  filters?: Pick<SabcrmVoucherBookListFilters, 'q' | 'status' | 'type'>,
): Promise<{ docs: SabcrmVoucherBookDoc[]; sampled: boolean }> {
  const docs: SabcrmVoucherBookDoc[] = [];
  let sampled = false;
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    const res = await sabcrmFinanceVouchersApi.list(projectId, {
      page,
      limit: 100,
      q: filters?.q || undefined,
      status: filters?.status ? filters.status : 'all',
      type: filters?.type || undefined,
    });
    docs.push(...res.items);
    if (!res.hasMore || res.items.length === 0) break;
    if (page === SCAN_MAX_PAGES - 1) sampled = true;
  }
  return { docs, sampled };
}

/** Computes the KPI strip over a capped scan (up to 500 books). */
export async function getSabcrmVoucherBookKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs, sampled } = await scanAll(g.ctx.projectId);
    const byType: Record<string, number> = {};
    let activeCount = 0;
    let archivedCount = 0;
    let approvalRequiredCount = 0;
    let defaultCount = 0;

    for (const doc of docs) {
      const row = toListRow(doc);
      byType[row.type] = (byType[row.type] ?? 0) + 1;
      if (row.status === 'archived') archivedCount += 1;
      else if (row.isActive) activeCount += 1;
      if (row.approvalRequired) approvalRequiredCount += 1;
      if (row.isDefault) defaultCount += 1;
    }

    let topType = '';
    let topTypeCount = 0;
    for (const [type, n] of Object.entries(byType)) {
      if (n > topTypeCount) {
        topType = type;
        topTypeCount = n;
      }
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        activeCount,
        archivedCount,
        approvalRequiredCount,
        defaultCount,
        byType,
        topType,
        topTypeCount,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute voucher-book KPIs.');
  }
}

/* ─── CSV export ──────────────────────────────────────────────── */

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmVoucherBookRows(
  filters: SabcrmVoucherBookListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookListRow[]>> {
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
    return fail(e, 'Failed to export voucher books.');
  }
}

/* ─── By-id (deep-linked edit dialog) ─────────────────────────── */

/** Loads one book as a display row (cold `?edit=` deep links). */
export async function getSabcrmVoucherBookRow(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookListRow>> {
  if (!id) return { ok: false, error: 'Book id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmFinanceVouchersApi.getById(g.ctx.projectId, id);
    return { ok: true, data: toListRow(doc) };
  } catch (e) {
    return fail(e, 'Failed to load the voucher book.');
  }
}

/* ─── Create / update ─────────────────────────────────────────── */

function validateBookInput(
  input: SabcrmVoucherBookFullInput | SabcrmVoucherBookFullPatch,
  partial: boolean,
): string | null {
  if (!partial || input.name !== undefined) {
    if (!input.name?.trim()) return 'A book name is required.';
  }
  if (!partial || input.type !== undefined) {
    if (!input.type || !BOOK_TYPES.has(input.type)) {
      return 'Pick a valid voucher type.';
    }
  }
  if (
    input.resetFrequency !== undefined &&
    !RESET_FREQUENCIES.has(input.resetFrequency)
  ) {
    return 'Pick a valid reset frequency.';
  }
  return null;
}

/** Creates a voucher book from the FULL dialog form. */
export async function createSabcrmVoucherBookFull(
  input: SabcrmVoucherBookFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookDoc>> {
  const problem = validateBookInput(input, false);
  if (problem) return { ok: false, error: problem };
  const start = cleanStartingNumber(input.startingNumber);
  if (!start.ok) return { ok: false, error: start.error };
  const padding = cleanPadding(input.padding);
  if (!padding.ok) return { ok: false, error: padding.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceVouchersApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      type: input.type,
      isDefault: input.isDefault,
      prefix: input.prefix?.trim() || undefined,
      suffix: input.suffix?.trim() || undefined,
      startingNumber: start.value,
      padding: padding.value,
      resetFrequency: input.resetFrequency,
      approvalRequired: input.approvalRequired,
      isActive: input.isActive,
    });
    revalidatePath(VOUCHERS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the voucher book.');
  }
}

/** Full-form partial update (name, type, series, flags). */
export async function updateSabcrmVoucherBookFull(
  id: string,
  patch: SabcrmVoucherBookFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookDoc>> {
  if (!id) return { ok: false, error: 'Book id is required.' };
  const problem = validateBookInput(patch, true);
  if (problem) return { ok: false, error: problem };

  const wire: SabcrmVoucherBookUpdateInput = {};
  if (patch.name !== undefined) wire.name = patch.name.trim();
  if (patch.type !== undefined) wire.type = patch.type;
  if (patch.isDefault !== undefined) wire.isDefault = patch.isDefault;
  if (patch.prefix !== undefined) wire.prefix = patch.prefix.trim();
  if (patch.suffix !== undefined) wire.suffix = patch.suffix.trim();
  if (patch.startingNumber !== undefined) {
    const start = cleanStartingNumber(patch.startingNumber);
    if (!start.ok) return { ok: false, error: start.error };
    wire.startingNumber = start.value;
  }
  if (patch.padding !== undefined) {
    const padding = cleanPadding(patch.padding);
    if (!padding.ok) return { ok: false, error: padding.error };
    wire.padding = padding.value;
  }
  if (patch.resetFrequency !== undefined) {
    wire.resetFrequency = patch.resetFrequency;
  }
  if (patch.approvalRequired !== undefined) {
    wire.approvalRequired = patch.approvalRequired;
  }
  if (patch.isActive !== undefined) wire.isActive = patch.isActive;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceVouchersApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(VOUCHERS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the voucher book.');
  }
}

/* ─── Archive / restore ───────────────────────────────────────── */

/**
 * Archives or restores a book (the crate's only status axis). The
 * `isActive` flag is kept in sync so legacy consumers agree.
 */
export async function setSabcrmVoucherBookStatus(
  id: string,
  next: CrmVoucherBookStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookDoc>> {
  if (!id) return { ok: false, error: 'Book id is required.' };
  if (next !== 'active' && next !== 'archived') {
    return { ok: false, error: 'Invalid voucher-book status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceVouchersApi.update(g.ctx.projectId, id, {
      status: next,
      isActive: next === 'active',
    });
    revalidatePath(VOUCHERS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the voucher-book status.');
  }
}
