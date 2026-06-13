'use server';

/**
 * SabCRM Commerce — POS refunds doc-surface actions (spec WI-20).
 *
 * The paged/display-ready verbs the kit list + DocDetailPage need on
 * top of the back-compat module (`archiveSabcrmPosRefund`) and the
 * shared docs module (`getSabcrmPosRefund`,
 * `updateSabcrmPosRefundStatus`):
 *
 *   - `listSabcrmPosRefundsPage` — display-ready rows with the original
 *     transaction NUMBER batch-resolved (one parallel getById pass over
 *     the page's unique txn ids — never N+1);
 *   - `exportSabcrmPosRefundRows` — capped CSV fetch-all;
 *   - `getSabcrmPosRefundKpis` — KPI strip.
 *
 * Commerce envelope is 0-indexed → `page - 1` translated here only.
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommercePosApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmPosRefundDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmPosRefundUiStatus } from './sabcrm-commerce-docs.actions.types';
import type {
  SabcrmPosRefundKpis,
  SabcrmPosRefundListFilters,
  SabcrmPosRefundListPage,
  SabcrmPosRefundListRow,
} from './sabcrm-commerce-pos-refunds.actions.types';

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

/* ─── Transaction-number batch resolution ────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

/** Resolves the page's unique original-transaction ids to numbers in
 *  ONE parallel pass (capped at 100 unique ids). */
async function txnNumberMap(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const doc = await sabcrmCommercePosApi.transactions.getById(projectId, id);
        if (doc.transactionNumber) map.set(id, doc.transactionNumber);
      } catch {
        // Gone / wrong tenant — the row renders "Unknown".
      }
    }),
  );
  return map;
}

function toRow(
  doc: CrmPosRefundDoc,
  txns: Map<string, string>,
): SabcrmPosRefundListRow {
  return {
    id: doc._id,
    originalTransactionId: doc.originalTransactionId,
    originalTransactionNumber: txns.get(doc.originalTransactionId) ?? null,
    reason: doc.reason,
    refundTotal: doc.refundTotal ?? 0,
    refundMethod: doc.refundMethod,
    processedBy: doc.processedBy,
    processedAt: doc.processedAt,
    status: (doc.status ?? 'pending') as SabcrmPosRefundUiStatus,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of display-ready refund rows (txn numbers resolved). */
export async function listSabcrmPosRefundsPage(
  filters: SabcrmPosRefundListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosRefundListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommercePosApi.refunds.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    const txns = await txnNumberMap(
      g.ctx.projectId,
      res.items.map((r) => r.originalTransactionId),
    );
    return {
      ok: true,
      data: { rows: res.items.map((r) => toRow(r, txns)), page, hasMore: res.hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to list POS refunds.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmPosRefundRows(
  filters: SabcrmPosRefundListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosRefundListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmPosRefundDoc[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommercePosApi.refunds.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const txns = await txnNumberMap(
      g.ctx.projectId,
      docs.map((r) => r.originalTransactionId),
    );
    return { ok: true, data: docs.map((r) => toRow(r, txns)) };
  } catch (e) {
    return fail(e, 'Failed to export POS refunds.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmPosRefundKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPosRefundKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommercePosApi.refunds.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    let pendingCount = 0;
    let completedCount = 0;
    let refundedTotal = 0;
    for (const r of res.items) {
      const status = r.status ?? 'pending';
      if (status === 'pending') pendingCount += 1;
      if (status === 'completed') completedCount += 1;
      refundedTotal += r.refundTotal ?? 0;
    }
    return {
      ok: true,
      data: {
        currency: 'INR',
        count: res.items.length,
        pendingCount,
        completedCount,
        refundedTotal,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute POS-refund KPIs.');
  }
}
