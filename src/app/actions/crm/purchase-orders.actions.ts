'use server';

/**
 * CRM Purchase Order server actions.
 *
 * Thin shims over the Rust BFF (`crmPurchaseOrdersApi`). No direct
 * Mongo access. FormData callers (the list/edit pages) hit
 * `savePurchaseOrderAction` / `deletePurchaseOrderAction`; programmatic
 * callers can use the typed helpers (`listPurchaseOrders`,
 * `getPurchaseOrder`).
 *
 * Note: `'purchaseOrder'` is intentionally NOT registered as a
 * `WsCustomFieldBelongsTo` key — Purchase Orders skip the custom-field
 * panel entirely, mirroring the procurement audit-trail design.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmPurchaseOrdersApi,
  type CrmPurchaseOrderCreateInput,
  type CrmPurchaseOrderDoc,
  type CrmPurchaseOrderLineItem,
  type CrmPurchaseOrderListParams,
  type CrmPurchaseOrderTotals,
  type CrmPurchaseOrderUpdateInput,
} from '@/lib/rust-client/crm-purchase-orders';

const LIST_PATH = '/dashboard/crm/purchases/orders';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface PurchaseOrderListResult {
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
    return { order: null, error: rustErr(e) };
  }
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
      };
      result = await crmPurchaseOrdersApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Purchase order updated.' : 'Purchase order created.',
      id: String(result._id),
    };
  } catch (e) {
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
  try {
    await crmPurchaseOrdersApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Purchase order not found.' };
    }
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
