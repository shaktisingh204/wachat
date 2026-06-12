'use server';

/**
 * SabCRM Finance — reconciliation surface server actions
 * (`/sabcrm/finance/reconciliation`, crate `crm-reconciliation`).
 *
 * Full doc-surface adopter actions for bank-reconciliation runs:
 *
 *   - paged display-ready list (payment-account labels batch-resolved
 *     in ONE list call over the accounts mount — no N+1);
 *   - account picker search (the kit's party-filter slot is repurposed
 *     as the account filter);
 *   - KPI scan (in-progress / last completed / unmatched total /
 *     latest-run difference vs bank transactions) and capped CSV
 *     export;
 *   - full create/update with a REAL picked `accountId` (this surface
 *     never mints placeholder ObjectIds — fixing the legacy dialog's
 *     behaviour) and period sanity checks;
 *   - "Complete run" transition (sets `finalizedAt`).
 *
 * The statement-line matching engine stays in the legacy
 * `crm-reconciliation.actions.ts` flow — deliberately NOT wired here
 * (spec §3.17).
 *
 * NB: the crate is crm-common style — list pagination is 0-INDEXED on
 * the wire, so these actions translate the kit's 1-based pages.
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
  sabcrmFinanceBankTransactionsApi,
  sabcrmFinancePaymentAccountsApi,
  sabcrmFinanceReconciliationApi,
  type SabcrmReconciliationDoc,
  type SabcrmReconciliationUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmReconciliationStatus } from '@/lib/rust-client/crm-reconciliation';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_RECONCILIATION_TRANSITIONS,
  type SabcrmReconciliationFullInput,
  type SabcrmReconciliationFullPatch,
  type SabcrmReconciliationKpis,
  type SabcrmReconciliationListFilters,
  type SabcrmReconciliationListPage,
  type SabcrmReconciliationListRow,
} from './sabcrm-finance-reconciliation.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const RECONCILIATION_PATH = '/sabcrm/finance/reconciliation';

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

/* ─── Account labels (batched; no N+1) ────────────────────────── */

interface AccountRef {
  label: string;
  currency: string;
}

/**
 * Batch-resolves payment-account ids to `{ label, currency }` with ONE
 * accounts list call (the crate caps at 100 — plenty for a project's
 * account book). Ids missing from page one fall back to one by-id
 * fetch each (still bounded by the page's unique ids).
 */
async function resolveAccountRefs(
  projectId: string,
  ids: string[],
): Promise<Map<string, AccountRef>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, AccountRef>();
  if (unique.length === 0) return map;

  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(projectId, {
      limit: 100,
      status: 'all',
    });
    for (const account of res.items) {
      map.set(String(account._id), {
        label: account.accountName || 'Unnamed account',
        currency: account.currency || 'INR',
      });
    }
  } catch {
    // Fall through to by-id resolution below.
  }

  await Promise.all(
    unique
      .filter((id) => !map.has(id))
      .map(async (id) => {
        try {
          const account = await sabcrmFinancePaymentAccountsApi.getById(
            projectId,
            id,
          );
          map.set(id, {
            label: account.accountName || 'Unnamed account',
            currency: account.currency || 'INR',
          });
        } catch {
          // Account gone — row renders "Unknown account".
        }
      }),
  );
  return map;
}

/**
 * Searches payment accounts for the toolbar's account filter and the
 * form's account Select — every option is a REAL account id with a
 * human label (this surface never mints placeholder ids).
 */
