'use server';

/**
 * SabCRM Commerce — Storefronts doc-surface actions (spec WI-14).
 *
 * Adds the verbs the kit surface needs beyond the back-compat module
 * (`sabcrm-commerce.actions.ts` keeps `publishSabcrmStorefront` /
 * `archiveSabcrmStorefront`; `sabcrm-commerce-docs.actions.ts` has the
 * full-patch `updateSabcrmStorefront`):
 *
 *   - `listSabcrmStorefrontsPage` — paged, display-ready, full-field
 *     rows (commerce envelope is 0-indexed → `page - 1` here only);
 *   - `exportSabcrmStorefrontRows` — capped CSV fetch-all;
 *   - `getSabcrmStorefrontKpis` — KPI strip;
 *   - `createSabcrmStorefrontFull` — the FULL `CrmStorefrontCreateInput`
 *     (theme, SabFiles logo, homepage blocks), superseding the minimal
 *     dialog payload.
 *
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommerceStoreApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmStorefrontDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmStorefrontFullInput,
  SabcrmStorefrontKpis,
  SabcrmStorefrontListFilters,
  SabcrmStorefrontListPage,
  SabcrmStorefrontListRow,
} from './sabcrm-commerce-storefronts.actions.types';

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

/* ─── Mapping ────────────────────────────────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

function toRow(doc: CrmStorefrontDoc): SabcrmStorefrontListRow {
  const blocks = doc.homepageBlocks ?? [];
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    domain: doc.domain ?? null,
    currency: doc.currency || 'INR',
    themeId: doc.themeId ?? null,
    logoUrl: doc.logoUrl ?? null,
    homepageBlocks: blocks,
    blocksCount: blocks.length,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of full-field storefront rows. */
export async function listSabcrmStorefrontsPage(
  filters: SabcrmStorefrontListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmStorefrontListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommerceStoreApi.storefronts.list(
      g.ctx.projectId,
      {
        page: page - 1,
        limit,
        q: filters.q || undefined,
        status: filters.status || undefined,
      },
    );
    return {
      ok: true,
      data: { rows: res.items.map(toRow), page, hasMore: res.hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to list storefronts.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmStorefrontRows(
  filters: SabcrmStorefrontListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmStorefrontListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows: SabcrmStorefrontListRow[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommerceStoreApi.storefronts.list(
        g.ctx.projectId,
        {
          page: wirePage,
          limit: 100,
          q: filters.q || undefined,
          status: filters.status || undefined,
        },
      );
      rows.push(...res.items.map(toRow));
      if (!res.hasMore) break;
    }
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export storefronts.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmStorefrontKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmStorefrontKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommerceStoreApi.storefronts.list(
      g.ctx.projectId,
      { page: 0, limit: 100 },
    );
    let publishedCount = 0;
    let draftCount = 0;
    let archivedCount = 0;
    for (const s of res.items) {
      if (s.status === 'published') publishedCount += 1;
      else if (s.status === 'draft') draftCount += 1;
      else if (s.status === 'archived') archivedCount += 1;
    }
    return {
      ok: true,
      data: {
        count: res.items.length,
        publishedCount,
        draftCount,
        archivedCount,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute storefront KPIs.');
  }
}

/** Creates a storefront with the FULL field set. */
export async function createSabcrmStorefrontFull(
  input: SabcrmStorefrontFullInput,
  projectId?: string,
): Promise<ActionResult<CrmStorefrontDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.slug?.trim()) return { ok: false, error: 'A slug is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceStoreApi.storefronts.create(
      g.ctx.projectId,
      {
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        currency: input.currency?.trim()
          ? input.currency.trim().toUpperCase()
          : 'INR',
        domain: input.domain?.trim() || undefined,
        themeId: input.themeId?.trim() || undefined,
        logoUrl: input.logoUrl?.trim() || undefined,
        homepageBlocks: input.homepageBlocks?.length
          ? input.homepageBlocks
          : undefined,
      },
    );
    revalidatePath(`${COMMERCE_BASE}/storefronts`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the storefront.');
  }
}
