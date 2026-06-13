'use server';

/**
 * SabCRM Commerce — Coupons doc-surface actions (spec WI-15).
 *
 * Beyond the back-compat module (`createSabcrmCoupon` minimal dialog,
 * `activateSabcrmCoupon`, `archiveSabcrmCoupon`) and the shared
 * full-patch `updateSabcrmCoupon` (docs module), this adds:
 *
 *   - `listSabcrmCouponsPage` — paged full-field rows with
 *     `applicableProducts` BATCH-resolved to item labels (one parallel
 *     getById pass over the page's unique ids — never N+1 per row);
 *   - `exportSabcrmCouponRows` — capped CSV fetch-all;
 *   - `getSabcrmCouponKpis` — KPI strip;
 *   - `createSabcrmCouponFull` — the FULL rule field set.
 *
 * Commerce envelope is 0-indexed → `page - 1` translated here only.
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommerceCouponsApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmCouponDoc } from '@/lib/rust-client/sabcrm-commerce';
import { sabcrmSupplyItemsApi } from '@/lib/rust-client/sabcrm-supply';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmCouponFullInput,
  SabcrmCouponKpis,
  SabcrmCouponListFilters,
  SabcrmCouponListPage,
  SabcrmCouponListRow,
} from './sabcrm-commerce-coupons.actions.types';

/* ─── Gate (mirrors sabcrm-commerce.actions.ts verbatim) ─────────── */

const MODULE_KEY = 'sabcrm';
const COMMERCE_BASE = '/sabcrm/commerce';

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

/** Coerce `YYYY-MM-DD` into a full RFC3339 instant for the wire. */
function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/* ─── Item-label batch resolution ────────────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

/**
 * Resolves the page's unique applicable-product ids to item names in
 * ONE parallel pass (capped at 100 unique ids per page).
 */
async function itemLabelMap(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const doc = await sabcrmSupplyItemsApi.getById(projectId, id);
        const name = (doc as { name?: string }).name;
        if (name) map.set(id, name);
      } catch {
        // Gone / wrong tenant — the row renders "Unknown item".
      }
    }),
  );
  return map;
}

function toRow(
  doc: CrmCouponDoc,
  items: Map<string, string>,
): SabcrmCouponListRow {
  const products = doc.applicableProducts ?? [];
  return {
    id: doc._id,
    code: doc.code,
    type: doc.type,
    value: doc.value ?? 0,
    minCart: doc.minCart ?? null,
    maxUses: doc.maxUses ?? null,
    perCustomerLimit: doc.perCustomerLimit ?? null,
    validFrom: doc.validFrom ?? null,
    validTo: doc.validTo ?? null,
    applicableProducts: products,
    applicableProductLabels: products.map(
      (id) => items.get(id) ?? 'Unknown item',
    ),
    stackable: !!doc.stackable,
    status: doc.status ?? 'draft',
    usedCount: doc.usedCount ?? 0,
    notes: doc.notes ?? null,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of full-field coupon rows (product labels resolved). */
export async function listSabcrmCouponsPage(
  filters: SabcrmCouponListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmCouponListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommerceCouponsApi.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    const items = await itemLabelMap(
      g.ctx.projectId,
      res.items.flatMap((c) => c.applicableProducts ?? []),
    );
    return {
      ok: true,
      data: {
        rows: res.items.map((c) => toRow(c, items)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list coupons.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmCouponRows(
  filters: SabcrmCouponListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmCouponListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmCouponDoc[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommerceCouponsApi.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const items = await itemLabelMap(
      g.ctx.projectId,
      docs.flatMap((c) => c.applicableProducts ?? []),
    );
    return { ok: true, data: docs.map((c) => toRow(c, items)) };
  } catch (e) {
    return fail(e, 'Failed to export coupons.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmCouponKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmCouponKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommerceCouponsApi.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    const now = Date.now();
    const soon = now + 7 * 86_400_000;
    let activeCount = 0;
    let totalRedemptions = 0;
    let expiringSoonCount = 0;
    for (const c of res.items) {
      if ((c.status ?? 'draft') === 'active') activeCount += 1;
      totalRedemptions += c.usedCount ?? 0;
      if (c.validTo) {
        const t = new Date(c.validTo).getTime();
        if (Number.isFinite(t) && t > now && t <= soon) {
          expiringSoonCount += 1;
        }
      }
    }
    return {
      ok: true,
      data: {
        count: res.items.length,
        activeCount,
        totalRedemptions,
        expiringSoonCount,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute coupon KPIs.');
  }
}

/** Creates a coupon with the FULL rule field set. */
export async function createSabcrmCouponFull(
  input: SabcrmCouponFullInput,
  projectId?: string,
): Promise<ActionResult<CrmCouponDoc>> {
  if (!input?.code?.trim()) return { ok: false, error: 'A code is required.' };
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { ok: false, error: 'Value must be greater than zero.' };
  }
  if (input.type === 'percent' && input.value > 100) {
    return { ok: false, error: 'A percent coupon cannot exceed 100%.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceCouponsApi.create(g.ctx.projectId, {
      code: input.code.trim().toUpperCase(),
      type: input.type === 'fixed' ? 'fixed' : 'percent',
      value: input.value,
      minCart:
        input.minCart !== undefined && Number.isFinite(input.minCart)
          ? input.minCart
          : undefined,
      maxUses:
        input.maxUses !== undefined && Number.isFinite(input.maxUses)
          ? Math.trunc(input.maxUses)
          : undefined,
      perCustomerLimit:
        input.perCustomerLimit !== undefined &&
        Number.isFinite(input.perCustomerLimit)
          ? Math.trunc(input.perCustomerLimit)
          : undefined,
      validFrom: toIso(input.validFrom),
      validTo: toIso(input.validTo),
      applicableProducts: input.applicableProducts?.length
        ? input.applicableProducts
        : undefined,
      stackable: input.stackable,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/coupons`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the coupon.');
  }
}
