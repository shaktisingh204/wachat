'use server';

/**
 * SabCRM Commerce — Shipping zones doc-surface actions (spec WI-17).
 *
 * Adds the verbs the kit surface needs beyond the back-compat module
 * (`listSabcrmShippingZones`, single-method `createSabcrmShippingZone`,
 * `archiveSabcrmShippingZone`) and the shared docs full-patch
 * `updateSabcrmShippingZone`:
 *
 *   - `listSabcrmShippingZonesPage` — paged, display-ready, full-field
 *     rows with storefront labels BATCH-resolved (one list call per
 *     page — never N+1);
 *   - `exportSabcrmShippingZoneRows` — capped CSV fetch-all;
 *   - `getSabcrmShippingZoneKpis` — KPI strip;
 *   - `createSabcrmShippingZoneFull` — the FULL methods grid,
 *     superseding the single-method dialog.
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
import { sabcrmCommerceStoreApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmStoreShippingZoneDoc } from '@/lib/rust-client/crm-store';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmShippingZoneFullInput,
  SabcrmShippingZoneKpis,
  SabcrmShippingZoneListFilters,
  SabcrmShippingZoneListPage,
  SabcrmShippingZoneListRow,
} from './sabcrm-commerce-shipping.actions.types';

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

/* ─── Storefront-label batch resolution ──────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

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
    // Engine hiccup on the lookup must not kill the list.
  }
  return map;
}

function cheapestRate(doc: CrmStoreShippingZoneDoc): number {
  const methods = doc.methods ?? [];
  if (methods.length === 0) return 0;
  return Math.min(...methods.map((m) => m.rate ?? 0));
}

function toRow(
  doc: CrmStoreShippingZoneDoc,
  storefronts: Map<string, string>,
): SabcrmShippingZoneListRow {
  const methods = doc.methods ?? [];
  return {
    id: doc._id,
    storefrontId: doc.storefrontId,
    storefrontLabel: storefronts.get(doc.storefrontId) ?? null,
    name: doc.name,
    countries: doc.countries ?? [],
    states: doc.states ?? [],
    methods,
    methodsCount: methods.length,
    cheapestRate: cheapestRate(doc),
    status: doc.status,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of full-field shipping-zone rows (storefront labels resolved). */
export async function listSabcrmShippingZonesPage(
  filters: SabcrmShippingZoneListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmShippingZoneListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommerceStoreApi.shippingZones.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      storefrontId: filters.storefrontId || undefined,
    });
    const storefronts = await storefrontLabelMap(g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: res.items.map((z) => toRow(z, storefronts)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list shipping zones.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmShippingZoneRows(
  filters: SabcrmShippingZoneListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmShippingZoneListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmStoreShippingZoneDoc[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommerceStoreApi.shippingZones.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        storefrontId: filters.storefrontId || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const storefronts = await storefrontLabelMap(g.ctx.projectId);
    return { ok: true, data: docs.map((z) => toRow(z, storefronts)) };
  } catch (e) {
    return fail(e, 'Failed to export shipping zones.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmShippingZoneKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmShippingZoneKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommerceStoreApi.shippingZones.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    let activeCount = 0;
    let methodsTotal = 0;
    const countries = new Set<string>();
    for (const z of res.items) {
      if (z.status === 'active') activeCount += 1;
      methodsTotal += z.methods?.length ?? 0;
      for (const c of z.countries ?? []) countries.add(c);
    }
    return {
      ok: true,
      data: {
        count: res.items.length,
        activeCount,
        methodsTotal,
        countriesCovered: countries.size,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute shipping-zone KPIs.');
  }
}

/** Creates a shipping zone with the FULL methods grid. */
export async function createSabcrmShippingZoneFull(
  input: SabcrmShippingZoneFullInput,
  projectId?: string,
): Promise<ActionResult<CrmStoreShippingZoneDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.storefrontId?.trim()) {
    return { ok: false, error: 'A storefront is required.' };
  }
  if (!input.methods?.length) {
    return { ok: false, error: 'Add at least one shipping method.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceStoreApi.shippingZones.create(
      g.ctx.projectId,
      {
        storefrontId: input.storefrontId.trim(),
        name: input.name.trim(),
        countries: input.countries
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        states: input.states?.map((s) => s.trim()).filter(Boolean),
        methods: input.methods,
      },
    );
    revalidatePath(`${COMMERCE_BASE}/shipping`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the shipping zone.');
  }
}
