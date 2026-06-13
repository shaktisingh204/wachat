'use server';

/**
 * SabCRM Supply — purchase-order surface server actions (rollout WI-5,
 * the flagship of the supply phase).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/purchase-orders`,
 * mirroring the `sabcrm-finance-quotations.actions.ts` structure:
 *
 *   - paged display-ready list rows (vendor labels batch-resolved — no
 *     N+1, no raw ObjectIds reach the client). Pagination goes through
 *     `listPaged` on the supply client — the SINGLE 0-indexed vs
 *     1-indexed envelope normalizer (spec risk #5);
 *   - KPI strip (open PO value, awaiting approval, overdue deliveries,
 *     received this month) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (totals recomputed server-side via the
 *     shared `finance-doc-math` — client totals never trusted);
 *   - related documents (lineage parents + linked GRNs + linked bills);
 *   - convert → vendor bill (`fromKind: 'purchaseOrder'` so the finance
 *     side back-links lineage). The "Receive → GRN" convert is a ROUTE
 *     (`/sabcrm/supply/grn?fromPo=<id>`) so receiving stays a reviewed
 *     form, not a blind copy.
 *
 * Get + status transitions live in the shared module
 * (`sabcrm-supply-docs.actions.ts`) and are not duplicated here.
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
  sabcrmSupplyGrnsApi,
  sabcrmSupplyPurchaseOrdersApi,
  sabcrmSupplyVendorsApi,
  sabcrmSupplyWarehousesApi,
  type CrmPurchaseOrderDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmPurchaseOrderLineItem,
  CrmPurchaseOrderTotals,
  CrmPurchaseOrderUpdateInput,
} from '@/lib/rust-client/crm-purchase-orders';
import { sabcrmFinanceBillsApi } from '@/lib/rust-client/sabcrm-finance';
import {
  computeDocGrandTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmRelatedDocRef } from './sabcrm-finance-invoices.actions.types';
import {
  createSabcrmBillFull,
  getNextSabcrmBillNumber,
} from './sabcrm-finance-bills.actions';
import type { SabcrmPoStatus } from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmPoConvertResult,
  SabcrmPoFullInput,
  SabcrmPoFullPatch,
  SabcrmPoKpis,
  SabcrmPoListFilters,
  SabcrmPoListPage,
  SabcrmPoListRow,
} from './sabcrm-supply-purchase-orders.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ────── */

const MODULE_KEY = 'sabcrm';
const PO_PATH = '/sabcrm/supply/purchase-orders';

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

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Today as `YYYY-MM-DD` (UTC — server-side computation only). */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ─── Money (shared math → wire shapes) ────────────────────────── */

/**
 * Builds the wire `items` + `totals` from form lines + optional header
 * modifiers — authoritative recompute via the shared doc math.
 */
function buildWireMoney(
  lines: DocLineInput[],
  modifiers?: DocTotalsModifiersInput,
):
  | { items: CrmPurchaseOrderLineItem[]; totals: CrmPurchaseOrderTotals }
  | null {
  const meaningful = lines.filter((l) => !isBlankDocLine(l));
  if (meaningful.length === 0) return null;
  const computed = computeDocGrandTotals(meaningful, modifiers);
  return {
    items: computed.lines.map((l) => ({
      itemId: l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
      description: l.description?.trim() || undefined,
      hsnSac: l.hsnSac?.trim() || undefined,
      qty: l.qty,
      unit: l.unit?.trim() || undefined,
      rate: l.rate,
      discountPct: l.discountPct,
      taxRatePct: l.taxRatePct,
      total: l.total,
    })),
    totals: {
      subTotal: computed.subTotal,
      discountOverall: computed.discountOverall || undefined,
      shippingCharge: computed.shippingCharge || undefined,
      adjustment: computed.adjustment || undefined,
      roundOff: computed.roundOff || undefined,
      total: computed.grandTotal,
    },
  };
}

/** Doc total with a zero-totals fallback (Σ line totals). */
function docTotal(doc: CrmPurchaseOrderDoc): number {
  const stored = doc.totals?.total ?? 0;
  if (stored > 0) return stored;
  return (doc.items ?? []).reduce((sum, it) => sum + (it.total ?? 0), 0);
}

/* ─── List page (display-ready rows) ───────────────────────────── */

/** Statuses that still count as "open" buy-side exposure. */
const OPEN_STATUSES = new Set<SabcrmPoStatus>([
  'draft',
  'awaiting_approval',
  'approved',
  'sent',
  'partial',
]);

/** Statuses where a missed expected delivery is actionable. */
const AGEABLE_STATUSES = new Set<SabcrmPoStatus>([
  'approved',
  'sent',
  'partial',
]);

