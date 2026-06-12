'use server';

/**
 * SabCRM Finance — petty-cash-surface server actions (spec §3.15).
 *
 * Full doc-surface data paths for `/sabcrm/finance/petty-cash`:
 *
 *   - display-ready paged list rows (custodian labels batch-resolved in
 *     ONE pass for rows missing the denormalised `custodianName`);
 *   - KPI strip (total float balance / active / low-balance / closed);
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (branch, custodian picker + free-text
 *     fallback, opening balance, currency, notes);
 *   - status transitions (`active ⇄ closed`) validated against
 *     `SABCRM_PETTY_CASH_TRANSITIONS`.
 *
 * Wire traps handled here: extended-JSON deflation (`{$oid}`/`{$date}`)
 * and the crm-common 0-INDEXED pagination (the kit's 1-based page is
 * decremented before it reaches the engine). `currentBalance` is
 * system-managed (seeded = opening, drained by petty-cash vouchers) —
 * this surface never writes it.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinancePettyCashApi,
  type SabcrmPettyCashFloatDoc,
  type SabcrmPettyCashUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmPettyCashStatus } from '@/lib/rust-client/crm-petty-cash';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import { resolveSabcrmFinanceParties } from './sabcrm-finance-invoices.actions';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_PETTY_CASH_TRANSITIONS,
  type SabcrmPettyCashFullInput,
  type SabcrmPettyCashFullPatch,
  type SabcrmPettyCashKpis,
  type SabcrmPettyCashListFilters,
  type SabcrmPettyCashListPage,
  type SabcrmPettyCashListRow,
} from './sabcrm-finance-petty-cash.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const FINANCE_PETTY_CASH_PATH = '/sabcrm/finance/petty-cash';

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

/* ─── Rows (batch-resolved custodian labels — no N+1) ─────────── */

const LOW_BALANCE_RATIO = 0.1;

async function custodianLabelMap(
  docs: SabcrmPettyCashFloatDoc[],
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [
    ...new Set(
      docs
        .filter(
          (d) =>
            !d.custodianName &&
            d.custodianId &&
            ObjectId.isValid(d.custodianId),
        )
        .map((d) => d.custodianId as string),
    ),
  ];
  if (ids.length === 0) return map;
  const res = await resolveSabcrmFinanceParties(ids, projectId);
  if (res.ok) for (const ref of res.data) map.set(ref.id, ref.label);
  return map;
}

function toListRow(
  doc: SabcrmPettyCashFloatDoc,
  custodians: Map<string, string>,
): SabcrmPettyCashListRow {
  const opening = doc.openingBalance ?? 0;
  const current = doc.currentBalance ?? opening;
  const status = (doc.status ?? 'active') as CrmPettyCashStatus;
  return {
    id: doc._id,
    branchLabel: doc.branchName ?? '',
    custodianId: doc.custodianId ?? '',
    custodianLabel:
      doc.custodianName ||
      (doc.custodianId ? (custodians.get(doc.custodianId) ?? null) : null),
    openingBalance: opening,
    currentBalance: current,
    currency: doc.currency || 'INR',
    utilisation: opening > 0 ? current / opening : 1,
    lowBalance: status === 'active' && opening > 0 && current < opening * LOW_BALANCE_RATIO,
    status,
    createdAt: doc.createdAt ?? '',
  };
}

/** In-page inclusive date-range refinement on the creation date. */
function inRange(
  docs: SabcrmPettyCashFloatDoc[],
  from?: string,
  to?: string,
): SabcrmPettyCashFloatDoc[] {
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
 * Lists a page of display-ready float rows. NB: crm-common pages are
 * 0-indexed — the kit's 1-based `page` is decremented here.
 */
export async function listSabcrmPettyCashPage(
  filters: SabcrmPettyCashListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinancePettyCashApi.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    const docs = deflateDocs<SabcrmPettyCashFloatDoc>(res.items);
    const pageDocs = inRange(docs, filters.from, filters.to);
    const custodians = await custodianLabelMap(pageDocs, g.ctx.projectId);

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, custodians)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list petty cash floats.');
  }
}

/** Pages the list endpoint scans for KPIs / export (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Capped fetch-all (500) for CSV export, honouring the filters. */
export async function exportSabcrmPettyCashRows(
  filters: SabcrmPettyCashListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPettyCashFloatDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinancePettyCashApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      docs.push(...deflateDocs<SabcrmPettyCashFloatDoc>(res.items));
      if (!res.hasMore) break;
    }
    const rows = inRange(docs, filters.from, filters.to);
    const custodians = await custodianLabelMap(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, custodians)) };
  } catch (e) {
    return fail(e, 'Failed to export petty cash floats.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** Computes the KPI strip over a capped scan (up to 500 floats). */
export async function getSabcrmPettyCashKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPettyCashFloatDoc[] = [];
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinancePettyCashApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...deflateDocs<SabcrmPettyCashFloatDoc>(res.items));
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1) sampled = true;
    }

    const currencyVotes = new Map<string, number>();
    let totalFloatBalance = 0;
    let activeCount = 0;
    let lowBalanceCount = 0;
    let closedCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'active') as CrmPettyCashStatus;
      const opening = doc.openingBalance ?? 0;
      const current = doc.currentBalance ?? opening;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      totalFloatBalance += current;
      if (status === 'active') {
        activeCount += 1;
        if (opening > 0 && current < opening * LOW_BALANCE_RATIO) {
          lowBalanceCount += 1;
        }
      }
      if (status === 'closed') closedCount += 1;
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
        totalFloatBalance: round2(totalFloatBalance),
        activeCount,
        lowBalanceCount,
        closedCount,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute petty cash KPIs.');
  }
}

