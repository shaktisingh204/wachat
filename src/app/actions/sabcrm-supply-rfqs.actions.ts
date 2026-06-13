'use server';

/**
 * SabCRM Supply — RFQ surface server actions (rollout WI-8).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/rfqs`:
 *
 *   - paged display-ready list rows (invited-vendor + bid counts
 *     resolved per page; never raw ObjectIds). Pagination goes through
 *     `listPaged` on the supply client — the SINGLE 0-indexed vs
 *     1-indexed envelope normalizer;
 *   - KPI strip (RFQs / open / awarded / overdue) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (RFQ lines carry NO price — a bespoke
 *     `RfqLinesEditor` on the client; multi-vendor invite rows);
 *   - the bids table for the `[id]` detail rail (vendor labels resolved
 *     in one batched pass), plus an award helper that flips the chosen
 *     bid to `awarded` and cascades the RFQ to `awarded`.
 *
 * Get + status transitions live in the shared module
 * (`sabcrm-supply-docs.actions.ts`). Awarding a bid → PO is the vendor
 * bid surface's convert action (`convertSabcrmSupplyVendorBidToPo`).
 *
 * Every action re-runs the session → project → RBAC → plan gate. The
 * Rust engine may be down at dev time — failures normalise into
 * `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyRfqsApi,
  sabcrmSupplyVendorBidsApi,
  sabcrmSupplyVendorsApi,
  type CrmRfqDoc,
  type CrmVendorBidDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmRfqCreateInput,
  CrmRfqLineItem,
  CrmRfqUpdateInput,
} from '@/lib/rust-client/crm-rfqs';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmRfqStatus } from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmRfqBidRow,
  SabcrmRfqFullInput,
  SabcrmRfqFullPatch,
  SabcrmRfqKpis,
  SabcrmRfqLineInput,
  SabcrmRfqListFilters,
  SabcrmRfqListPage,
  SabcrmRfqListRow,
} from './sabcrm-supply-rfqs.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ────── */

const MODULE_KEY = 'sabcrm';
const RFQS_PATH = '/sabcrm/supply/rfqs';

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

/** Today as `YYYY-MM-DD` (UTC — server-side computation only). */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** RFQ lines → wire `items[]` (drop blank rows, validate ids). */
function toWireLines(lines: SabcrmRfqLineInput[]): CrmRfqLineItem[] {
  return lines
    .filter((l) => l.itemId && ObjectId.isValid(l.itemId) && l.qty > 0)
    .map((l) => ({
      itemId: l.itemId,
      description: l.description?.trim() || undefined,
      qty: l.qty,
      unit: l.unit?.trim() || undefined,
      specs: l.specs?.trim() || undefined,
    }));
}

/** Bid total with a Σ-line fallback. */
function bidTotal(bid: CrmVendorBidDoc): number {
  const stored = bid.totals?.total ?? 0;
  if (stored > 0) return stored;
  return (bid.items ?? []).reduce(
    (sum, it) => sum + (it.qty ?? 0) * (it.rate ?? 0),
    0,
  );
}

/* ─── List page (display-ready rows) ───────────────────────────── */

/** Statuses where a missed bid deadline is actionable. */
const OPEN_RFQ = new Set<SabcrmRfqStatus>(['open']);

/**
 * Resolves bid counts for one page of RFQs (one parallel pass over the
 * ids — never per-row N+1).
 */
async function resolveBidCounts(
  rfqIds: string[],
  projectId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  await Promise.all(
    rfqIds.map(async (id) => {
      try {
        const bids = await sabcrmSupplyVendorBidsApi.list(projectId, {
          page: 1,
          limit: 100,
          rfqId: id,
        });
        map.set(id, bids.length);
      } catch {
        // Bids mount down — count falls back to 0.
      }
    }),
  );
  return map;
}

