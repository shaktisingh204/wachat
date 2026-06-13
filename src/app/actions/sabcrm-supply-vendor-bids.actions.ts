'use server';

/**
 * SabCRM Supply — vendor-bid surface server actions (rollout WI-9).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/vendor-bids`:
 *
 *   - paged display-ready list rows (RFQ + vendor labels batch-resolved
 *     per page — never raw ObjectIds). Pagination goes through
 *     `listPaged` on the supply client — the SINGLE 0-indexed vs
 *     1-indexed envelope normalizer;
 *   - KPI strip (bids / submitted / shortlisted / awarded value) over a
 *     capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (priced lines with per-line lead time +
 *     notes; totals recomputed server-side via the shared
 *     `finance-doc-math` — client totals never trusted);
 *   - award → purchase order (reuses the PO flagship
 *     `createSabcrmSupplyPurchaseOrderFull` with `fromKind: 'vendorBid'`
 *     so the Rust side back-links lineage; the bid itself is flipped to
 *     `awarded`).
 *
 * Get + status transitions: `getSabcrmSupplyVendorBid` lives in the
 * shared module; the legacy `updateSabcrmSupplyVendorBidStatus`
 * (shortlist/award/reject) stays in `sabcrm-supply.actions.ts`.
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
  type CrmVendorBidDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmVendorBidCreateInput,
  CrmVendorBidLineItem,
  CrmVendorBidTotals,
  CrmVendorBidUpdateInput,
} from '@/lib/rust-client/crm-vendor-bids';
import {
  computeDocTotals,
  round2,
  type DocLineInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmVendorBidStatus } from './sabcrm-supply-docs.actions.types';
import { createSabcrmSupplyPurchaseOrderFull } from './sabcrm-supply-purchase-orders.actions';
import { suggestNextSupplyNumber } from './sabcrm-supply-docs.actions';
import type {
  SabcrmBidConvertResult,
  SabcrmBidFullInput,
  SabcrmBidFullPatch,
  SabcrmBidKpis,
  SabcrmBidLineInput,
  SabcrmBidListFilters,
  SabcrmBidListPage,
  SabcrmBidListRow,
} from './sabcrm-supply-vendor-bids.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ────── */

const MODULE_KEY = 'sabcrm';
const BIDS_PATH = '/sabcrm/supply/vendor-bids';

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

/* ─── Money (shared math → wire shapes) ────────────────────────── */

/** Bid lines → wire `items[]` (drop blank rows; keep lead time + notes). */
function toWireLines(lines: SabcrmBidLineInput[]): CrmVendorBidLineItem[] {
  return lines
    .filter((l) => l.qty > 0 || l.rate > 0)
    .map((l) => ({
      itemId: l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
      qty: l.qty,
      rate: l.rate,
      leadTimeDays:
        l.leadTimeDays != null && Number.isFinite(l.leadTimeDays)
          ? l.leadTimeDays
          : undefined,
      notes: l.notes?.trim() || undefined,
    }));
}

