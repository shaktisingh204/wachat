'use server';

/**
 * SabCRM Finance — budget-surface server actions (spec §3.16).
 *
 * Full doc-surface data paths for `/sabcrm/finance/budgets`:
 *
 *   - display-ready paged list rows (planned vs actual + utilisation);
 *   - KPI strip (planned total / actual total / utilisation % /
 *     over-budget heads);
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (head, department, period, planned
 *     amount, currency, notes; edit also records `actualAmount`);
 *   - status transitions (`draft → approved/rejected`, `approved →
 *     locked`, `rejected → draft`) validated against
 *     `SABCRM_BUDGET_TRANSITIONS` — the crate's create DTO has NO
 *     status, so budgets are born `draft`.
 *
 * Wire traps handled here: extended-JSON deflation (`{$oid}`/`{$date}`)
 * and the crm-common 0-INDEXED pagination. NB Rust gap: this mount's
 * `UpdateBudgetInput` ignores `locked` / `rejectReason` / approval
 * timestamps — the audit-trail fields render READ-ONLY when present
 * and are never written from here.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceBudgetsApi,
  type SabcrmBudgetDoc,
  type SabcrmBudgetUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmBudgetStatus } from '@/lib/rust-client/crm-budgets';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_BUDGET_TRANSITIONS,
  type SabcrmBudgetFullInput,
  type SabcrmBudgetFullPatch,
  type SabcrmBudgetKpis,
  type SabcrmBudgetListFilters,
  type SabcrmBudgetListPage,
  type SabcrmBudgetListRow,
} from './sabcrm-finance-budgets.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const FINANCE_BUDGETS_PATH = '/sabcrm/finance/budgets';

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

/* ─── Rows ────────────────────────────────────────────────────── */

function toListRow(doc: SabcrmBudgetDoc): SabcrmBudgetListRow {
  const planned = doc.plannedAmount ?? 0;
  const actual = doc.actualAmount ?? 0;
  return {
    id: doc._id,
    budgetHead: doc.budgetHead,
    department: doc.department ?? '',
    period: doc.period ?? '',
    plannedAmount: planned,
    actualAmount: actual,
    currency: doc.currency || 'INR',
    utilisation: planned > 0 ? actual / planned : 0,
    overBudget: actual > planned && planned > 0,
    status: (doc.status ?? 'draft') as CrmBudgetStatus,
    createdAt: doc.createdAt ?? '',
  };
}

/** In-page inclusive date-range refinement on the creation date. */
function inRange(
  docs: SabcrmBudgetDoc[],
  from?: string,
  to?: string,
): SabcrmBudgetDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.createdAt ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page ───────────────────────────────────────────────── */

/**
 * Lists a page of display-ready budget rows. NB: crm-common pages are
 * 0-indexed — the kit's 1-based `page` is decremented here. The Rust
 * list also filters on `department` / `period` natively.
 */
export async function listSabcrmBudgetsPage(
  filters: SabcrmBudgetListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceBudgetsApi.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      department: filters.department || undefined,
      period: filters.period || undefined,
    });
    const docs = inRange(
      deflateDocs<SabcrmBudgetDoc>(res.items),
      filters.from,
      filters.to,
    );

    return {
      ok: true,
      data: {
        rows: docs.map(toListRow),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list budgets.');
  }
}

/** Pages the list endpoint scans for KPIs / export (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Capped fetch-all (500) for CSV export, honouring the filters. */
export async function exportSabcrmBudgetRows(
  filters: SabcrmBudgetListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmBudgetDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceBudgetsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        department: filters.department || undefined,
        period: filters.period || undefined,
      });
      docs.push(...deflateDocs<SabcrmBudgetDoc>(res.items));
      if (!res.hasMore) break;
    }
    return {
      ok: true,
      data: inRange(docs, filters.from, filters.to).map(toListRow),
    };
  } catch (e) {
    return fail(e, 'Failed to export budgets.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** Computes the KPI strip over a capped scan (up to 500 budgets). */
export async function getSabcrmBudgetKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmBudgetDoc[] = [];
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceBudgetsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...deflateDocs<SabcrmBudgetDoc>(res.items));
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1) sampled = true;
    }

    const currencyVotes = new Map<string, number>();
    let plannedTotal = 0;
    let actualTotal = 0;
    let overBudgetCount = 0;

    for (const doc of docs) {
      const planned = doc.plannedAmount ?? 0;
      const actual = doc.actualAmount ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);
      plannedTotal += planned;
      actualTotal += actual;
      if (planned > 0 && actual > planned) overBudgetCount += 1;
    }

    let currency = 'INR';
    let votes = -1;
    for (const [code, n] of currencyVotes) {
      if (n > votes) {
        currency = code;
        votes = n;
      }
    }

    return {
      ok: true,
      data: {
        currency,
        plannedTotal: round2(plannedTotal),
        actualTotal: round2(actualTotal),
        utilisationPct:
          plannedTotal > 0
            ? Math.round((actualTotal / plannedTotal) * 100)
            : 0,
        overBudgetCount,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute budget KPIs.');
  }
}

