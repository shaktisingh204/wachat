'use server';

/**
 * SabCRM Finance — sales-order-surface server actions.
 *
 * The doc-surface-kit data paths for `/sabcrm/finance/sales-orders`
 * (finance-rollout spec §3.2), mirroring the flagship
 * `sabcrm-finance-invoices.actions.ts` structure:
 *
 *   - paged display-ready list rows (party labels batch-resolved — no
 *     N+1, no raw ObjectIds reach the client);
 *   - KPI strip (open order value, awaiting fulfillment, fulfilled this
 *     month, due-to-ship in 7 days) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (totals recomputed server-side; the DTO
 *     accepts `totals` so list money is exact). NB: the Rust
 *     `UpdateSalesOrderInput` can't change `soNo`/`clientId` — those
 *     fields are locked on edit;
 *   - status transitions validated against the crate vocabulary AND the
 *     `SABCRM_SALES_ORDER_TRANSITIONS` map;
 *   - related documents (parent quotation + invoice/delivery children);
 *   - converts → invoice / proforma (advance request).
 *
 * Every action re-runs the session → project → RBAC → plan gate;
 * engine failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceApi,
  sabcrmFinanceProformaInvoicesApi,
  sabcrmFinanceQuotationsApi,
  sabcrmFinanceSalesOrdersApi,
  type SabcrmSalesOrderDoc,
  type SabcrmSalesOrderUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmSalesOrderLineItem,
  CrmSalesOrderStatus,
  CrmSalesOrderTotals,
} from '@/lib/rust-client/crm-sales-orders';
import {
  computeDocGrandTotals,
  computeDocTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  createSabcrmInvoiceFull,
  getNextSabcrmInvoiceNumber,
  resolveSabcrmFinanceParties,
} from './sabcrm-finance-invoices.actions';
import type {
  SabcrmPartyRef,
  SabcrmRelatedDocRef,
} from './sabcrm-finance-invoices.actions.types';
import {
  SABCRM_SALES_ORDER_TRANSITIONS,
  type SabcrmSalesOrderConvertResult,
  type SabcrmSalesOrderFullInput,
  type SabcrmSalesOrderFullPatch,
  type SabcrmSalesOrderKpis,
  type SabcrmSalesOrderListFilters,
  type SabcrmSalesOrderListPage,
  type SabcrmSalesOrderListRow,
} from './sabcrm-finance-sales-orders.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const SALES_ORDERS_PATH = '/sabcrm/finance/sales-orders';

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

/* ─── Money (shared math → wire shapes) ────────────────────────── */

/** Form lines + modifiers → wire `items` + `totals` (authoritative). */
function buildWireMoney(
  lines: DocLineInput[],
  modifiers?: DocTotalsModifiersInput,
): { items: CrmSalesOrderLineItem[]; totals: CrmSalesOrderTotals } | null {
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

/** Validates the optional exchange rate (finite, > 0). */
function cleanExchangeRate(
  v: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Exchange rate must be a positive number.' };
  }
  return { ok: true, value: n };
}

/* ─── List page (display-ready rows) ───────────────────────────── */

function toListRow(
  doc: SabcrmSalesOrderDoc,
  partyMap: Map<string, SabcrmPartyRef>,
): SabcrmSalesOrderListRow {
  const party = doc.clientId ? partyMap.get(doc.clientId) : undefined;
  return {
    id: doc._id,
    soNo: doc.soNo,
    poNo: doc.poNo ?? null,
    partyId: doc.clientId ?? '',
    partyLabel: party?.label ?? null,
    partyObjectSlug: party?.objectSlug ?? null,
    date: doc.date,
    expectedShipmentDate: doc.expectedShipmentDate ?? null,
    currency: doc.currency,
    total: round2(doc.totals?.total ?? 0),
    status: (doc.status ?? 'open') as CrmSalesOrderStatus,
  };
}

function applyDateRange(
  docs: SabcrmSalesOrderDoc[],
  from?: string,
  to?: string,
): SabcrmSalesOrderDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.date ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

async function resolvePartyMap(
  docs: SabcrmSalesOrderDoc[],
  projectId: string,
): Promise<Map<string, SabcrmPartyRef>> {
  const partyIds = [...new Set(docs.map((d) => d.clientId).filter(Boolean))];
  const partyMap = new Map<string, SabcrmPartyRef>();
  if (partyIds.length > 0) {
    const refs = await resolveSabcrmFinanceParties(partyIds, projectId);
    if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
  }
  return partyMap;
}

