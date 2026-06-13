'use server';

/**
 * SabCRM Commerce — POS holds doc-surface actions (spec WI-21).
 *
 * The paged/display-ready verbs the kit list needs on top of the
 * back-compat module (`voidSabcrmPosHold`) and the shared docs module
 * (`getSabcrmPosHold`):
 *
 *   - `listSabcrmPosHoldsPage` — display-ready rows with session labels
 *     + customer names BATCH-resolved (one sessions list call + one
 *     parties resolve per page — never N+1) and the cart value rolled
 *     up from line-item totals;
 *   - `exportSabcrmPosHoldRows` — capped CSV fetch-all;
 *   - `getSabcrmPosHoldKpis` — KPI strip.
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
import type { CrmPosHoldDoc } from '@/lib/rust-client/sabcrm-commerce';
import { resolveSabcrmFinanceParties } from './sabcrm-finance-invoices.actions';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmPosHoldKpis,
  SabcrmPosHoldListFilters,
  SabcrmPosHoldListPage,
  SabcrmPosHoldListRow,
} from './sabcrm-commerce-pos-holds.actions.types';

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

function cartValue(doc: CrmPosHoldDoc): number {
  return (doc.lineItems ?? []).reduce(
    (sum, li) => sum + (li.total ?? li.quantity * li.rate),
    0,
  );
}

function toRow(
  doc: CrmPosHoldDoc,
  sessions: Map<string, string>,
  customers: Map<string, string>,
): SabcrmPosHoldListRow {
  const customerId = doc.customerId ?? null;
  return {
    id: doc._id,
    heldAt: doc.heldAt,
    heldBy: doc.heldBy,
    sessionId: doc.sessionId,
    sessionLabel: sessions.get(doc.sessionId) ?? null,
    customerId,
    customerLabel: customerId
      ? (customers.get(customerId) ?? 'Customer')
      : 'Walk-in',
    itemsCount: doc.lineItems?.length ?? 0,
    cartValue: cartValue(doc),
    holdReason: doc.holdReason ?? null,
    status: doc.status,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of display-ready hold rows (labels resolved). */
export async function listSabcrmPosHoldsPage(
  filters: SabcrmPosHoldListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosHoldListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommercePosApi.holds.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    const [sessions, customers] = await Promise.all([
      sessionLabelMap(g.ctx.projectId),
      customerLabelMap(
        g.ctx.projectId,
        res.items.map((h) => h.customerId).filter((id): id is string => Boolean(id)),
      ),
    ]);
    return {
      ok: true,
      data: {
        rows: res.items.map((h) => toRow(h, sessions, customers)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list POS holds.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmPosHoldRows(
  filters: SabcrmPosHoldListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPosHoldListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmPosHoldDoc[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommercePosApi.holds.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const [sessions, customers] = await Promise.all([
      sessionLabelMap(g.ctx.projectId),
      customerLabelMap(
        g.ctx.projectId,
        docs.map((h) => h.customerId).filter((id): id is string => Boolean(id)),
      ),
    ]);
    return { ok: true, data: docs.map((h) => toRow(h, sessions, customers)) };
  } catch (e) {
    return fail(e, 'Failed to export POS holds.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmPosHoldKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPosHoldKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommercePosApi.holds.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    let heldCount = 0;
    let recalledCount = 0;
    let heldCartValue = 0;
    for (const h of res.items) {
      if (h.status === 'held') {
        heldCount += 1;
        heldCartValue += cartValue(h);
      } else if (h.status === 'recalled') {
        recalledCount += 1;
      }
    }
    return {
      ok: true,
      data: {
        currency: 'INR',
        count: res.items.length,
        heldCount,
        recalledCount,
        heldCartValue,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute POS-hold KPIs.');
  }
}
