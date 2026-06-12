'use server';

/**
 * SabCRM Finance — chart-of-accounts surface server actions
 * (`/sabcrm/finance/accounts`, crate `crm-chart-of-accounts`).
 *
 * Full doc-surface adopter actions for ledger heads:
 *
 *   - paged display-ready list (account-group labels resolved with ONE
 *     groups list call; parent-account labels in ONE parallel pass
 *     over the page's unique parent ids — no N+1);
 *   - account-group options for the dialog's group Select;
 *   - KPI scan (counts per type / inactive) and capped CSV export;
 *   - full create/update (group Select, parent EntityPicker, opening
 *     balance, active flag, notes — every authorable crate field);
 *   - archive / restore status flips (kept in sync with `isActive`).
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
  sabcrmFinanceAccountGroupsApi,
  sabcrmFinanceAccountsApi,
  type SabcrmChartOfAccountDoc,
  type SabcrmChartOfAccountUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmChartOfAccountStatus,
  CrmChartOfAccountType,
} from '@/lib/rust-client/crm-chart-of-accounts';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_ACCOUNT_TYPES,
  type SabcrmChartOfAccountFullInput,
  type SabcrmChartOfAccountFullPatch,
  type SabcrmChartOfAccountKpis,
  type SabcrmChartOfAccountListFilters,
  type SabcrmChartOfAccountListPage,
  type SabcrmChartOfAccountListRow,
} from './sabcrm-finance-chart-of-accounts.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const ACCOUNTS_PATH = '/sabcrm/finance/accounts';

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

/* ─── Label resolution (batched; no N+1) ──────────────────────── */

/** ONE groups list call resolves every group label on the page. */
async function resolveGroupLabels(
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await sabcrmFinanceAccountGroupsApi.list(projectId, {
      limit: 100,
      status: 'all',
    });
    for (const group of res.items) {
      if (group._id && group.name) map.set(group._id, group.name);
    }
  } catch {
    // Groups engine down — rows render without group labels.
  }
  return map;
}

/** ONE parallel pass over the page's unique parent ids. */
async function resolveParentLabels(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const account = await sabcrmFinanceAccountsApi.getById(projectId, id);
        map.set(id, account.name);
      } catch {
        // Parent gone — row renders "Unknown account".
      }
    }),
  );
  return map;
}

/**
 * Account-group options for the dialog's group Select. Every option is
 * a REAL group id with a human label.
 */
export async function listSabcrmChartAccountGroupOptions(
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceAccountGroupsApi.list(g.ctx.projectId, {
      limit: 100,
    });
    return {
      ok: true,
      data: res.items
        .filter((group) => group._id)
        .map((group) => ({
          id: group._id,
          label: group.name || 'Unnamed group',
          meta: group.nature || undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to list account groups.');
  }
}

/* ─── Row mapping ─────────────────────────────────────────────── */

function toListRow(
  doc: SabcrmChartOfAccountDoc,
  groupMap: Map<string, string>,
  parentMap: Map<string, string>,
): SabcrmChartOfAccountListRow {
  return {
    id: doc._id,
    name: doc.name,
    code: doc.code ?? '',
    accountType: doc.accountType ?? '',
    accountGroupId: doc.accountGroupId ?? '',
    groupLabel: doc.accountGroupId
      ? (groupMap.get(doc.accountGroupId) ?? null)
      : null,
    parentId: doc.parentId ?? '',
    parentLabel: doc.parentId ? (parentMap.get(doc.parentId) ?? null) : null,
    openingBalance: doc.openingBalance ?? 0,
    currency: doc.currency || 'INR',
    isActive: doc.isActive !== false && doc.status !== 'archived',
    status: doc.status ?? 'active',
    notes: doc.notes ?? '',
    createdAt: doc.createdAt,
  };
}

/** Inclusive `YYYY-MM-DD` refinement on `createdAt` (in-page). */
function inRange(
  doc: SabcrmChartOfAccountDoc,
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
 * Lists a page of display-ready ledger-head rows with group + parent
 * labels resolved in batched passes.
 */
export async function listSabcrmChartOfAccountsPage(
  filters: SabcrmChartOfAccountListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceAccountsApi.list(g.ctx.projectId, {
      // crm-common pagination is 0-indexed.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status ? filters.status : 'all',
      accountType: filters.accountType || undefined,
      accountGroupId: filters.accountGroupId || undefined,
    });
    const pageDocs = res.items.filter((d) =>
      inRange(d, filters.from, filters.to),
    );
    const [groupMap, parentMap] = await Promise.all([
      resolveGroupLabels(g.ctx.projectId),
      resolveParentLabels(
        g.ctx.projectId,
        pageDocs.map((d) => d.parentId ?? ''),
      ),
    ]);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, groupMap, parentMap)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list the chart of accounts.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

const SCAN_MAX_PAGES = 5;

async function scanAll(
  projectId: string,
  filters?: Pick<
    SabcrmChartOfAccountListFilters,
    'q' | 'status' | 'accountType' | 'accountGroupId'
  >,
): Promise<{ docs: SabcrmChartOfAccountDoc[]; sampled: boolean }> {
  const docs: SabcrmChartOfAccountDoc[] = [];
  let sampled = false;
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    const res = await sabcrmFinanceAccountsApi.list(projectId, {
      page,
      limit: 100,
      q: filters?.q || undefined,
      status: filters?.status ? filters.status : 'all',
      accountType: filters?.accountType || undefined,
      accountGroupId: filters?.accountGroupId || undefined,
    });
    docs.push(...res.items);
    if (!res.hasMore || res.items.length === 0) break;
    if (page === SCAN_MAX_PAGES - 1) sampled = true;
  }
  return { docs, sampled };
}

/** Computes the KPI strip over a capped scan (up to 500 accounts). */
export async function getSabcrmChartOfAccountKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs, sampled } = await scanAll(g.ctx.projectId);
    const byType: Record<string, number> = {};
    let activeCount = 0;
    let inactiveCount = 0;

    for (const doc of docs) {
      const active = doc.isActive !== false && doc.status !== 'archived';
      if (active) activeCount += 1;
      else inactiveCount += 1;
      const type = doc.accountType ?? 'other';
      byType[type] = (byType[type] ?? 0) + 1;
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        activeCount,
        inactiveCount,
        byType,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute chart-of-accounts KPIs.');
  }
}

/* ─── CSV export ──────────────────────────────────────────────── */

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmChartOfAccountRows(
  filters: SabcrmChartOfAccountListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs } = await scanAll(g.ctx.projectId, filters);
    const rows = docs.filter((d) => inRange(d, filters.from, filters.to));
    const [groupMap, parentMap] = await Promise.all([
      resolveGroupLabels(g.ctx.projectId),
      resolveParentLabels(
        g.ctx.projectId,
        rows.map((d) => d.parentId ?? ''),
      ),
    ]);
    return {
      ok: true,
      data: rows.map((d) => toListRow(d, groupMap, parentMap)),
    };
  } catch (e) {
    return fail(e, 'Failed to export the chart of accounts.');
  }
}