/* ─── Detail fetch ────────────────────────────────────────────── */

/** Fetches ONE budget, extended-JSON deflated. */
export async function getSabcrmBudgetFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetDoc>> {
  if (!id) return { ok: false, error: 'Budget id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = deflateDoc<SabcrmBudgetDoc>(
      await sabcrmFinanceBudgetsApi.getById(g.ctx.projectId, id),
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the budget.');
  }
}

/* ─── Full-form create / update ───────────────────────────────── */

/**
 * Creates a budget from the FULL form. The crate's create DTO has no
 * status — every budget is born `draft` and moves through the
 * approval transitions.
 */
export async function createSabcrmBudgetFull(
  input: SabcrmBudgetFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetDoc>> {
  if (!input?.budgetHead?.trim()) {
    return { ok: false, error: 'A budget head is required.' };
  }
  if (!input.period?.trim()) {
    return { ok: false, error: 'A period is required (e.g. FY 2026-27).' };
  }
  const planned = Number(input.plannedAmount);
  if (!Number.isFinite(planned) || planned < 0) {
    return {
      ok: false,
      error: 'Planned amount must be a non-negative number.',
    };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceBudgetsApi.create(g.ctx.projectId, {
      budgetHead: input.budgetHead.trim(),
      department: input.department?.trim() || undefined,
      period: input.period.trim(),
      plannedAmount: round2(planned),
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(FINANCE_BUDGETS_PATH);
    return { ok: true, data: deflateDoc<SabcrmBudgetDoc>(created.entity) };
  } catch (e) {
    return fail(e, 'Failed to create the budget.');
  }
}

/**
 * Full-form partial update — including `actualAmount` ("record
 * actuals"). Locked budgets are immutable (status transitions aside).
 */
export async function updateSabcrmBudgetFull(
  id: string,
  patch: SabcrmBudgetFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetDoc>> {
  if (!id) return { ok: false, error: 'Budget id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmBudgetUpdateInput = {};
  if (patch.budgetHead !== undefined) {
    if (!patch.budgetHead.trim()) {
      return { ok: false, error: 'A budget head is required.' };
    }
    wire.budgetHead = patch.budgetHead.trim();
  }
  if (patch.department !== undefined) wire.department = patch.department.trim();
  if (patch.period !== undefined) {
    if (!patch.period.trim()) {
      return { ok: false, error: 'A period is required.' };
    }
    wire.period = patch.period.trim();
  }
  if (patch.plannedAmount !== undefined) {
    const planned = Number(patch.plannedAmount);
    if (!Number.isFinite(planned) || planned < 0) {
      return {
        ok: false,
        error: 'Planned amount must be a non-negative number.',
      };
    }
    wire.plannedAmount = round2(planned);
  }
  if (patch.actualAmount !== undefined) {
    const actual = Number(patch.actualAmount);
    if (!Number.isFinite(actual) || actual < 0) {
      return {
        ok: false,
        error: 'Actual amount must be a non-negative number.',
      };
    }
    wire.actualAmount = round2(actual);
  }
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const current = deflateDoc<SabcrmBudgetDoc>(
      await sabcrmFinanceBudgetsApi.getById(g.ctx.projectId, id),
    );
    if ((current.status ?? 'draft') === 'locked') {
      return {
        ok: false,
        error: 'This budget is locked — its figures can no longer change.',
      };
    }
    const data = deflateDoc<SabcrmBudgetDoc>(
      await sabcrmFinanceBudgetsApi.update(g.ctx.projectId, id, wire),
    );
    revalidatePath(FINANCE_BUDGETS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the budget.');
  }
}

/* ─── Status transitions ──────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the transition map.
 * NB: approval/lock/reject TIMESTAMPS are a Rust gap on this mount
 * (`UpdateBudgetInput` only patches `status`) — they render read-only
 * when historical documents carry them.
 */
export async function transitionSabcrmBudgetStatus(
  id: string,
  next: CrmBudgetStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetDoc>> {
  if (!id) return { ok: false, error: 'Budget id is required.' };
  if (!(next in SABCRM_BUDGET_TRANSITIONS)) {
    return { ok: false, error: 'Invalid budget status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = deflateDoc<SabcrmBudgetDoc>(
      await sabcrmFinanceBudgetsApi.getById(g.ctx.projectId, id),
    );
    const from = (current.status ?? 'draft') as CrmBudgetStatus;
    if (!SABCRM_BUDGET_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a budget from "${from}" to "${next}".`,
      };
    }
    const data = deflateDoc<SabcrmBudgetDoc>(
      await sabcrmFinanceBudgetsApi.update(g.ctx.projectId, id, {
        status: next,
      }),
    );
    revalidatePath(FINANCE_BUDGETS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the budget status.');
  }
}
