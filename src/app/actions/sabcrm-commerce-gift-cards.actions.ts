'use server';

/**
 * SabCRM Commerce — Gift cards doc-surface actions (spec WI-16).
 *
 * Beyond the back-compat module (`createSabcrmGiftCard` minimal
 * dialog, `archiveSabcrmGiftCard`) and the shared full-patch
 * `updateSabcrmGiftCard` (docs module), this adds:
 *
 *   - `listSabcrmGiftCardsPage` — paged full-field rows (commerce
 *     envelope is 0-indexed → `page - 1` here only);
 *   - `exportSabcrmGiftCardRows` — capped CSV fetch-all;
 *   - `getSabcrmGiftCardKpis` — KPI strip;
 *   - `createSabcrmGiftCardFull` — full input incl. `transferable`.
 *
 * Gate pipeline copied verbatim from `sabcrm-commerce.actions.ts`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmCommerceGiftCardsApi } from '@/lib/rust-client/sabcrm-commerce';
import type { CrmGiftCardDoc } from '@/lib/rust-client/sabcrm-commerce';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmGiftCardFullInput,
  SabcrmGiftCardKpis,
  SabcrmGiftCardListFilters,
  SabcrmGiftCardListPage,
  SabcrmGiftCardListRow,
} from './sabcrm-commerce-gift-cards.actions.types';

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

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/* ─── Mapping ────────────────────────────────────────────────────── */

const PAGE_LIMIT_DEFAULT = 25;
const EXPORT_MAX_PAGES = 5;

function toRow(doc: CrmGiftCardDoc): SabcrmGiftCardListRow {
  return {
    id: doc._id,
    code: doc.code,
    value: doc.value ?? 0,
    balance: doc.balance ?? 0,
    issuedTo: doc.issuedTo ?? null,
    issuedToEmail: doc.issuedToEmail ?? null,
    expiryDate: doc.expiryDate ?? null,
    transferable: !!doc.transferable,
    status: doc.status ?? 'active',
    notes: doc.notes ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

/* ─── Actions ────────────────────────────────────────────────────── */

/** Lists a page of full-field gift-card rows. */
export async function listSabcrmGiftCardsPage(
  filters: SabcrmGiftCardListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmGiftCardListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), 100);

  try {
    const res = await sabcrmCommerceGiftCardsApi.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });
    return {
      ok: true,
      data: { rows: res.items.map(toRow), page, hasMore: res.hasMore },
    };
  } catch (e) {
    return fail(e, 'Failed to list gift cards.');
  }
}

/** Capped fetch-all (≤500) for CSV export. */
export async function exportSabcrmGiftCardRows(
  filters: SabcrmGiftCardListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmGiftCardListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows: SabcrmGiftCardListRow[] = [];
    for (let wirePage = 0; wirePage < EXPORT_MAX_PAGES; wirePage += 1) {
      const res = await sabcrmCommerceGiftCardsApi.list(g.ctx.projectId, {
        page: wirePage,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      rows.push(...res.items.map(toRow));
      if (!res.hasMore) break;
    }
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export gift cards.');
  }
}

/** KPI strip over a capped sample (latest 100). */
export async function getSabcrmGiftCardKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmGiftCardKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmCommerceGiftCardsApi.list(g.ctx.projectId, {
      page: 0,
      limit: 100,
    });
    let activeCount = 0;
    let outstandingBalance = 0;
    let totalIssuedValue = 0;
    for (const c of res.items) {
      if ((c.status ?? 'active') === 'active') {
        activeCount += 1;
        outstandingBalance += c.balance ?? 0;
      }
      totalIssuedValue += c.value ?? 0;
    }
    return {
      ok: true,
      data: {
        currency: 'INR',
        count: res.items.length,
        activeCount,
        outstandingBalance,
        totalIssuedValue,
        sampled: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute gift-card KPIs.');
  }
}

/** Issues a gift card with the FULL field set. */
export async function createSabcrmGiftCardFull(
  input: SabcrmGiftCardFullInput,
  projectId?: string,
): Promise<ActionResult<CrmGiftCardDoc>> {
  if (!Number.isFinite(input?.value) || input.value <= 0) {
    return { ok: false, error: 'Value must be greater than zero.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmCommerceGiftCardsApi.create(g.ctx.projectId, {
      code: input.code?.trim() || undefined,
      value: input.value,
      issuedTo: input.issuedTo?.trim() || undefined,
      issuedToEmail: input.issuedToEmail?.trim() || undefined,
      expiryDate: toIso(input.expiryDate),
      transferable: input.transferable,
      notes: input.notes?.trim() || undefined,
    });
    revalidatePath(`${COMMERCE_BASE}/gift-cards`);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to issue the gift card.');
  }
}
