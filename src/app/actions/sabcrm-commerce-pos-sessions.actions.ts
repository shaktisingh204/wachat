'use server';

/**
 * SabCRM Commerce — POS sessions doc-surface actions (spec WI-18).
 *
 * The paged/display-ready verbs the kit list + cash-summary detail
 * need on top of the back-compat module (`sabcrm-commerce.actions.ts`
 * keeps `openSabcrmPosSession` / `closeSabcrmPosSession` /
 * `reconcileSabcrmPosSession` / `archiveSabcrmPosSession`) and the
 * shared `getSabcrmPosSession` (docs module):
 *
 *   - `listSabcrmPosSessionsPage` — paged display-ready rows (commerce
 *     envelope is 0-indexed → `page - 1` here only);
 *   - `exportSabcrmPosSessionRows` — capped CSV fetch-all;
 *   - `getSabcrmPosSessionKpis` — KPI strip.
 *
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommercePosApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmPosSessionDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmPosSessionKpis,
  SabcrmPosSessionListFilters,
  SabcrmPosSessionListPage,
  SabcrmPosSessionListRow,
} from './sabcrm-commerce-pos-sessions.actions.types';

/* ─── Gate (mirrors sabcrm-commerce.actions.ts verbatim) ─────────── */

const MODULE_KEY = 'sabcrm';

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
  const projectId = requested;

  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* ─── Mapping ────────────────────────────────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

export function posSessionToRow(doc: CrmPosSessionDoc): SabcrmPosSessionListRow {
  return {
    id: doc._id,
    terminalId: doc.terminalId,
    openedBy: doc.openedBy,
    openedAt: doc.openedAt,
    openingCash: doc.openingCash ?? 0,
    closedAt: doc.closedAt ?? null,
    closingCash: doc.closingCash ?? null,
    expectedCash: doc.expectedCash ?? null,
    discrepancy: doc.discrepancy ?? null,
    status: doc.status,
    notes: doc.notes ?? null,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of display-ready POS-session rows. */
export async function listSabcrmPosSessionsPage(
  filters: SabcrmPosSessionListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosSessionListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommercePosApi.sessions.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    return {
      ok: true,
      data: { rows: res.items.map(posSessionToRow), page, hasMore: res.hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to list POS sessions.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmPosSessionRows(
  filters: SabcrmPosSessionListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosSessionListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows: SabcrmPosSessionListRow[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommercePosApi.sessions.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      rows.push(...res.items.map(posSessionToRow));
      if (!res.hasMore) break;
    }
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export POS sessions.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmPosSessionKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPosSessionKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommercePosApi.sessions.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    let openCount = 0;
    let closedCount = 0;
    let openingCashTotal = 0;
    let discrepancyTotal = 0;
    for (const s of res.items) {
      if (s.status === 'open') openCount += 1;
      if (s.status === 'closed' || s.status === 'reconciled') closedCount += 1;
      openingCashTotal += s.openingCash ?? 0;
      discrepancyTotal += Math.abs(s.discrepancy ?? 0);
    }
    return {
      ok: true,
      data: {
        currency: 'INR',
        count: res.items.length,
        openCount,
        closedCount,
        openingCashTotal,
        discrepancyTotal,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute POS-session KPIs.');
  }
}