/** Recompute the wire totals from the bid lines (qty × rate). */
function toWireTotals(lines: CrmVendorBidLineItem[]): CrmVendorBidTotals {
  const docLines: DocLineInput[] = lines.map((l) => ({
    qty: l.qty,
    rate: l.rate,
  }));
  const t = computeDocTotals(docLines);
  return { subTotal: t.subTotal, total: t.total };
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

/** Max promised lead time across a bid's lines (days); null when none. */
function maxLeadTime(bid: CrmVendorBidDoc): number | null {
  const leads = (bid.items ?? [])
    .map((it) => it.leadTimeDays)
    .filter((n): n is number => typeof n === 'number');
  return leads.length > 0 ? Math.max(...leads) : null;
}

/* ─── List page (display-ready rows) ───────────────────────────── */

/**
 * Batch-resolves vendor + RFQ labels for one page of bids (one
 * parallel pass over the unique ids — never per-row N+1).
 */
async function resolveLabels(
  docs: CrmVendorBidDoc[],
  projectId: string,
): Promise<{ vendors: Map<string, string>; rfqs: Map<string, string> }> {
  const vendorIds = [...new Set(docs.map((d) => d.vendorId).filter(Boolean))];
  const rfqIds = [...new Set(docs.map((d) => d.rfqId).filter(Boolean))];
  const vendors = new Map<string, string>();
  const rfqs = new Map<string, string>();
  await Promise.all([
    ...vendorIds.map(async (id) => {
      try {
        const v = await sabcrmSupplyVendorsApi.getById(projectId, id);
        vendors.set(id, v.displayName || v.name || 'Unknown vendor');
      } catch {
        // Vendor gone — row renders the muted "Unknown" fallback.
      }
    }),
    ...rfqIds.map(async (id) => {
      try {
        const r = await sabcrmSupplyRfqsApi.getById(projectId, id);
        rfqs.set(id, r.title || 'Untitled RFQ');
      } catch {
        // RFQ gone — row renders the muted "Unknown" fallback.
      }
    }),
  ]);
  return { vendors, rfqs };
}

function toListRow(
  doc: CrmVendorBidDoc,
  vendors: Map<string, string>,
  rfqs: Map<string, string>,
): SabcrmBidListRow {
  return {
    id: doc._id,
    rfqId: doc.rfqId ?? '',
    rfqLabel: doc.rfqId ? (rfqs.get(doc.rfqId) ?? null) : null,
    vendorId: doc.vendorId ?? '',
    vendorLabel: doc.vendorId
      ? (vendors.get(doc.vendorId) ?? doc.vendorName ?? null)
      : (doc.vendorName ?? null),
    submittedAt: doc.submittedAt ?? doc.createdAt ?? null,
    currency: doc.currency || 'INR',
    total: round2(bidTotal(doc)),
    leadTimeDays: maxLeadTime(doc),
    status: (doc.status ?? 'submitted') as SabcrmVendorBidStatus,
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function applyDateRange(
  docs: CrmVendorBidDoc[],
  from?: string,
  to?: string,
): CrmVendorBidDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.submittedAt ?? d.createdAt ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/** Lists a page of display-ready bid rows (RFQ + vendor resolved). */
export async function listSabcrmSupplyVendorBidsPage(
  filters: SabcrmBidListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBidListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyVendorBidsApi.listPaged(
      g.ctx.projectId,
      {
        page,
        limit,
        q: filters.q || undefined,
        status: filters.status || undefined,
        vendorId: filters.vendorId || undefined,
        rfqId: filters.rfqId || undefined,
      },
    );
    const pageDocs = applyDateRange(items, filters.from, filters.to);
    const { vendors, rfqs } = await resolveLabels(pageDocs, g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, vendors, rfqs)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list vendor bids.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring filters. */
export async function exportSabcrmSupplyVendorBidRows(
  filters: SabcrmBidListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBidListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmVendorBidDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyVendorBidsApi.listPaged(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          status: filters.status || undefined,
          vendorId: filters.vendorId || undefined,
          rfqId: filters.rfqId || undefined,
        },
      );
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const { vendors, rfqs } = await resolveLabels(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, vendors, rfqs)) };
  } catch (e) {
    return fail(e, 'Failed to export vendor bids.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Computes the KPI strip over a capped scan (up to 500 bids). */
export async function getSabcrmSupplyVendorBidKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmBidKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmVendorBidDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyVendorBidsApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const currencyVotes = new Map<string, number>();
    let submittedCount = 0;
    let shortlistedCount = 0;
    let awardedCount = 0;
    let awardedValue = 0;
    for (const doc of docs) {
      const status = (doc.status ?? 'submitted') as SabcrmVendorBidStatus;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);
      if (status === 'submitted') submittedCount += 1;
      if (status === 'shortlisted') shortlistedCount += 1;
      if (status === 'awarded') {
        awardedCount += 1;
        awardedValue += bidTotal(doc);
      }
    }

    let currency = 'INR';
    let votes = -1;
    for (const [code, n] of currencyVotes) {
      if (n > votes) {
        currency = code;
        votes = n;
      }
    }

    return {
      ok: true,
      data: {
        currency,
        count: docs.length,
        submittedCount,
        shortlistedCount,
        awardedCount,
        awardedValue: round2(awardedValue),
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute vendor bid KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Creates a vendor bid from the FULL form — real picked RFQ + vendor,
 * priced lines (per-line lead time + notes), server-recomputed totals.
 */
export async function createSabcrmSupplyVendorBidFull(
  input: SabcrmBidFullInput,
  projectId?: string,
): Promise<ActionResult<CrmVendorBidDoc>> {
  if (!input?.rfqId || !ObjectId.isValid(input.rfqId)) {
    return { ok: false, error: 'Pick the RFQ this bid responds to.' };
  }
  if (!input.vendorId || !ObjectId.isValid(input.vendorId)) {
    return { ok: false, error: 'Pick the vendor submitting this bid.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const lines = toWireLines(input.lines ?? []);
  if (lines.length === 0) {
    return { ok: false, error: 'Add at least one priced line.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmVendorBidCreateInput = {
    rfqId: input.rfqId,
    vendorId: input.vendorId,
    items: lines,
    totals: toWireTotals(lines),
    currency: input.currency.trim().toUpperCase(),
    terms: input.terms?.trim() || undefined,
    vendorName: input.vendorName?.trim() || undefined,
  };

  try {
    const created = await sabcrmSupplyVendorBidsApi.create(g.ctx.projectId, wire);
    revalidatePath(BIDS_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create the vendor bid.');
  }
}

/** Full-form partial update. Status moves go through the status action. */
export async function updateSabcrmSupplyVendorBidFull(
  id: string,
  patch: SabcrmBidFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmVendorBidDoc>> {
  if (!id) return { ok: false, error: 'Bid id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmVendorBidUpdateInput = {};
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.lines !== undefined) {
    const lines = toWireLines(patch.lines);
    if (lines.length === 0) {
      return { ok: false, error: 'Add at least one priced line.' };
    }
    wire.items = lines;
    wire.totals = toWireTotals(lines);
  }
  if (patch.terms !== undefined) wire.terms = patch.terms.trim() || undefined;
  if (patch.vendorName !== undefined) {
    wire.vendorName = patch.vendorName.trim() || undefined;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyVendorBidsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(BIDS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the vendor bid.');
  }
}

/* ─── Convert (bid → purchase order) ───────────────────────────── */

/** Bid lines → kit `DocLineInput`s for the PO create. */
function toDocLines(bid: CrmVendorBidDoc): DocLineInput[] {
  return (bid.items ?? []).map((it) => ({
    itemId: it.itemId,
    qty: it.qty,
    rate: it.rate,
  }));
}

/**
 * Awards a bid into a purchase order: flips the bid to `awarded`, then
 * raises a draft PO against the bid's vendor with the bid's priced
 * lines (`fromKind: 'vendorBid'` so the Rust side back-links lineage).
 * Reuses the PO flagship create — totals are recomputed there.
 */
export async function convertSabcrmSupplyVendorBidToPo(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmBidConvertResult>> {
  if (!id) return { ok: false, error: 'Bid id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const bid = await sabcrmSupplyVendorBidsApi.getById(g.ctx.projectId, id);
    const status = (bid.status ?? 'submitted') as SabcrmVendorBidStatus;
    if (status === 'rejected' || status === 'withdrawn') {
      return {
        ok: false,
        error: "A rejected or withdrawn bid can't be turned into a PO.",
      };
    }
    const lines = toDocLines(bid).filter((l) => (l.qty ?? 0) > 0);
    if (lines.length === 0) {
      return { ok: false, error: 'This bid has no priced lines to order.' };
    }

    // Mark the winning bid awarded (best-effort — the PO is what matters).
    try {
      await sabcrmSupplyVendorBidsApi.update(g.ctx.projectId, id, {
        status: 'awarded',
      });
    } catch {
      // Continue — raising the PO is the goal.
    }

    const numberRes = await suggestNextSupplyNumber('purchase-order', g.ctx.projectId);
    const poNo = numberRes.ok
      ? numberRes.data
      : `PO-${new Date().getUTCFullYear()}-0001`;
    const today = new Date().toISOString().slice(0, 10);

    const created = await createSabcrmSupplyPurchaseOrderFull(
      {
        poNo,
        vendorId: bid.vendorId,
        currency: bid.currency || 'INR',
        date: today,
        expectedDelivery: today,
        lines,
        notes: bid.terms,
        fromKind: 'vendorBid',
        fromId: id,
      },
      g.ctx.projectId,
    );
    if (!created.ok) return { ok: false, error: created.error };

    revalidatePath(BIDS_PATH);
    revalidatePath('/sabcrm/supply/purchase-orders');
    return {
      ok: true,
      data: {
        id: created.data._id,
        number: created.data.poNo ?? poNo,
        href: `/sabcrm/supply/purchase-orders/${encodeURIComponent(created.data._id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to create a purchase order from this bid.');
  }
}
