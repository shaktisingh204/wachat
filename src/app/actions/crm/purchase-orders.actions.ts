'use server';

/**
 * CRM Purchase Order server actions.
 *
 * Thin shims over the Rust BFF (`crmPurchaseOrdersApi`). No direct
 * Mongo access for the core CRUD path. FormData callers (the new/edit
 * pages) hit `savePurchaseOrderAction` / `deletePurchaseOrderAction`;
 * programmatic callers can use the typed helpers (`listPurchaseOrders`,
 * `getPurchaseOrder`).
 *
 * §1D additions (mirror Invoices):
 *  - `computePurchaseOrderKpis()` — list-page KPI strip aggregate.
 *  - `getCrmPurchaseOrderKpis()` — wraps the Rust list call + kpi.
 *  - `getCrmPurchaseOrderRelatedCounts()` — right-rail counts.
 *  - `findPurchaseOrderDuplicates()` — duplicates clustering.
 *  - `bulkArchivePurchaseOrders / bulkDeletePurchaseOrders /
 *    bulkChangePurchaseOrderStatus / bulkApprovePurchaseOrders` — list
 *    bulk-bar wiring.
 *  - `patchPurchaseOrder` / `updatePurchaseOrderStatus` /
 *    `approvePurchaseOrder` — detail-page quick edits.
 *  - `sendPurchaseOrderEmail` — detail-page email composer.
 *
 * Note: `'purchaseOrder'` is intentionally NOT registered as a
 * `WsCustomFieldBelongsTo` key — Purchase Orders skip the custom-field
 * panel entirely, mirroring the procurement audit-trail design.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { RustApiError } from '@/lib/rust-client';
import {
  crmPurchaseOrdersApi,
  type CrmPurchaseOrderCreateInput,
  type CrmPurchaseOrderDoc,
  type CrmPurchaseOrderLineItem,
  type CrmPurchaseOrderListParams,
  type CrmPurchaseOrderStatus,
  type CrmPurchaseOrderTotals,
  type CrmPurchaseOrderUpdateInput,
} from '@/lib/rust-client/crm-purchase-orders';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import {
  computePurchaseOrderKpis,
  type PurchaseOrderKpiSummary,
} from './purchase-orders.kpis';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

const LIST_PATH = '/dashboard/crm/purchases/orders';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function revalidateSurfaces(orderId?: string): void {
  revalidatePath(LIST_PATH);
  if (orderId) {
    revalidatePath(`${LIST_PATH}/${orderId}`);
    revalidatePath(`${LIST_PATH}/${orderId}/edit`);
    revalidatePath(`${LIST_PATH}/${orderId}/activity`);
  }
}

/* ─── Read ────────────────────────────────────────────────────── */