/* ─── By-id (deep-linked edit dialog) ─────────────────────────── */

/** Loads one ledger head as a display row (cold `?edit=` deep links). */
export async function getSabcrmChartOfAccountRow(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountListRow>> {
  if (!id) return { ok: false, error: 'Account id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmFinanceAccountsApi.getById(g.ctx.projectId, id);
    const [groupMap, parentMap] = await Promise.all([
      resolveGroupLabels(g.ctx.projectId),
      resolveParentLabels(g.ctx.projectId, [doc.parentId ?? '']),
    ]);
    return { ok: true, data: toListRow(doc, groupMap, parentMap) };
  } catch (e) {
    return fail(e, 'Failed to load the account.');
  }
}

/* ─── Create / update ─────────────────────────────────────────── */

const ACCOUNT_TYPES = new Set<string>(
  SABCRM_ACCOUNT_TYPES.map((t) => t.value),
);

function validateAccountInput(
  input: SabcrmChartOfAccountFullInput | SabcrmChartOfAccountFullPatch,
  partial: boolean,
): string | null {
  if (!partial || input.name !== undefined) {
    if (!input.name?.trim()) return 'An account name is required.';
  }
  if (input.accountType !== undefined && input.accountType !== null) {
    if (!ACCOUNT_TYPES.has(input.accountType)) {
      return 'Pick a valid account type.';
    }
  }
  if (input.accountGroupId && !ObjectId.isValid(input.accountGroupId)) {
    return 'Pick a valid account group.';
  }
  if (input.parentId && !ObjectId.isValid(input.parentId)) {
    return 'Pick a valid parent account.';
  }
  if (input.openingBalance !== undefined) {
    const n = Number(input.openingBalance);
    if (!Number.isFinite(n)) return 'Opening balance must be a number.';
  }
  return null;
}

/** Creates a ledger head from the FULL dialog form. */
export async function createSabcrmChartOfAccountFull(
  input: SabcrmChartOfAccountFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountDoc>> {
  const problem = validateAccountInput(input, false);
  if (problem) return { ok: false, error: problem };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceAccountsApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      code: input.code?.trim() || undefined,
      accountGroupId: input.accountGroupId || undefined,
      accountType: input.accountType,
      parentId: input.parentId || undefined,
      openingBalance:
        input.openingBalance === undefined
          ? undefined
          : round2(Number(input.openingBalance)),
      currency: input.currency?.trim().toUpperCase() || undefined,
      isActive: input.isActive,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(ACCOUNTS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the account.');
  }
}

/** Full-form partial update. */
export async function updateSabcrmChartOfAccountFull(
  id: string,
  patch: SabcrmChartOfAccountFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountDoc>> {
  if (!id) return { ok: false, error: 'Account id is required.' };
  const problem = validateAccountInput(patch, true);
  if (problem) return { ok: false, error: problem };
  if (patch.parentId && patch.parentId === id) {
    return { ok: false, error: "An account can't be its own parent." };
  }

  const wire: SabcrmChartOfAccountUpdateInput = {};
  if (patch.name !== undefined) wire.name = patch.name.trim();
  if (patch.code !== undefined) wire.code = patch.code.trim();
  if (patch.accountGroupId !== undefined) {
    wire.accountGroupId = patch.accountGroupId || undefined;
  }
  if (patch.accountType !== undefined) wire.accountType = patch.accountType;
  if (patch.parentId !== undefined) {
    wire.parentId = patch.parentId || undefined;
  }
  if (patch.openingBalance !== undefined) {
    wire.openingBalance = round2(Number(patch.openingBalance));
  }
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.isActive !== undefined) wire.isActive = patch.isActive;
  if (patch.notes !== undefined) wire.notes = patch.notes.trim();
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceAccountsApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(ACCOUNTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the account.');
  }
}

/* ─── Archive / restore ───────────────────────────────────────── */

/** Archives or restores an account (kept in sync with `isActive`). */
export async function setSabcrmChartOfAccountStatus(
  id: string,
  next: CrmChartOfAccountStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountDoc>> {
  if (!id) return { ok: false, error: 'Account id is required.' };
  if (next !== 'active' && next !== 'archived') {
    return { ok: false, error: 'Invalid account status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceAccountsApi.update(g.ctx.projectId, id, {
      status: next,
      isActive: next === 'active',
    });
    revalidatePath(ACCOUNTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the account status.');
  }
}