/* ─── Detail fetch ────────────────────────────────────────────── */

/** Fetches ONE float, extended-JSON deflated. */
export async function getSabcrmPettyCashFloatFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashFloatDoc>> {
  if (!id) return { ok: false, error: 'Float id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = deflateDoc<SabcrmPettyCashFloatDoc>(
      await sabcrmFinancePettyCashApi.getById(g.ctx.projectId, id),
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the petty cash float.');
  }
}

/* ─── Full-form create / update ───────────────────────────────── */

function cleanCustodian(input: {
  custodianId?: string;
  custodianName?: string;
}): { id?: string; name?: string } | { error: string } {
  const id = input.custodianId?.trim() || undefined;
  const name = input.custodianName?.trim() || undefined;
  if (id && !ObjectId.isValid(id)) {
    return { error: 'The custodian reference is invalid.' };
  }
  return { id, name };
}

/**
 * Creates a petty-cash float from the FULL form. The custodian is a
 * REAL picked person record (id + name) or a free-text name — never a
 * minted placeholder id. Floats start `active` with
 * `currentBalance = openingBalance` (crate behaviour).
 */
export async function createSabcrmPettyCashFull(
  input: SabcrmPettyCashFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashFloatDoc>> {
  const openingBalance = Number(input?.openingBalance);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return {
      ok: false,
      error: 'Opening balance must be a non-negative number.',
    };
  }
  if (!input.branchName?.trim() && !input.custodianName?.trim() && !input.custodianId) {
    return {
      ok: false,
      error: 'Give the float a branch or a custodian so it stays identifiable.',
    };
  }
  const custodian = cleanCustodian(input);
  if ('error' in custodian) return { ok: false, error: custodian.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinancePettyCashApi.create(g.ctx.projectId, {
      branchName: input.branchName?.trim() || undefined,
      custodianId: custodian.id,
      custodianName: custodian.name,
      openingBalance: round2(openingBalance),
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(FINANCE_PETTY_CASH_PATH);
    return {
      ok: true,
      data: deflateDoc<SabcrmPettyCashFloatDoc>(created.entity),
    };
  } catch (e) {
    return fail(e, 'Failed to create the petty cash float.');
  }
}

/** Full-form partial update (NOT status / currentBalance). */
export async function updateSabcrmPettyCashFull(
  id: string,
  patch: SabcrmPettyCashFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashFloatDoc>> {
  if (!id) return { ok: false, error: 'Float id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmPettyCashUpdateInput = {};
  if (patch.branchName !== undefined) wire.branchName = patch.branchName.trim();
  if (patch.custodianId !== undefined || patch.custodianName !== undefined) {
    const custodian = cleanCustodian(patch);
    if ('error' in custodian) return { ok: false, error: custodian.error };
    wire.custodianId = custodian.id;
    wire.custodianName = custodian.name;
  }
  if (patch.openingBalance !== undefined) {
    const opening = Number(patch.openingBalance);
    if (!Number.isFinite(opening) || opening < 0) {
      return {
        ok: false,
        error: 'Opening balance must be a non-negative number.',
      };
    }
    wire.openingBalance = round2(opening);
  }
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = deflateDoc<SabcrmPettyCashFloatDoc>(
      await sabcrmFinancePettyCashApi.update(g.ctx.projectId, id, wire),
    );
    revalidatePath(FINANCE_PETTY_CASH_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the petty cash float.');
  }
}

/* ─── Status transitions ──────────────────────────────────────── */

/** Applies a workflow transition (`active ⇄ closed`), validated. */
export async function transitionSabcrmPettyCashStatus(
  id: string,
  next: CrmPettyCashStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashFloatDoc>> {
  if (!id) return { ok: false, error: 'Float id is required.' };
  if (!(next in SABCRM_PETTY_CASH_TRANSITIONS)) {
    return { ok: false, error: 'Invalid float status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = deflateDoc<SabcrmPettyCashFloatDoc>(
      await sabcrmFinancePettyCashApi.getById(g.ctx.projectId, id),
    );
    const from = (current.status ?? 'active') as CrmPettyCashStatus;
    if (!SABCRM_PETTY_CASH_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a float from "${from}" to "${next}".`,
      };
    }
    const data = deflateDoc<SabcrmPettyCashFloatDoc>(
      await sabcrmFinancePettyCashApi.update(g.ctx.projectId, id, {
        status: next,
      }),
    );
    revalidatePath(FINANCE_PETTY_CASH_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the float status.');
  }
}