interface PurchaseOrderListResult {
  orders: CrmPurchaseOrderDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listPurchaseOrders(
  params: CrmPurchaseOrderListParams = {},
): Promise<PurchaseOrderListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const orders = await crmPurchaseOrdersApi.list({ ...params, page, limit });
    return { orders, page, limit, hasMore: orders.length === limit };
  } catch (e) {
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { orders: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getPurchaseOrder(
  id: string,
): Promise<{ order: CrmPurchaseOrderDoc | null; error?: string }> {
  if (!id) return { order: null, error: 'Missing purchase order id.' };
  try {
    const order = await crmPurchaseOrdersApi.getById(id);
    return { order };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { order: null, error: 'Purchase order not found.' };
    }
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { order: null, error: rustErr(e) };
  }
}

export async function getPurchaseOrderById(
  id: string,
): Promise<CrmPurchaseOrderDoc | null> {
  const { order } = await getPurchaseOrder(id);
  return order;
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse the form's `items` hidden input — a JSON-encoded
 * `CrmPurchaseOrderLineItem[]`. Returns `[]` when the blob is empty or
 * malformed; the action layer validates the resulting list before
 * sending to Rust.
 */
function parseLineItems(formData: FormData): CrmPurchaseOrderLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is Record<string, unknown> =>
          typeof it === 'object' && it !== null,
      )
      .map((it) => normalizeLineItem(it));
  } catch {
    return [];
  }
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toStringOpt(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function normalizeLineItem(raw: Record<string, unknown>): CrmPurchaseOrderLineItem {
  const qty = toNumber(raw.qty) ?? 0;
  const rate = toNumber(raw.rate) ?? 0;
  const totalFromInput = toNumber(raw.total);
  // Trust the client's `total` when present (it may include discount /
  // tax), otherwise fall back to qty * rate.
  const total = totalFromInput ?? qty * rate;
  return {
    itemId: toStringOpt(raw.itemId),
    description: toStringOpt(raw.description),
    hsnSac: toStringOpt(raw.hsnSac),
    qty,
    unit: toStringOpt(raw.unit),
    rate,
    discountPct: toNumber(raw.discountPct),
    taxRatePct: toNumber(raw.taxRatePct),
    cgstAmount: toNumber(raw.cgstAmount),
    sgstAmount: toNumber(raw.sgstAmount),
    igstAmount: toNumber(raw.igstAmount),
    cessAmount: toNumber(raw.cessAmount),
    total,
    warehouseId: toStringOpt(raw.warehouseId),
    qtyPending: toNumber(raw.qtyPending),
    qtyDelivered: toNumber(raw.qtyDelivered),
    qtyInvoiced: toNumber(raw.qtyInvoiced),
  };
}

/**
 * Compute document totals from the line items + form-level
 * adjustments. The handler can recompute later; we send a stable
 * snapshot so the saved doc reflects what the user saw at submit time.
 */
function computeTotals(
  items: CrmPurchaseOrderLineItem[],
  overrides: {
    discountOverall?: number;
    shippingCharge?: number;
    adjustment?: number;
    roundOff?: number;
    totalOverride?: number;
  },
): CrmPurchaseOrderTotals {
  const subTotal = items.reduce((sum, it) => sum + (it.total || 0), 0);
  const discountOverall = overrides.discountOverall;
  const shippingCharge = overrides.shippingCharge;
  const adjustment = overrides.adjustment;
  const roundOff = overrides.roundOff;
  const total =
    overrides.totalOverride ??
    subTotal -
      (discountOverall ?? 0) +
      (shippingCharge ?? 0) +
      (adjustment ?? 0) +
      (roundOff ?? 0);
  return {
    subTotal,
    discountOverall,
    shippingCharge,
    adjustment,
    roundOff,
    total,
  };
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Purchase Orders have no custom-field bag.
 */
export async function savePurchaseOrderAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = pickString(formData, '_id');
  const poNo = pickString(formData, 'poNo');
  const date = pickString(formData, 'date');
  const vendorId = pickString(formData, 'vendorId');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const items = parseLineItems(formData);

  if (!id) {
    // Required-on-create gate.
    if (!poNo) return { error: 'PO number is required.' };
    if (!date) return { error: 'PO date is required.' };
    if (!vendorId) return { error: 'Vendor is required.' };
    if (items.length === 0) {
      return { error: 'At least one line item is required.' };
    }
  }

  const totals = computeTotals(items, {
    discountOverall: pickNumber(formData, 'discountOverall'),
    shippingCharge: pickNumber(formData, 'shippingCharge'),
    adjustment: pickNumber(formData, 'adjustment'),
    roundOff: pickNumber(formData, 'roundOff'),
    totalOverride: pickNumber(formData, 'totalOverride'),
  });

  // Rust expects an RFC3339 timestamp. The HTML date input gives us
  // `YYYY-MM-DD` — append the start-of-day UTC marker so the parser
  // accepts it.
  const toIso = (d?: string): string | undefined => {
    if (!d) return undefined;
    if (d.includes('T')) return d;
    return `${d}T00:00:00Z`;
  };

  const fromKindRaw = pickString(formData, 'fromKind');
  const fromIdRaw = pickString(formData, 'fromId');

  try {
    let result: CrmPurchaseOrderDoc;
    if (id) {
      const patch: CrmPurchaseOrderUpdateInput = {};
      const isoDate = toIso(date);
      if (isoDate) patch.date = isoDate;
      const isoExpected = toIso(pickString(formData, 'expectedDelivery'));
      if (isoExpected) patch.expectedDelivery = isoExpected;
      if (vendorId) patch.vendorId = vendorId;
      const shipToWarehouseId = pickString(formData, 'shipToWarehouseId');
      if (shipToWarehouseId) patch.shipToWarehouseId = shipToWarehouseId;
      const billingBranchId = pickString(formData, 'billingBranchId');
      if (billingBranchId) patch.billingBranchId = billingBranchId;
      const paymentTerms = pickString(formData, 'paymentTerms');
      if (paymentTerms) patch.paymentTerms = paymentTerms;
      if (currency) patch.currency = currency;
      if (items.length > 0) {
        patch.items = items;
        patch.totals = totals;
      }
      const termsAndConditions = pickString(formData, 'termsAndConditions');
      if (termsAndConditions) patch.termsAndConditions = termsAndConditions;
      const notes = pickString(formData, 'notes');
      if (notes) patch.notes = notes;
      const status = pickString(formData, 'status');
      if (status) patch.status = status;
      result = await crmPurchaseOrdersApi.update(id, patch);
    } else {
      const draft: CrmPurchaseOrderCreateInput = {
        poNo: poNo as string,
        date: toIso(date) as string,
        vendorId: vendorId as string,
        currency,
        items,
        totals,
        expectedDelivery: toIso(pickString(formData, 'expectedDelivery')),
        shipToWarehouseId: pickString(formData, 'shipToWarehouseId'),
        billingBranchId: pickString(formData, 'billingBranchId'),
        paymentTerms: pickString(formData, 'paymentTerms'),
        termsAndConditions: pickString(formData, 'termsAndConditions'),
        notes: pickString(formData, 'notes'),
        ...(fromKindRaw && fromIdRaw
          ? { fromKind: fromKindRaw, fromId: fromIdRaw }
          : {}),
      };
      result = await crmPurchaseOrdersApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'purchaseOrder',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidateSurfaces(String(result._id));
    return {
      message: id ? 'Purchase order updated.' : 'Purchase order created.',
      id: String(result._id),
    };
  } catch (e) {
    recordRustFallback({
      entity: 'purchaseOrder',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a purchase order. The Rust handler removes the row from
 * the collection — no soft-delete flag.
 */
export async function deletePurchaseOrderAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing purchase order id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    await crmPurchaseOrdersApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'purchaseOrder',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Purchase order not found.' };
    }
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createPurchaseOrder(input: CrmPurchaseOrderCreateInput) {
  return crmPurchaseOrdersApi.create(input);
}

export async function updatePurchaseOrder(
  id: string,
  patch: CrmPurchaseOrderUpdateInput,
) {
  return crmPurchaseOrdersApi.update(id, patch);
}

export async function deletePurchaseOrder(id: string) {
  return crmPurchaseOrdersApi.delete(id);
}

/* ─── §1D KPIs ────────────────────────────────────────────────── */

// `computePurchaseOrderKpis` / `PurchaseOrderKpiSummary` live in
// `./purchase-orders.kpis.ts` — pure helpers can't be exported from a
// `'use server'` module.

/**
 * Wrap the Rust list call + KPI computation into a single helper for
 * the list-page server component.
 */
export async function getCrmPurchaseOrderKpis(): Promise<PurchaseOrderKpiSummary> {
  try {
    const orders = await crmPurchaseOrdersApi.list({ page: 1, limit: 200 });
    return computePurchaseOrderKpis(orders);
  } catch (e) {
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return {
      draftCount: 0,
      awaitingApprovalCount: 0,
      approvedCount: 0,
      partialCount: 0,
      closedCount: 0,
      overdueDeliveryCount: 0,
      openValue: 0,
    };
  }
}

/* ─── Related counts (detail right rail) ──────────────────────── */

/**
 * Live related-entity counts for the detail page right rail. Reads
 * directly from Mongo (the Rust BFF doesn't expose a count endpoint).
 */
export async function getCrmPurchaseOrderRelatedCounts(
  poId: string,
): Promise<{
  grns: number;
  bills: number;
  debitNotes: number;
  payouts: number;
  rfqs: number;
  vendorBids: number;
}> {
  const empty = {
    grns: 0,
    bills: 0,
    debitNotes: 0,
    payouts: 0,
    rfqs: 0,
    vendorBids: 0,
  };
  if (!poId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [poId];
    if (ObjectId.isValid(poId)) idCandidates.push(new ObjectId(poId));

    const [grns, bills, debitNotes, payouts, rfqs, vendorBids] =
      await Promise.all([
        db
          .collection('crm_grns')
          .countDocuments({
            userId,
            $or: [
              { purchaseOrderId: { $in: idCandidates } },
              { 'lineage.id': poId, 'lineage.kind': 'purchaseOrder' },
            ],
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_bills')
          .countDocuments({
            userId,
            $or: [
              { purchaseOrderId: { $in: idCandidates } },
              { 'lineage.id': poId, 'lineage.kind': 'purchaseOrder' },
            ],
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_debit_notes')
          .countDocuments({
            userId,
            'lineage.id': poId,
            'lineage.kind': 'purchaseOrder',
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_payouts')
          .countDocuments({
            userId,
            'lineage.id': poId,
            'lineage.kind': 'purchaseOrder',
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_rfqs')
          .countDocuments({
            userId,
            'lineage.id': poId,
            'lineage.kind': 'purchaseOrder',
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_vendor_bids')
          .countDocuments({
            userId,
            'lineage.id': poId,
            'lineage.kind': 'purchaseOrder',
          } as Record<string, unknown>)
          .catch(() => 0),
      ]);

    return {
      grns: Number(grns) || 0,
      bills: Number(bills) || 0,
      debitNotes: Number(debitNotes) || 0,
      payouts: Number(payouts) || 0,
      rfqs: Number(rfqs) || 0,
      vendorBids: Number(vendorBids) || 0,
    };
  } catch (e) {
    console.error('[getCrmPurchaseOrderRelatedCounts] failed:', e);
    return empty;
  }
}

/* ─── Duplicates ──────────────────────────────────────────────── */

interface PurchaseOrderDuplicateGroup {
  key: string;
  members: Array<{
    _id: string;
    poNo: string;
    vendorId?: string;
    total: number;
    currency?: string;
    date?: string;
    status?: string;
  }>;
}

/**
 * Cluster POs that look like accidental duplicates: same
 * `(vendorId, poNo)` or `(vendorId, total)` issued within ±7 days.
 * Read-only — no merge action yet.
 */
export async function findPurchaseOrderDuplicates(): Promise<
  PurchaseOrderDuplicateGroup[]
> {
  const session = await getSession();
  if (!session?.user) return [];
  try {
    const all = await crmPurchaseOrdersApi.list({ page: 1, limit: 500 });
    const sevenDaysMs = 7 * 86_400_000;
    const groups: PurchaseOrderDuplicateGroup['members'][] = [];
    const used = new Set<string>();

    type Row = PurchaseOrderDuplicateGroup['members'][number];
    const rows: Row[] = all.map((d) => ({
      _id: String(d._id),
      poNo: d.poNo ?? '',
      vendorId: d.vendorId,
      total: typeof d.totals?.total === 'number' ? d.totals.total : 0,
      currency: d.currency,
      date: d.date,
      status: typeof d.status === 'string' ? d.status : undefined,
    }));

    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      if (used.has(a._id) || !a.vendorId) continue;
      const cluster: Row[] = [a];
      for (let j = i + 1; j < rows.length; j++) {
        const b = rows[j];
        if (used.has(b._id) || b.vendorId !== a.vendorId) continue;
        const sameNo = a.poNo && a.poNo === b.poNo;
        const ref = Math.max(Math.abs(a.total), Math.abs(b.total), 1);
        const sameAmount = Math.abs(a.total - b.total) / ref <= 0.01;
        let withinWeek = true;
        if (a.date && b.date) {
          const dt = Math.abs(
            new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
          withinWeek = dt <= sevenDaysMs;
        }
        if ((sameNo || sameAmount) && withinWeek) {
          cluster.push(b);
          used.add(b._id);
        }
      }
      if (cluster.length >= 2) {
        used.add(a._id);
        groups.push(cluster);
      }
    }

    return groups.map((cluster, idx) => ({
      key: `${cluster[0].vendorId ?? 'no-vendor'}-${idx}`,
      members: cluster,
    }));
  } catch (e) {
    console.error('[findPurchaseOrderDuplicates] failed:', e);
    return [];
  }
}

/* ─── Bulk ops ────────────────────────────────────────────────── */

async function audit(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  ids: string[],
  action: string,
  reason?: string,
): Promise<void> {
  for (const id of ids) {
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action,
        entityKind: 'purchaseOrder',
        entityId: id,
        reason,
      });
    } catch {
      /* non-fatal */
    }
  }
}

export async function bulkDeletePurchaseOrders(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No purchase orders selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmPurchaseOrdersApi.delete(id);
        processed += 1;
      } catch (e) {
        console.error('[bulkDeletePurchaseOrders] per-row failure:', e);
        recordRustFallback({
          entity: 'purchaseOrder',
          op: 'delete',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await audit(session, valid, 'delete', 'bulk:delete');
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkArchivePurchaseOrders(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No purchase orders selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmPurchaseOrdersApi.update(id, { status: 'cancelled' });
        processed += 1;
      } catch (e) {
        console.error('[bulkArchivePurchaseOrders] per-row failure:', e);
        recordRustFallback({
          entity: 'purchaseOrder',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await audit(session, valid, 'archive', 'bulk:archive');
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkChangePurchaseOrderStatus(
  ids: string[],
  status: CrmPurchaseOrderStatus | string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No purchase orders selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmPurchaseOrdersApi.update(id, { status });
        processed += 1;
      } catch (e) {
        console.error('[bulkChangePurchaseOrderStatus] per-row failure:', e);
        recordRustFallback({
          entity: 'purchaseOrder',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await audit(session, valid, 'status_change', `bulk:status=${status}`);
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkApprovePurchaseOrders(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  return bulkChangePurchaseOrderStatus(ids, 'approved');
}

/* ─── Detail-page quick edits ─────────────────────────────────── */

export async function updatePurchaseOrderStatus(
  id: string,
  status: CrmPurchaseOrderStatus | string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing purchase order id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    await crmPurchaseOrdersApi.update(id, { status });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'purchaseOrder',
        entityId: id,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/**
 * Convenience wrapper for the "Approve" header action — moves the PO
 * to `approved` and stamps audit context (`approval` block update is
 * deferred until the Rust DTO accepts it through PATCH).
 */
export async function approvePurchaseOrder(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return updatePurchaseOrderStatus(id, 'approved');
}

/**
 * Generic patch helper for detail-page quick-edit chips (vendor change,
 * buyer change, expected-delivery reschedule…). Pass any subset of the
 * canonical update shape.
 */
export async function patchPurchaseOrder(
  id: string,
  patch: CrmPurchaseOrderUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing purchase order id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    await crmPurchaseOrdersApi.update(id, patch);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'purchaseOrder',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Email (detail-page composer) ────────────────────────────── */

export async function sendPurchaseOrderEmail(args: {
  poId: string;
  to: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const { poId, to, subject } = args;
  if (!poId || !to || !subject) {
    return { success: false, error: 'Missing required field.' };
  }
  try {
    // Mark sent on the doc + audit. Real SMTP delivery hooks live
    // outside this file; this action is the persistence/audit half.
    await crmPurchaseOrdersApi.update(poId, { status: 'sent' });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'send',
        entityKind: 'purchaseOrder',
        entityId: poId,
        reason: `email:to=${to}`,
        diff: { subject: { after: subject } },
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(poId);
    return { success: true };
  } catch (e) {
    recordRustFallback({
      entity: 'purchaseOrder',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}