/**
 * Lists a page of display-ready sales-order rows with party labels
 * resolved in one batched pass. 1-indexed pagination; `hasMore` derived
 * from a full page (same caveat as invoices).
 */
export async function listSabcrmSalesOrdersPage(
  filters: SabcrmSalesOrderListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinanceSalesOrdersApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      clientId: filters.clientId || undefined,
      status: filters.status || undefined,
    });
    const pageDocs = applyDateRange(docs, filters.from, filters.to);
    const hasMore = docs.length === limit;
    const partyMap = await resolvePartyMap(pageDocs, g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, partyMap)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list sales orders.');
  }
}

/**
 * Fetches a single sales order (the shared tranche file exposes no
 * getter for this entity — 404 ⇒ `{ ok: false }`).
 */
export async function getSabcrmSalesOrderDoc(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc>> {
  if (!id) return { ok: false, error: 'Sales-order id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceSalesOrdersApi.getById(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load sales order.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmSalesOrderRows(
  filters: SabcrmSalesOrderListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmSalesOrderDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceSalesOrdersApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        clientId: filters.clientId || undefined,
        status: filters.status || undefined,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const partyMap = await resolvePartyMap(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, partyMap)) };
  } catch (e) {
    return fail(e, 'Failed to export sales orders.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * orders). `sampled: true` flags a capped result.
 */
export async function getSabcrmSalesOrderKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmSalesOrderDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceSalesOrdersApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const shipCutoff = now.getTime() + 7 * 86_400_000;
    const currencyVotes = new Map<string, number>();
    let openValue = 0;
    let awaitingCount = 0;
    let fulfilledThisMonth = 0;
    let dueToShipCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'open') as CrmSalesOrderStatus;
      const total = doc.totals?.total ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      const awaiting = status === 'open' || status === 'partial';
      if (awaiting) {
        openValue += total;
        awaitingCount += 1;
        if (doc.expectedShipmentDate) {
          const ship = new Date(doc.expectedShipmentDate).getTime();
          if (Number.isFinite(ship) && ship <= shipCutoff) {
            dueToShipCount += 1;
          }
        }
      }
      if (
        status === 'fulfilled' &&
        (doc.updatedAt ?? doc.date ?? '').slice(0, 7) === monthKey
      ) {
        fulfilledThisMonth += 1;
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
        awaitingCount,
        fulfilledThisMonth,
        dueToShipCount,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute sales-order KPIs.');
  }
}

/* ─── Numbering ────────────────────────────────────────────────── */

/** Highest numeric suffix + 1 (padding preserved); else `SO-<yr>-0001`. */
function nextNumberFrom(numbers: (string | undefined)[], prefix: string): string {
  let best: { prefix: string; num: number; width: number } | null = null;
  for (const number of numbers) {
    const m = /^(.*?)(\d+)\s*$/.exec(number ?? '');
    if (!m) continue;
    const num = Number(m[2]);
    if (!Number.isFinite(num)) continue;
    if (!best || num > best.num) {
      best = { prefix: m[1], num, width: m[2].length };
    }
  }
  if (!best) return `${prefix}-${new Date().getUTCFullYear()}-0001`;
  const next = String(best.num + 1).padStart(best.width, '0');
  return `${best.prefix}${next}`;
}