export async function searchSabcrmReconciliationAccounts(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(g.ctx.projectId, {
      limit: 12,
      q: q.trim() || undefined,
    });
    return {
      ok: true,
      data: res.items
        .filter((a) => a._id)
        .map((a) => ({
          id: String(a._id),
          label: a.accountName || 'Unnamed account',
          meta: [a.accountType, a.currency].filter(Boolean).join(' · ') ||
            undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search payment accounts.');
  }
}

/* ─── Row mapping ─────────────────────────────────────────────── */

function toListRow(
  doc: SabcrmReconciliationDoc,
  accountMap: Map<string, AccountRef>,
): SabcrmReconciliationListRow {
  const ref = accountMap.get(doc.accountId);
  return {
    id: doc._id,
    accountId: doc.accountId,
    accountLabel: ref?.label ?? null,
    currency: ref?.currency ?? 'INR',
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    openingBalance: doc.openingBalance ?? 0,
    closingBalance: doc.closingBalance ?? 0,
    matchedCount: doc.matchedCount ?? 0,
    unmatchedCount: doc.unmatchedCount ?? 0,
    notes: doc.notes ?? '',
    status: doc.status ?? 'in_progress',
    finalizedAt: doc.finalizedAt ?? null,
    createdAt: doc.createdAt,
  };
}

/** Inclusive `YYYY-MM-DD` refinement on `periodStart` (in-page). */
function inRange(
  doc: SabcrmReconciliationDoc,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  const day = (doc.periodStart ?? '').slice(0, 10);
  if (!day) return false;
  return day >= (from ?? '0000-00-00') && day <= (to ?? '9999-12-31');
}

/* ─── List page ───────────────────────────────────────────────── */

/**
 * Lists a page of display-ready reconciliation rows with account
 * labels resolved in one batched pass.
 */
export async function listSabcrmReconciliationsPage(
  filters: SabcrmReconciliationListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceReconciliationApi.list(g.ctx.projectId, {
      // crm-common pagination is 0-indexed.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status ? filters.status : 'all',
      accountId: filters.accountId || undefined,
    });
    const pageDocs = res.items.filter((d) =>
      inRange(d, filters.from, filters.to),
    );
    const accountMap = await resolveAccountRefs(
      g.ctx.projectId,
      pageDocs.map((d) => d.accountId),
    );
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, accountMap)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list reconciliation runs.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

const SCAN_MAX_PAGES = 5;

async function scanAll(
  projectId: string,
  filters?: Pick<
    SabcrmReconciliationListFilters,
    'q' | 'status' | 'accountId'
  >,
): Promise<{ docs: SabcrmReconciliationDoc[]; sampled: boolean }> {
  const docs: SabcrmReconciliationDoc[] = [];
  let sampled = false;
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    const res = await sabcrmFinanceReconciliationApi.list(projectId, {
      page,
      limit: 100,
      q: filters?.q || undefined,
      status: filters?.status ? filters.status : 'all',
      accountId: filters?.accountId || undefined,
    });
    docs.push(...res.items);
    if (!res.hasMore || res.items.length === 0) break;
    if (page === SCAN_MAX_PAGES - 1) sampled = true;
  }
  return { docs, sampled };
}

/**
 * Net bank-transaction flow (credits − debits) for an account over an
 * inclusive period — feeds the latest run's "difference" KPI. Capped
 * at 200 transactions; flips `sampled` when the cap is hit.
 */
async function netBankFlow(
  projectId: string,
  accountId: string,
  from: string,
  to: string,
): Promise<{ net: number; sampled: boolean } | null> {
  try {
    let net = 0;
    let sampled = false;
    for (let page = 0; page < 2; page += 1) {
      const res = await sabcrmFinanceBankTransactionsApi.list(projectId, {
        page,
        limit: 100,
        accountId,
        from,
        to,
        status: 'all',
      });
      for (const tx of res.items) {
        net += tx.type === 'credit' ? tx.amount : -tx.amount;
      }
      if (!res.hasMore || res.items.length === 0) break;
      if (page === 1) sampled = true;
    }
    return { net: round2(net), sampled };
  } catch {
    return null;
  }
}

/** Computes the KPI strip over a capped scan (up to 500 runs). */
export async function getSabcrmReconciliationKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs, sampled } = await scanAll(g.ctx.projectId);
    let inProgressCount = 0;
    let completedCount = 0;
    let unmatchedTotal = 0;
    let lastCompletedAt: string | null = null;
    let latest: SabcrmReconciliationDoc | null = null;

    for (const doc of docs) {
      const status = doc.status ?? 'in_progress';
      if (status === 'archived') continue;
      if (status === 'in_progress') inProgressCount += 1;
      if (status === 'completed') {
        completedCount += 1;
        const at = doc.finalizedAt ?? doc.updatedAt ?? null;
        if (at && (!lastCompletedAt || at > lastCompletedAt)) {
          lastCompletedAt = at;
        }
      }
      unmatchedTotal += doc.unmatchedCount ?? 0;
      const key = doc.createdAt ?? doc.periodEnd ?? '';
      const latestKey = latest?.createdAt ?? latest?.periodEnd ?? '';
      if (!latest || key > latestKey) latest = doc;
    }

    let latestDifference: number | null = null;
    let currency = 'INR';
    let flowSampled = false;
    if (latest) {
      const accountMap = await resolveAccountRefs(g.ctx.projectId, [
        latest.accountId,
      ]);
      currency = accountMap.get(latest.accountId)?.currency ?? 'INR';
      const flow = await netBankFlow(
        g.ctx.projectId,
        latest.accountId,
        (latest.periodStart ?? '').slice(0, 10),
        (latest.periodEnd ?? '').slice(0, 10),
      );
      if (flow) {
        latestDifference = round2(
          (latest.closingBalance ?? 0) -
            (latest.openingBalance ?? 0) -
            flow.net,
        );
        flowSampled = flow.sampled;
      }
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        inProgressCount,
        completedCount,
        lastCompletedAt,
        unmatchedTotal,
        latestDifference,
        currency,
        sampled: sampled || flowSampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute reconciliation KPIs.');
  }
}

/* ─── CSV export ──────────────────────────────────────────────── */

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmReconciliationRows(
  filters: SabcrmReconciliationListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs } = await scanAll(g.ctx.projectId, filters);
    const rows = docs.filter((d) => inRange(d, filters.from, filters.to));
    const accountMap = await resolveAccountRefs(
      g.ctx.projectId,
      rows.map((d) => d.accountId),
    );
    return { ok: true, data: rows.map((d) => toListRow(d, accountMap)) };
  } catch (e) {
    return fail(e, 'Failed to export reconciliation runs.');
  }
}

/* ─── By-id (deep-linked edit dialog) ─────────────────────────── */

