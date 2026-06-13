'use server';

/**
 * SabCRM Commerce — POS transactions doc-surface actions (spec WI-19).
 *
 * The paged/display-ready verbs the kit list + DocDetailPage need on
 * top of the back-compat module (`voidSabcrmPosTransaction`) and the
 * shared docs module (`getSabcrmPosTransaction`,
 * `refundSabcrmPosTransaction`, `listSabcrmPosTransactionRefunds`):
 *
 *   - `listSabcrmPosTransactionsPage` — display-ready rows with session
 *     labels + customer names BATCH-resolved (one sessions list call +
 *     one parties resolve per page — never N+1);
 *   - `exportSabcrmPosTransactionRows` — capped CSV fetch-all;
 *   - `getSabcrmPosTransactionKpis` — KPI strip.
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
import type { CrmPosTransactionDoc } from '@/lib/rust-client/sabcrm-commerce';
import { resolveSabcrmFinanceParties } from './sabcrm-finance-invoices.actions';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmPosTransactionKpis,
  SabcrmPosTransactionListFilters,
  SabcrmPosTransactionListPage,
  SabcrmPosTransactionListRow,
} from './sabcrm-commerce-pos-transactions.actions.types';

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

function dayKey(iso: string | undefined | null): string {
  return (iso ?? '').slice(0, 10);
}

/* ─── Batch label resolution ─────────────────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

/** ONE sessions list call → terminal·date label map (sessions are few). */
async function sessionLabelMap(
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await sabcrmCommercePosApi.sessions.list(projectId, {
      limit: 100,
    });
    for (const s of res.items) {
      if (s._id) {
        map.set(
          String(s._id),
          [s.terminalId, dayKey(s.openedAt)].filter(Boolean).join(' · '),
        );
      }
    }
  } catch {
    // Engine hiccup on the lookup must not kill the list.
  }
  return map;
}

/** Resolve every referenced customer id to a name in ONE parties pass. */
async function customerLabelMap(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const res = await resolveSabcrmFinanceParties(unique, projectId);
  if (res.ok) {
    for (const ref of res.data) map.set(ref.id, ref.label);
  }
  return map;
}

function toRow(
  doc: CrmPosTransactionDoc,
  sessions: Map<string, string>,
  customers: Map<string, string>,
): SabcrmPosTransactionListRow {
  const customerId = doc.customerId ?? null;
  return {
    id: doc._id,
    transactionNumber: doc.transactionNumber,
    createdAt: doc.createdAt,
    sessionId: doc.sessionId,
    sessionLabel: sessions.get(doc.sessionId) ?? null,
    customerId,
    customerLabel: customerId
      ? (customers.get(customerId) ?? 'Customer')
      : 'Walk-in',
    itemsCount: doc.lineItems?.length ?? 0,
    subtotal: doc.subtotal ?? 0,
    taxTotal: doc.taxTotal ?? 0,
    total: doc.total ?? 0,
    paymentMethod: doc.paymentMethod,
    status: doc.status,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of display-ready transaction rows (labels resolved). */
export async function listSabcrmPosTransactionsPage(
  filters: SabcrmPosTransactionListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosTransactionListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommercePosApi.transactions.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      sessionId: filters.sessionId || undefined,
    });
    const [sessions, customers] = await Promise.all([
      sessionLabelMap(g.ctx.projectId),
      customerLabelMap(
        g.ctx.projectId,
        res.items.map((t) => t.customerId).filter((id): id is string => Boolean(id)),
      ),
    ]);
    return {
      ok: true,
      data: {
        rows: res.items.map((t) => toRow(t, sessions, customers)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list POS transactions.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmPosTransactionRows(
  filters: SabcrmPosTransactionListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosTransactionListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmPosTransactionDoc[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommercePosApi.transactions.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        sessionId: filters.sessionId || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const [sessions, customers] = await Promise.all([
      sessionLabelMap(g.ctx.projectId),
      customerLabelMap(
        g.ctx.projectId,
        docs.map((t) => t.customerId).filter((id): id is string => Boolean(id)),
      ),
    ]);
    return {
      ok: true,
      data: docs.map((t) => toRow(t, sessions, customers)),
    };
  } catch (e) {
    return fail(e, 'Failed to export POS transactions.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmPosTransactionKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPosTransactionKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommercePosApi.transactions.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    let completedCount = 0;
    let completedTotal = 0;
    let refundedCount = 0;
    let voidedCount = 0;
    for (const t of res.items) {
      if (t.status === 'completed') {
        completedCount += 1;
        completedTotal += t.total ?? 0;
      } else if (t.status === 'voided') {
        voidedCount += 1;
      } else if (t.status === 'refunded' || t.status === 'partially_refunded') {
        refundedCount += 1;
      }
    }
    return {
      ok: true,
      data: {
        currency: 'INR',
        count: res.items.length,
        completedCount,
        completedTotal,
        refundedCount,
        voidedCount,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute POS-transaction KPIs.');
  }
}