/**
 * Batch-resolves vendor labels for one page of docs (one parallel pass
 * over the unique ids — never per-row N+1; spec risk #6).
 */
async function resolveVendorMap(
  docs: CrmPurchaseOrderDoc[],
  projectId: string,
): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((d) => d.vendorId).filter(Boolean))];
  const map = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const v = await sabcrmSupplyVendorsApi.getById(projectId, id);
        map.set(id, v.displayName || v.name || 'Unnamed vendor');
      } catch {
        // Vendor gone — the row renders the muted "Unknown" fallback.
      }
    }),
  );
  return map;
}

function toListRow(
  doc: CrmPurchaseOrderDoc,
  vendorMap: Map<string, string>,
  today: string,
): SabcrmPoListRow {
  const status = (doc.status ?? 'draft') as SabcrmPoStatus;
  const expected = (doc.expectedDelivery ?? '').slice(0, 10) || null;
  let agingDays: number | null = null;
  if (expected && AGEABLE_STATUSES.has(status) && expected < today) {
    const ms = new Date(today).getTime() - new Date(expected).getTime();
    agingDays = Math.max(1, Math.round(ms / 86_400_000));
  }
  return {
    id: doc._id,
    poNo: doc.poNo,
    vendorId: doc.vendorId ?? '',
    vendorLabel: doc.vendorId
      ? (vendorMap.get(doc.vendorId) ?? null)
      : null,
    date: doc.date,
    expectedDelivery: doc.expectedDelivery ?? null,
    currency: doc.currency || 'INR',
    total: round2(docTotal(doc)),
    status,
    agingDays,
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function applyDateRange(
  docs: CrmPurchaseOrderDoc[],
  from?: string,
  to?: string,
): CrmPurchaseOrderDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.date ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/**
 * Lists a page of display-ready PO rows with vendor labels resolved in
 * one batched pass. Pagination is normalized by `listPaged` (the crate
 * is Identity-style/1-indexed — never hand-rolled here).
 */
export async function listSabcrmSupplyPurchaseOrdersPage(
  filters: SabcrmPoListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPoListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyPurchaseOrdersApi.listPaged(
      g.ctx.projectId,
      {
        page,
        limit,
        q: filters.q || undefined,
        vendorId: filters.vendorId || undefined,
        status: filters.status || undefined,
      },
    );
    const pageDocs = applyDateRange(items, filters.from, filters.to);
    const vendorMap = await resolveVendorMap(pageDocs, g.ctx.projectId);
    const today = todayKey();
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, vendorMap, today)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list purchase orders.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmSupplyPurchaseOrderRows(
  filters: SabcrmPoListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPoListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmPurchaseOrderDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyPurchaseOrdersApi.listPaged(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          vendorId: filters.vendorId || undefined,
          status: filters.status || undefined,
        },
      );
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const vendorMap = await resolveVendorMap(rows, g.ctx.projectId);
    const today = todayKey();
    return {
      ok: true,
      data: rows.map((d) => toListRow(d, vendorMap, today)),
    };
  } catch (e) {
    return fail(e, 'Failed to export purchase orders.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * POs). `sampled: true` flags a capped result.
 */
export async function getSabcrmSupplyPurchaseOrderKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPoKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmPurchaseOrderDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyPurchaseOrdersApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const today = todayKey();
    const monthKey = today.slice(0, 7);
    const currencyVotes = new Map<string, number>();
    let openValue = 0;
    let openCount = 0;
    let awaitingApprovalCount = 0;
    let overdueCount = 0;
    let receivedThisMonth = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as SabcrmPoStatus;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (OPEN_STATUSES.has(status)) {
        openValue += docTotal(doc);
        openCount += 1;
        const expected = (doc.expectedDelivery ?? '').slice(0, 10);
        if (
          expected &&
          expected < today &&
          AGEABLE_STATUSES.has(status)
        ) {
          overdueCount += 1;
        }
      }
      if (status === 'awaiting_approval') awaitingApprovalCount += 1;
      if (
        (status === 'received' || status === 'closed') &&
        (doc.audit?.updatedAt ?? doc.updatedAt ?? doc.date ?? '').slice(0, 7) ===
          monthKey
      ) {
        receivedThisMonth += 1;
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
        openValue: round2(openValue),
        openCount,
        awaitingApprovalCount,
        overdueCount,
        receivedThisMonth,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute purchase order KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Creates a purchase order from the FULL doc form — real picked
 * vendor + warehouse, real line items, server-computed totals,
 * optional lineage parent, optional immediate send (the Identity
 * crate creates in `draft`; `issue` follows up with a vocabulary-legal
 * `draft → sent` PATCH).
 */
export async function createSabcrmSupplyPurchaseOrderFull(
  input: SabcrmPoFullInput,
  projectId?: string,
): Promise<ActionResult<CrmPurchaseOrderDoc>> {
  if (!input?.poNo?.trim()) {
    return { ok: false, error: 'A PO number is required.' };
  }
  if (!input.vendorId || !ObjectId.isValid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor for this purchase order.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid order date is required.' };
  const expectedIso = input.expectedDelivery
    ? toIso(input.expectedDelivery)
    : null;
  if (!expectedIso) {
    return { ok: false, error: 'A valid expected delivery date is required.' };
  }
  if (input.shipToWarehouseId && !ObjectId.isValid(input.shipToWarehouseId)) {
    return { ok: false, error: 'The ship-to warehouse is invalid.' };
  }
  const money = buildWireMoney(input.lines ?? [], input.totalsModifiers);
  if (!money) return { ok: false, error: 'Add at least one line item.' };
  if (money.totals.total < 0) {
    return { ok: false, error: 'The adjustments push the total below zero.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    let created = await sabcrmSupplyPurchaseOrdersApi.create(g.ctx.projectId, {
      poNo: input.poNo.trim(),
      date: dateIso,
      expectedDelivery: expectedIso,
      vendorId: input.vendorId,
      shipToWarehouseId: input.shipToWarehouseId || undefined,
      paymentTerms: input.paymentTerms?.trim() || undefined,
      currency: input.currency.trim().toUpperCase(),
      items: money.items,
      totals: money.totals,
      termsAndConditions: input.termsAndConditions?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      fromKind: input.fromKind,
      fromId:
        input.fromId && ObjectId.isValid(input.fromId)
          ? input.fromId
          : undefined,
    });

    if (input.issue) {
      // Save & send — the crate creates POs in `draft`; `draft → sent`
      // is a legal edge in SABCRM_PO_TRANSITIONS.
      try {
        created = await sabcrmSupplyPurchaseOrdersApi.update(
          g.ctx.projectId,
          created._id,
          { status: 'sent' },
        );
      } catch {
        // The PO exists as a draft either way — surface it rather than
        // failing the whole create.
      }
    }

    revalidatePath(PO_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create the purchase order.');
  }
}

/**
 * Full-form partial update (vendor, dates, lines, warehouse, notes).
 * `poNo` is immutable on the crate's PATCH DTO and never sent; status
 * moves go through `transitionSabcrmSupplyPurchaseOrderStatus`.
 */
export async function updateSabcrmSupplyPurchaseOrderFull(
  id: string,
  patch: SabcrmPoFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmPurchaseOrderDoc>> {
  if (!id) return { ok: false, error: 'Purchase order id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmPurchaseOrderUpdateInput = {};
  if (patch.vendorId !== undefined) {
    if (!patch.vendorId || !ObjectId.isValid(patch.vendorId)) {
      return { ok: false, error: 'Pick a vendor for this purchase order.' };
    }
    wire.vendorId = patch.vendorId;
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The order date is invalid.' };
    wire.date = iso;
  }
  if (patch.expectedDelivery !== undefined) {
    const iso = toIso(patch.expectedDelivery);
    if (!iso) {
      return { ok: false, error: 'The expected delivery date is invalid.' };
    }
    wire.expectedDelivery = iso;
  }
  if (patch.shipToWarehouseId !== undefined) {
    if (patch.shipToWarehouseId && !ObjectId.isValid(patch.shipToWarehouseId)) {
      return { ok: false, error: 'The ship-to warehouse is invalid.' };
    }
    wire.shipToWarehouseId = patch.shipToWarehouseId || undefined;
  }
  if (patch.lines !== undefined) {
    const money = buildWireMoney(patch.lines, patch.totalsModifiers);
    if (!money) return { ok: false, error: 'Add at least one line item.' };
    if (money.totals.total < 0) {
      return { ok: false, error: 'The adjustments push the total below zero.' };
    }
    wire.items = money.items;
    wire.totals = money.totals;
  } else if (patch.totalsModifiers !== undefined) {
    return {
      ok: false,
      error: 'Totals modifiers can only be updated together with line items.',
    };
  }
  if (patch.paymentTerms !== undefined) wire.paymentTerms = patch.paymentTerms;
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (patch.termsAndConditions !== undefined) {
    wire.termsAndConditions = patch.termsAndConditions;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyPurchaseOrdersApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(PO_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the purchase order.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

const KIND_ROUTES: Record<string, string | null> = {
  grn: '/sabcrm/supply/grn',
  bill: '/sabcrm/finance/bills',
  rfq: '/sabcrm/supply/rfqs',
  vendorBid: '/sabcrm/supply/vendor-bids',
};

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: lineage PARENTS (RFQ / vendor
 * bid) plus receiving + billing CHILDREN — linked GRNs (resolved by
 * `poId` query AND `linkedGrnIds`) and linked bills — resolved to real
 * doc numbers + detail routes.
 */
export async function getSabcrmSupplyPurchaseOrderRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Purchase order id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmSupplyPurchaseOrdersApi.getById(
      g.ctx.projectId,
      id,
    );

    const out: SabcrmRelatedDocRef[] = [];

    // Children: every GRN that references this PO (covers docs created
    // before linkedGrnIds back-fill landed).
    try {
      const grns = await sabcrmSupplyGrnsApi.list(g.ctx.projectId, {
        page: 1,
        limit: 50,
        poId: id,
      });
      for (const grn of grns) {
        out.push({
          kind: 'grn',
          id: grn._id,
          label: grn.grnNo || 'GRN',
          href: `${KIND_ROUTES.grn}/${encodeURIComponent(grn._id)}`,
          date: grn.date,
          status: String(grn.status ?? 'draft'),
          direction: 'child',
        });
      }
    } catch {
      // GRN mount down — the rail just omits receipts.
    }

    // Children: linked vendor bills.
    const billIds = [...new Set(doc.linkedBillIds ?? [])];
    await Promise.all(
      billIds.map(async (billId) => {
        const base: SabcrmRelatedDocRef = {
          kind: 'bill',
          id: billId,
          label: 'Bill',
          href: `${KIND_ROUTES.bill}/${encodeURIComponent(billId)}`,
          direction: 'child',
        };
        try {
          const bill = await sabcrmFinanceBillsApi.getById(
            g.ctx.projectId,
            billId,
          );
          base.label = bill.billNo ?? base.label;
          base.date = bill.billDate;
          base.status = bill.status ? String(bill.status) : undefined;
          base.amount = bill.totals?.total;
          base.currency = bill.currency;
        } catch {
          base.href = null;
        }
        out.push(base);
      }),
    );

    // Parents from lineage (RFQ / vendor bid seeds).
    for (const ref of doc.lineage ?? []) {
      if (!ref?.kind || !ref.id || ref.id === id) continue;
      if (ref.kind === 'grn' || ref.kind === 'bill') continue; // children above
      const route = KIND_ROUTES[ref.kind] ?? null;
      out.push({
        kind: ref.kind,
        id: ref.id,
        label: humaniseKind(ref.kind),
        href: route ? `${route}/${encodeURIComponent(ref.id)}` : null,
        direction: 'parent',
      });
    }

    out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Convert (PO → vendor bill) ───────────────────────────────── */

/** PO line items → kit `DocLineInput`s (computed fields dropped). */
function toDocLines(doc: CrmPurchaseOrderDoc): DocLineInput[] {
  return (doc.items ?? []).map((item) => ({
    itemId: item.itemId,
    description: item.description,
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
  }));
}

/**
 * Converts a purchase order into a vendor bill via the finance
 * flagship `createSabcrmBillFull` (server-recomputed totals, lineage
 * `fromKind: 'purchaseOrder'` so the Rust side back-links
 * `linkedBillIds`). The PO's own status is left untouched — billing
 * and receiving advance independently.
 */
export async function convertSabcrmSupplyPurchaseOrderToBill(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPoConvertResult>> {
  if (!id) return { ok: false, error: 'Purchase order id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmSupplyPurchaseOrdersApi.getById(
      g.ctx.projectId,
      id,
    );
    const status = (doc.status ?? 'draft') as SabcrmPoStatus;
    if (status === 'cancelled') {
      return { ok: false, error: "A cancelled purchase order can't be billed." };
    }
    const lines = toDocLines(doc).filter((l) => !isBlankDocLine(l));
    if (lines.length === 0) {
      return {
        ok: false,
        error: 'This purchase order has no line items to bill.',
      };
    }

    const numberRes = await getNextSabcrmBillNumber(g.ctx.projectId);
    const billNo = numberRes.ok
      ? numberRes.data
      : `BILL-${new Date().getUTCFullYear()}-0001`;

    const created = await createSabcrmBillFull(
      {
        billNo,
        vendorId: doc.vendorId,
        currency: doc.currency || 'INR',
        billDate: todayKey(),
        lines,
        notes: doc.notes,
        fromKind: 'purchaseOrder',
        fromId: id,
      },
      g.ctx.projectId,
    );
    if (!created.ok) return { ok: false, error: created.error };

    revalidatePath(PO_PATH);
    revalidatePath('/sabcrm/finance/bills');
    return {
      ok: true,
      data: {
        id: created.data._id,
        number: created.data.billNo ?? billNo,
        href: `/sabcrm/finance/bills/${encodeURIComponent(created.data._id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to create a bill from this purchase order.');
  }
}
