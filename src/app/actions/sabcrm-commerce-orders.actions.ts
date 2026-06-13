'use server';

/**
 * SabCRM Commerce — Orders doc-surface actions (rollout spec WI-13).
 *
 * The paged/display-ready verbs the kit list + detail need on top of
 * the back-compat dialog module (`sabcrm-commerce.actions.ts`, which
 * keeps `getSabcrmStoreOrder` / `markSabcrmStoreOrderPaid` /
 * `markSabcrmStoreOrderFulfilled` / `cancelSabcrmStoreOrder`):
 *
 *   - `listSabcrmStoreOrdersPage` — display-ready rows with storefront
 *     labels BATCH-resolved (one storefronts list call per page, never
 *     N+1) and the crm-common `hasMore` passed through;
 *   - `exportSabcrmStoreOrderRows` — capped fetch-all for CSV;
 *   - `getSabcrmStoreOrderKpis` — KPI strip over a capped sample;
 *   - `getSabcrmStoreOrderDetail` — order + resolved storefront label
 *     for the `[orderId]` DocDetailPage.
 *
 * Pagination trap (spec risk #5): the commerce envelope is 0-indexed —
 * the UI's 1-indexed `page` is translated EXACTLY here (`page - 1`),
 * nowhere else.
 *
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`,
 * failing closed.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommerceStoreApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmStoreOrderDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmStoreOrderKpis,
  SabcrmStoreOrderListFilters,
  SabcrmStoreOrderListPage,
  SabcrmStoreOrderListRow,
} from './sabcrm-commerce-orders.actions.types';

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

/* ─── Helpers ────────────────────────────────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

/**
 * Batch storefront-label resolution: ONE list call (storefront counts
 * are small), mapped by id — never a per-row fetch (spec risk #6).
 */
async function storefrontLabelMap(
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await sabcrmCommerceStoreApi.storefronts.list(projectId, {
      limit: 100,
    });
    for (const s of res.items) {
      if (s._id) map.set(String(s._id), s.name || 'Unnamed storefront');
    }
  } catch {
    // Engine hiccup on the lookup must not kill the list — rows render
    // the muted "Unknown" fallback instead.
  }
  return map;
}

function toRow(
  doc: CrmStoreOrderDoc,
  storefronts: Map<string, string>,
): SabcrmStoreOrderListRow {
  return {
    id: doc._id,
    orderNumber: doc.orderNumber,
    placedAt: doc.placedAt,
    customerName: doc.customerName,
    customerEmail: doc.customerEmail,
    customerPhone: doc.customerPhone ?? null,
    storefrontId: doc.storefrontId,
    storefrontLabel: storefronts.get(doc.storefrontId) ?? null,
    itemsCount: doc.lineItems?.length ?? 0,
    total: doc.total ?? 0,
    currency: doc.currency || 'INR',
    paymentStatus: doc.paymentStatus,
    fulfillmentStatus: doc.fulfillmentStatus,
    paymentMethod: doc.paymentMethod || '—',
    paymentRef: doc.paymentRef ?? null,
    linkedInvoiceId: doc.linkedInvoiceId ?? null,
  };
}

/** Inclusive `YYYY-MM-DD` refinement on `placedAt` (in-page, like the
 *  invoices precedent — the crate has no date-range filter). */
function refineByDate(
  docs: CrmStoreOrderDoc[],
  from?: string,
  to?: string,
): CrmStoreOrderDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.placedAt ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List / export / KPIs / detail ──────────────────────────────── */

/** Lists a page of display-ready order rows (storefront labels resolved). */
export async function listSabcrmStoreOrdersPage(
  filters: SabcrmStoreOrderListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmStoreOrderListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommerceStoreApi.orders.list(g.ctx.projectId, {
      // crm-common pages are 0-indexed — single translation point.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      paymentStatus: filters.status || undefined,
      storefrontId: filters.storefrontId || undefined,
    });
    const pageDocs = refineByDate(res.items, filters.from, filters.to);
    const storefronts = await storefrontLabelMap(g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toRow(d, storefronts)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list orders.');
  }
}

/** Capped fetch-all (≤500) for CSV export, honouring the filters. */
export async function exportSabcrmStoreOrderRows(
  filters: SabcrmStoreOrderListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmStoreOrderListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmStoreOrderDoc[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommerceStoreApi.orders.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        paymentStatus: filters.status || undefined,
        storefrontId: filters.storefrontId || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const rows = refineByDate(docs, filters.from, filters.to);
    const storefronts = await storefrontLabelMap(g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toRow(d, storefronts)) };
  } catch (e) {
    return fail(e, 'Failed to export orders.');
  }
}

/** KPI strip over a capped sample (latest 100 orders). */
export async function getSabcrmStoreOrderKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmStoreOrderKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommerceStoreApi.orders.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    const docs = res.items;
    const monthKey = new Date().toISOString().slice(0, 7);
    let paidTotal = 0;
    let pendingCount = 0;
    let unfulfilledCount = 0;
    let thisMonthCount = 0;
    let thisMonthTotal = 0;
    for (const d of docs) {
      if (d.paymentStatus === 'paid') paidTotal += d.total ?? 0;
      if (d.paymentStatus === 'pending') pendingCount += 1;
      if (d.fulfillmentStatus === 'unfulfilled') unfulfilledCount += 1;
      if ((d.placedAt ?? '').slice(0, 7) === monthKey) {
        thisMonthCount += 1;
        thisMonthTotal += d.total ?? 0;
      }
    }
    return {
      ok: true,
      data: {
        currency: docs[0]?.currency || 'INR',
        count: docs.length,
        paidTotal,
        pendingCount,
        unfulfilledCount,
        thisMonthCount,
        thisMonthTotal,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute order KPIs.');
  }
}

/** One order + its resolved storefront label (detail server entry). */
export async function getSabcrmStoreOrderDetail(
  id: string,
  projectId?: string,
): Promise<
  ActionResult<{ order: CrmStoreOrderDoc; storefrontLabel: string | null }>
> {
  if (!id) return { ok: false, error: 'Order id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const order = await sabcrmCommerceStoreApi.orders.getById(
      g.ctx.projectId,
      id,
    );
    const storefronts = await storefrontLabelMap(g.ctx.projectId);
    return {
      ok: true,
      data: {
        order,
        storefrontLabel: storefronts.get(order.storefrontId) ?? null,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the order.');
  }
}