/** Suggests the next SO number from the latest documents. */
export async function getNextSabcrmSalesOrderNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceSalesOrdersApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    return { ok: true, data: nextNumberFrom(docs.map((d) => d.soNo), 'SO') };
  } catch (e) {
    return fail(e, 'Failed to suggest a sales-order number.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Creates a sales order from the FULL doc form — real picked party,
 * server-computed totals, optional quotation link (which also seeds
 * lineage via `fromKind: 'quotation'` when no explicit parent is sent).
 */
export async function createSabcrmSalesOrderFull(
  input: SabcrmSalesOrderFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc>> {
  if (!input?.soNo?.trim()) {
    return { ok: false, error: 'A sales-order number is required.' };
  }
  if (!input.clientId || !ObjectId.isValid(input.clientId)) {
    return { ok: false, error: 'Pick a customer for this sales order.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid order date is required.' };
  const poDateIso = input.poDate ? toIso(input.poDate) : undefined;
  if (input.poDate && !poDateIso) {
    return { ok: false, error: 'The PO date is invalid.' };
  }
  const shipIso = input.expectedShipmentDate
    ? toIso(input.expectedShipmentDate)
    : undefined;
  if (input.expectedShipmentDate && !shipIso) {
    return { ok: false, error: 'The expected shipment date is invalid.' };
  }
  if (input.quotationRef && !ObjectId.isValid(input.quotationRef)) {
    return { ok: false, error: 'The linked quotation is invalid.' };
  }
  const money = buildWireMoney(input.lines ?? [], input.totalsModifiers);
  if (!money) return { ok: false, error: 'Add at least one line item.' };
  if (money.totals.total < 0) {
    return { ok: false, error: 'The adjustments push the total below zero.' };
  }
  const fx = cleanExchangeRate(input.exchangeRate);
  if (!fx.ok) return { ok: false, error: fx.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // A picked quotation doubles as the lineage parent unless the
    // caller passed an explicit one (converts do).
    const fromKind =
      input.fromKind ?? (input.quotationRef ? 'quotation' : undefined);
    const fromId =
      input.fromId && ObjectId.isValid(input.fromId)
        ? input.fromId
        : fromKind === 'quotation'
          ? input.quotationRef
          : undefined;

    const created = await sabcrmFinanceSalesOrdersApi.create(g.ctx.projectId, {
      soNo: input.soNo.trim(),
      date: dateIso,
      clientId: input.clientId,
      quotationRef: input.quotationRef || undefined,
      poNo: input.poNo?.trim() || undefined,
      poDate: poDateIso ?? undefined,
      expectedShipmentDate: shipIso ?? undefined,
      deliveryMethod: input.deliveryMethod,
      paymentTerms: input.paymentTerms?.trim() || undefined,
      currency: input.currency.trim().toUpperCase(),
      exchangeRate: fx.value,
      items: money.items,
      totals: money.totals,
      customerNotes: input.customerNotes?.trim() || undefined,
      internalNotes: input.internalNotes?.trim() || undefined,
      status: 'open',
      fromKind,
      fromId,
    });

    revalidatePath(SALES_ORDERS_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create sales order.');
  }
}

/**
 * Full-form partial update. `soNo` / `clientId` are immutable on the
 * Rust DTO — the form locks them, and this action rejects attempts.
 */
export async function updateSabcrmSalesOrderFull(
  id: string,
  patch: SabcrmSalesOrderFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc>> {
  if (!id) return { ok: false, error: 'Sales-order id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmSalesOrderUpdateInput = {};
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The order date is invalid.' };
    wire.date = iso;
  }
  if (patch.quotationRef !== undefined) {
    if (patch.quotationRef && !ObjectId.isValid(patch.quotationRef)) {
      return { ok: false, error: 'The linked quotation is invalid.' };
    }
    wire.quotationRef = patch.quotationRef || undefined;
  }
  if (patch.poNo !== undefined) wire.poNo = patch.poNo;
  if (patch.poDate !== undefined) {
    if (patch.poDate) {
      const iso = toIso(patch.poDate);
      if (!iso) return { ok: false, error: 'The PO date is invalid.' };
      wire.poDate = iso;
    }
  }
  if (patch.expectedShipmentDate !== undefined) {
    if (patch.expectedShipmentDate) {
      const iso = toIso(patch.expectedShipmentDate);
      if (!iso) {
        return { ok: false, error: 'The expected shipment date is invalid.' };
      }
      wire.expectedShipmentDate = iso;
    }
  }
  if (patch.deliveryMethod !== undefined) {
    wire.deliveryMethod = patch.deliveryMethod;
  }
  if (patch.paymentTerms !== undefined) wire.paymentTerms = patch.paymentTerms;
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.exchangeRate !== undefined) {
    const fx = cleanExchangeRate(patch.exchangeRate);
    if (!fx.ok) return { ok: false, error: fx.error };
    wire.exchangeRate = fx.value;
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
  if (patch.customerNotes !== undefined) {
    wire.customerNotes = patch.customerNotes;
  }
  if (patch.internalNotes !== undefined) {
    wire.internalNotes = patch.internalNotes;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceSalesOrdersApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(SALES_ORDERS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update sales order.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map.
 */
export async function transitionSabcrmSalesOrderStatus(
  id: string,
  next: CrmSalesOrderStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc>> {
  if (!id) return { ok: false, error: 'Sales-order id is required.' };
  if (!(next in SABCRM_SALES_ORDER_TRANSITIONS)) {
    return { ok: false, error: 'Invalid sales-order status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceSalesOrdersApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'open') as CrmSalesOrderStatus;
    if (!SABCRM_SALES_ORDER_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a sales order from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceSalesOrdersApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(SALES_ORDERS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the sales-order status.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: parent quotation (`quotationRef` +
 * lineage), invoice children (`linkedInvoiceIds` + lineage back-links)
 * and delivery children (`linkedDeliveryIds`, no surface yet — label
 * only).
 */
export async function getSabcrmSalesOrderRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Sales-order id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinanceSalesOrdersApi.getById(g.ctx.projectId, id);
    const out: SabcrmRelatedDocRef[] = [];
    const seen = new Set<string>();

    // ---- Parent quotation ------------------------------------------------
    const quotationIds = new Set<string>();
    if (doc.quotationRef) quotationIds.add(doc.quotationRef);
    for (const ref of doc.lineage ?? []) {
      if (ref.kind === 'quotation' && ref.id) quotationIds.add(ref.id);
    }
    await Promise.all(
      [...quotationIds].map(async (qid) => {
        const key = `quotation:${qid}`;
        if (seen.has(key)) return;
        seen.add(key);
        const base: SabcrmRelatedDocRef = {
          kind: 'quotation',
          id: qid,
          label: 'Quotation',
          href: `/sabcrm/finance/quotations/${encodeURIComponent(qid)}`,
          direction: 'parent',
        };
        try {
          const q = await sabcrmFinanceQuotationsApi.getById(
            g.ctx.projectId,
            qid,
          );
          base.label = q.quotationNo ?? base.label;
          base.date = q.date;
          base.status = q.status;
        } catch {
          base.href = null;
        }
        out.push(base);
      }),
    );

    // ---- Other lineage parents (deal / lead) ------------------------------
    for (const ref of doc.lineage ?? []) {
      if (ref.kind === 'quotation' || !ref.id) continue;
      const key = `${ref.kind}:${ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: ref.kind,
        id: ref.id,
        label: humaniseKind(ref.kind),
        href: null,
        direction: ref.kind === 'invoice' ? 'child' : 'parent',
      });
    }

    // ---- Invoice children --------------------------------------------------
    await Promise.all(
      (doc.linkedInvoiceIds ?? []).map(async (invId) => {
        const key = `invoice:${invId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const base: SabcrmRelatedDocRef = {
          kind: 'invoice',
          id: invId,
          label: 'Invoice',
          href: `/sabcrm/finance/invoices/${encodeURIComponent(invId)}`,
          direction: 'child',
        };
        try {
          const inv = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, invId);
          base.label = inv.invoiceNo ?? base.label;
          base.date = inv.date;
          base.status = inv.status;
          base.amount = inv.totals?.total;
          base.currency = inv.currency;
        } catch {
          base.href = null;
        }
        out.push(base);
      }),
    );

    // ---- Delivery children (no surface yet — label only) -------------------
    for (const delId of doc.linkedDeliveryIds ?? []) {
      const key = `delivery:${delId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: 'delivery',
        id: delId,
        label: 'Delivery',
        href: null,
        direction: 'child',
      });
    }

    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Converts (SO → invoice / proforma) ───────────────────────── */

/** SO line items → kit `DocLineInput`s (fulfillment quartet dropped). */
function toDocLines(doc: SabcrmSalesOrderDoc): DocLineInput[] {
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

/** Today as `YYYY-MM-DD` (UTC — server-side suggestion only). */
function todayKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Loads + guards a sales order that can still produce documents. */
async function loadConvertible(
  projectId: string,
  id: string,
): Promise<
  { ok: true; doc: SabcrmSalesOrderDoc } | { ok: false; error: string }
> {
  const doc = await sabcrmFinanceSalesOrdersApi.getById(projectId, id);
  const status = (doc.status ?? 'open') as CrmSalesOrderStatus;
  if (status === 'cancelled') {
    return { ok: false, error: "A cancelled sales order can't be converted." };
  }
  if ((doc.items ?? []).length === 0) {
    return { ok: false, error: 'This sales order has no line items to convert.' };
  }
  return { ok: true, doc };
}

/**
 * Converts a sales order into an invoice via the flagship
 * `createSabcrmInvoiceFull` (`fromKind: 'salesOrder'` seeds lineage and
 * back-links this SO).
 */
export async function convertSabcrmSalesOrderToInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderConvertResult>> {
  if (!id) return { ok: false, error: 'Sales-order id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const guard = await loadConvertible(g.ctx.projectId, id);
    if (!guard.ok) return { ok: false, error: guard.error };
    const doc = guard.doc;

    const numberRes = await getNextSabcrmInvoiceNumber(g.ctx.projectId);
    const invoiceNo = numberRes.ok
      ? numberRes.data
      : `INV-${new Date().getUTCFullYear()}-0001`;

    const created = await createSabcrmInvoiceFull(
      {
        invoiceNo,
        clientId: doc.clientId,
        currency: doc.currency,
        date: todayKey(),
        dueDate: todayKey(30),
        lines: toDocLines(doc),
        paymentTerms: doc.paymentTerms,
        customerNotes: doc.customerNotes,
        fromKind: 'salesOrder',
        fromId: id,
      },
      g.ctx.projectId,
    );
    if (!created.ok) return { ok: false, error: created.error };

    revalidatePath(SALES_ORDERS_PATH);
    return {
      ok: true,
      data: {
        id: created.data._id,
        number: created.data.invoiceNo,
        href: `/sabcrm/finance/invoices/${encodeURIComponent(created.data._id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to convert the sales order to an invoice.');
  }
}

/**
 * Creates a proforma invoice (advance request) from a sales order on
 * the legacy mounted shape — the SO link persists via the proforma's
 * G3 `linkedSoId`.
 */
export async function convertSabcrmSalesOrderToProforma(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderConvertResult>> {
  if (!id) return { ok: false, error: 'Sales-order id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const guard = await loadConvertible(g.ctx.projectId, id);
    if (!guard.ok) return { ok: false, error: guard.error };
    const doc = guard.doc;

    const lines = toDocLines(doc).filter((l) => !isBlankDocLine(l));
    if (lines.length === 0) {
      return {
        ok: false,
        error: 'This sales order has no line items to convert.',
      };
    }
    const computed = computeDocTotals(lines);

    const existing = await sabcrmFinanceProformaInvoicesApi.list(
      g.ctx.projectId,
      { limit: 100 },
    );
    const proformaNumber = (() => {
      let best: { prefix: string; num: number; width: number } | null = null;
      for (const row of existing.items) {
        const m = /^(.*?)(\d+)\s*$/.exec(row.proformaNumber ?? '');
        if (!m) continue;
        const num = Number(m[2]);
        if (!Number.isFinite(num)) continue;
        if (!best || num > best.num) {
          best = { prefix: m[1], num, width: m[2].length };
        }
      }
      if (!best) return `PI-${new Date().getUTCFullYear()}-0001`;
      return `${best.prefix}${String(best.num + 1).padStart(best.width, '0')}`;
    })();

    const created = await sabcrmFinanceProformaInvoicesApi.create(
      g.ctx.projectId,
      {
        proformaNumber,
        accountId: doc.clientId,
        proformaDate: new Date().toISOString(),
        currency: doc.currency,
        linkedSoId: id,
        expectedDelivery: doc.expectedShipmentDate || undefined,
        lineItems: computed.lines.map((l) => ({
          itemId:
            l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
          description: l.description?.trim() || 'Item',
          quantity: l.qty,
          rate: l.rate,
          unit: l.unit?.trim() || undefined,
          taxPct: l.taxRatePct,
          amount: l.total,
        })),
        notes: doc.customerNotes,
        taxTotal: computed.taxTotal || undefined,
        discountTotal: computed.discountTotal || undefined,
      },
    );

    revalidatePath(SALES_ORDERS_PATH);
    revalidatePath('/sabcrm/finance/proforma-invoices');
    return {
      ok: true,
      data: {
        id: created.id,
        number: created.entity.proformaNumber,
        href: `/sabcrm/finance/proforma-invoices/${encodeURIComponent(created.id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to create a proforma from the sales order.');
  }
}