function toListRow(
  doc: CrmRfqDoc,
  bidCounts: Map<string, number>,
  today: string,
): SabcrmRfqListRow {
  const status = (doc.status ?? 'draft') as SabcrmRfqStatus;
  const deadline = (doc.deadline ?? '').slice(0, 10) || null;
  let agingDays: number | null = null;
  if (deadline && OPEN_RFQ.has(status) && deadline < today) {
    const ms = new Date(today).getTime() - new Date(deadline).getTime();
    agingDays = Math.max(1, Math.round(ms / 86_400_000));
  }
  return {
    id: doc._id,
    title: doc.title ?? '',
    itemCount: doc.items?.length ?? 0,
    requiredBy: doc.requiredBy ?? null,
    deadline: doc.deadline ?? null,
    invitedCount: doc.vendorsInvited?.length ?? 0,
    bidCount: bidCounts.get(doc._id) ?? 0,
    status,
    agingDays,
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function applyDateRange(
  docs: CrmRfqDoc[],
  from?: string,
  to?: string,
): CrmRfqDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.requiredBy ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/** Lists a page of display-ready RFQ rows (invited + bid counts). */
export async function listSabcrmSupplyRfqsPage(
  filters: SabcrmRfqListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmRfqListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyRfqsApi.listPaged(
      g.ctx.projectId,
      {
        page,
        limit,
        q: filters.q || undefined,
        status: filters.status || undefined,
      },
    );
    const pageDocs = applyDateRange(items, filters.from, filters.to);
    const bidCounts = await resolveBidCounts(
      pageDocs.map((d) => d._id),
      g.ctx.projectId,
    );
    const today = todayKey();
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, bidCounts, today)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list RFQs.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring filters. */
export async function exportSabcrmSupplyRfqRows(
  filters: SabcrmRfqListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmRfqListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmRfqDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyRfqsApi.listPaged(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          status: filters.status || undefined,
        },
      );
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const bidCounts = await resolveBidCounts(
      rows.map((d) => d._id),
      g.ctx.projectId,
    );
    const today = todayKey();
    return {
      ok: true,
      data: rows.map((d) => toListRow(d, bidCounts, today)),
    };
  } catch (e) {
    return fail(e, 'Failed to export RFQs.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Computes the KPI strip over a capped scan (up to 500 RFQs). */
export async function getSabcrmSupplyRfqKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmRfqKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmRfqDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyRfqsApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const today = todayKey();
    let openCount = 0;
    let awardedCount = 0;
    let overdueCount = 0;
    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as SabcrmRfqStatus;
      if (status === 'open') {
        openCount += 1;
        const deadline = (doc.deadline ?? '').slice(0, 10);
        if (deadline && deadline < today) overdueCount += 1;
      }
      if (status === 'awarded') awardedCount += 1;
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        openCount,
        awardedCount,
        overdueCount,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute RFQ KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Creates an RFQ from the FULL form — title, no-price lines, invited
 * vendors, required-by + deadline dates, terms. `issue` opens the RFQ
 * for bidding (the crate creates in `draft`; `draft → open` is legal).
 */
export async function createSabcrmSupplyRfqFull(
  input: SabcrmRfqFullInput,
  projectId?: string,
): Promise<ActionResult<CrmRfqDoc>> {
  if (!input?.title?.trim()) {
    return { ok: false, error: 'A title is required.' };
  }
  const lines = toWireLines(input.lines ?? []);
  if (lines.length === 0) {
    return { ok: false, error: 'Add at least one item to request.' };
  }
  const vendorsInvited = [
    ...new Set((input.vendorsInvited ?? []).filter((id) => ObjectId.isValid(id))),
  ];

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmRfqCreateInput = {
    title: input.title.trim(),
    items: lines,
    requiredBy: input.requiredBy || undefined,
    deadline: input.deadline || undefined,
    vendorsInvited,
    terms: input.terms?.trim() || undefined,
  };

  try {
    let created = await sabcrmSupplyRfqsApi.create(g.ctx.projectId, wire);
    if (input.issue) {
      try {
        created = await sabcrmSupplyRfqsApi.update(g.ctx.projectId, created._id, {
          status: 'open',
        });
      } catch {
        // The RFQ exists as a draft either way.
      }
    }
    revalidatePath(RFQS_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create the RFQ.');
  }
}

/** Full-form partial update. Status moves go through the transition action. */
export async function updateSabcrmSupplyRfqFull(
  id: string,
  patch: SabcrmRfqFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmRfqDoc>> {
  if (!id) return { ok: false, error: 'RFQ id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmRfqUpdateInput = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) return { ok: false, error: 'A title is required.' };
    wire.title = patch.title.trim();
  }
  if (patch.lines !== undefined) {
    const lines = toWireLines(patch.lines);
    if (lines.length === 0) {
      return { ok: false, error: 'Add at least one item to request.' };
    }
    wire.items = lines;
  }
  if (patch.requiredBy !== undefined) wire.requiredBy = patch.requiredBy || undefined;
  if (patch.deadline !== undefined) wire.deadline = patch.deadline || undefined;
  if (patch.vendorsInvited !== undefined) {
    wire.vendorsInvited = [
      ...new Set(patch.vendorsInvited.filter((vid) => ObjectId.isValid(vid))),
    ];
  }
  if (patch.terms !== undefined) wire.terms = patch.terms.trim() || undefined;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyRfqsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(RFQS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the RFQ.');
  }
}

/* ─── Bids (detail rail + award) ────────────────────────────────── */

/**
 * Lists the bids submitted against an RFQ as display-ready rows
 * (vendor labels resolved in one batched pass). Powers the detail
 * page's bids table + shortlist/award actions.
 */
export async function getSabcrmSupplyRfqBids(
  rfqId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRfqBidRow[]>> {
  if (!rfqId) return { ok: false, error: 'RFQ id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const bids = await sabcrmSupplyVendorBidsApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
      rfqId,
    });

    // Resolve vendor labels (one parallel pass over unique ids).
    const vendorIds = [...new Set(bids.map((b) => b.vendorId).filter(Boolean))];
    const vendorNames = new Map<string, string>();
    await Promise.all(
      vendorIds.map(async (vid) => {
        try {
          const v = await sabcrmSupplyVendorsApi.getById(g.ctx.projectId, vid);
          vendorNames.set(vid, v.displayName || v.name || 'Unknown vendor');
        } catch {
          // Vendor gone — falls back to the bid's cached name below.
        }
      }),
    );

    const rows: SabcrmRfqBidRow[] = bids.map((bid) => {
      const leadTimes = (bid.items ?? [])
        .map((it) => it.leadTimeDays)
        .filter((n): n is number => typeof n === 'number');
      return {
        id: bid._id,
        vendorId: bid.vendorId,
        vendorLabel:
          vendorNames.get(bid.vendorId) || bid.vendorName || 'Unknown vendor',
        total: bidTotal(bid),
        currency: bid.currency || 'INR',
        leadTimeDays: leadTimes.length > 0 ? Math.max(...leadTimes) : null,
        status: String(bid.status ?? 'submitted'),
        submittedAt: bid.submittedAt ?? bid.createdAt ?? null,
      };
    });
    // Cheapest first.
    rows.sort((a, b) => a.total - b.total);
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to load the bids for this RFQ.');
  }
}

/**
 * Awards a bid from the RFQ detail: flips the chosen bid to `awarded`
 * and cascades the RFQ to `awarded`. (Converting the awarded bid into a
 * PO is the vendor-bid surface's `convertSabcrmSupplyVendorBidToPo`.)
 */
export async function awardSabcrmSupplyRfqBid(
  rfqId: string,
  bidId: string,
  projectId?: string,
): Promise<ActionResult<{ rfqId: string; bidId: string }>> {
  if (!rfqId || !bidId) {
    return { ok: false, error: 'RFQ and bid ids are required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmSupplyVendorBidsApi.update(g.ctx.projectId, bidId, {
      status: 'awarded',
    });
    try {
      await sabcrmSupplyRfqsApi.update(g.ctx.projectId, rfqId, {
        status: 'awarded',
      });
    } catch {
      // The bid is awarded either way — RFQ cascade is best-effort.
    }
    revalidatePath(RFQS_PATH);
    revalidatePath(`${RFQS_PATH}/${encodeURIComponent(rfqId)}`);
    revalidatePath('/sabcrm/supply/vendor-bids');
    return { ok: true, data: { rfqId, bidId } };
  } catch (e) {
    return fail(e, 'Failed to award the bid.');
  }
}

/**
 * Shortlists / rejects a bid from the RFQ detail (a thin wrapper over
 * the vendor-bid status set, scoped to the RFQ surface's revalidation).
 */
export async function setSabcrmSupplyRfqBidStatus(
  rfqId: string,
  bidId: string,
  status: 'shortlisted' | 'rejected' | 'withdrawn',
  projectId?: string,
): Promise<ActionResult<{ bidId: string }>> {
  if (!rfqId || !bidId) {
    return { ok: false, error: 'RFQ and bid ids are required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    await sabcrmSupplyVendorBidsApi.update(g.ctx.projectId, bidId, { status });
    revalidatePath(`${RFQS_PATH}/${encodeURIComponent(rfqId)}`);
    revalidatePath('/sabcrm/supply/vendor-bids');
    return { ok: true, data: { bidId } };
  } catch (e) {
    return fail(e, 'Failed to update the bid status.');
  }
}