/** Loads one run as a display row (cold `?edit=` deep links). */
export async function getSabcrmReconciliationRow(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationListRow>> {
  if (!id) return { ok: false, error: 'Run id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmFinanceReconciliationApi.getById(
      g.ctx.projectId,
      id,
    );
    const accountMap = await resolveAccountRefs(g.ctx.projectId, [
      doc.accountId,
    ]);
    return { ok: true, data: toListRow(doc, accountMap) };
  } catch (e) {
    return fail(e, 'Failed to load the reconciliation run.');
  }
}

/* ─── Create / update ─────────────────────────────────────────── */

function cleanBalance(
  v: number | undefined,
  label: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} must be a number.` };
  }
  return { ok: true, value: round2(n) };
}

/**
 * Starts a reconciliation run from the FULL dialog form. The account
 * is a REAL picked payment account (the legacy dialog minted a
 * placeholder ObjectId — this action refuses to).
 */
export async function createSabcrmReconciliationFull(
  input: SabcrmReconciliationFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationDoc>> {
  if (!input?.accountId || !ObjectId.isValid(input.accountId)) {
    return { ok: false, error: 'Pick the account to reconcile.' };
  }
  const startIso = input.periodStart ? toIso(input.periodStart) : null;
  if (!startIso) {
    return { ok: false, error: 'A valid period start is required.' };
  }
  const endIso = input.periodEnd ? toIso(input.periodEnd) : null;
  if (!endIso) return { ok: false, error: 'A valid period end is required.' };
  if (endIso < startIso) {
    return { ok: false, error: "The period end can't be before its start." };
  }
  const opening = cleanBalance(input.openingBalance, 'Opening balance');
  if (!opening.ok) return { ok: false, error: opening.error };
  const closing = cleanBalance(input.closingBalance, 'Closing balance');
  if (!closing.ok) return { ok: false, error: closing.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceReconciliationApi.create(
      g.ctx.projectId,
      {
        accountId: input.accountId,
        periodStart: startIso,
        periodEnd: endIso,
        openingBalance: opening.value,
        closingBalance: closing.value,
        notes: input.notes?.trim() || undefined,
      },
    );
    revalidatePath(RECONCILIATION_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to start the reconciliation run.');
  }
}

/** Full-form partial update (account, period, balances, notes). */
export async function updateSabcrmReconciliationFull(
  id: string,
  patch: SabcrmReconciliationFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationDoc>> {
  if (!id) return { ok: false, error: 'Run id is required.' };

  const wire: SabcrmReconciliationUpdateInput = {};
  if (patch.accountId !== undefined) {
    if (!patch.accountId || !ObjectId.isValid(patch.accountId)) {
      return { ok: false, error: 'Pick the account to reconcile.' };
    }
    wire.accountId = patch.accountId;
  }
  if (patch.periodStart !== undefined) {
    const iso = toIso(patch.periodStart);
    if (!iso) return { ok: false, error: 'The period start is invalid.' };
    wire.periodStart = iso;
  }
  if (patch.periodEnd !== undefined) {
    const iso = toIso(patch.periodEnd);
    if (!iso) return { ok: false, error: 'The period end is invalid.' };
    wire.periodEnd = iso;
  }
  if (
    wire.periodStart &&
    wire.periodEnd &&
    wire.periodEnd < wire.periodStart
  ) {
    return { ok: false, error: "The period end can't be before its start." };
  }
  if (patch.openingBalance !== undefined) {
    const opening = cleanBalance(patch.openingBalance, 'Opening balance');
    if (!opening.ok) return { ok: false, error: opening.error };
    wire.openingBalance = opening.value;
  }
  if (patch.closingBalance !== undefined) {
    const closing = cleanBalance(patch.closingBalance, 'Closing balance');
    if (!closing.ok) return { ok: false, error: closing.error };
    wire.closingBalance = closing.value;
  }
  if (patch.notes !== undefined) wire.notes = patch.notes.trim();
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceReconciliationApi.getById(
      g.ctx.projectId,
      id,
    );
    if ((current.status ?? 'in_progress') === 'completed') {
      return {
        ok: false,
        error: 'Completed runs are locked — start a new run instead.',
      };
    }
    const data = await sabcrmFinanceReconciliationApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(RECONCILIATION_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the reconciliation run.');
  }
}

/* ─── Complete run ────────────────────────────────────────────── */

/**
 * Completes an in-progress run (validated against the transition map)
 * and stamps `finalizedAt`.
 */
export async function completeSabcrmReconciliationRun(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationDoc>> {
  if (!id) return { ok: false, error: 'Run id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceReconciliationApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'in_progress') as CrmReconciliationStatus;
    if (!SABCRM_RECONCILIATION_TRANSITIONS[from]?.includes('completed')) {
      return {
        ok: false,
        error: `Can't complete a run that is "${from.replace('_', ' ')}".`,
      };
    }
    const data = await sabcrmFinanceReconciliationApi.update(
      g.ctx.projectId,
      id,
      { status: 'completed', finalizedAt: new Date().toISOString() },
    );
    revalidatePath(RECONCILIATION_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to complete the reconciliation run.');
  }
}
