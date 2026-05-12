'use server';

/**
 * CRM Sales Order server actions.
 *
 * Thin shims over the Rust BFF (`crmSalesOrdersApi`). No direct Mongo
 * access. FormData callers (the list page + the form) hit
 * `saveSalesOrderAction` / `deleteSalesOrderAction`; programmatic
 * callers can use the typed helpers.
 *
 * NB: `sales-order` is intentionally NOT in `WsCustomFieldBelongsTo`
 * — this entity skips the worksuite custom-fields layer entirely.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmSalesOrdersApi,
  type CrmSalesOrderCreateInput,
  type CrmSalesOrderDoc,
  type CrmSalesOrderLineItem,
  type CrmSalesOrderListParams,
  type CrmSalesOrderStatus,
  type CrmSalesOrderTotals,
  type CrmSalesOrderUpdateInput,
} from '@/lib/rust-client/crm-sales-orders';

const LIST_PATH = '/dashboard/crm/sales/orders';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface SalesOrderListResult {
  orders: CrmSalesOrderDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listSalesOrders(
  params: CrmSalesOrderListParams = {},
): Promise<SalesOrderListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const orders = await crmSalesOrdersApi.list({ ...params, page, limit });
    return { orders, page, limit, hasMore: orders.length === limit };
  } catch (e) {
    return { orders: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getSalesOrder(
  id: string,
): Promise<{ order: CrmSalesOrderDoc | null; error?: string }> {
  if (!id) return { order: null, error: 'Missing sales-order id.' };
  try {
    const order = await crmSalesOrdersApi.getById(id);
    return { order };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { order: null, error: 'Sales order not found.' };
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

/** YYYY-MM-DD → end-of-day-free ISO 8601 the Rust DateTime<Utc> parser accepts. */
function toIso(date: string | undefined): string | undefined {
  if (!date) return undefined;
  if (date.includes('T')) return date;
  return new Date(`${date}T00:00:00Z`).toISOString();
}

function parseLineItems(formData: FormData): CrmSalesOrderLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const qty = Number(r.qty);
        const rate = Number(r.rate);
        if (!Number.isFinite(qty) || !Number.isFinite(rate)) return null;
        const taxRatePct =
          r.taxRatePct == null || r.taxRatePct === ''
            ? undefined
            : Number(r.taxRatePct);
        const lineSubtotal = qty * rate;
        const lineTotal =
          taxRatePct != null && Number.isFinite(taxRatePct)
            ? lineSubtotal * (1 + taxRatePct / 100)
            : lineSubtotal;
        const item: CrmSalesOrderLineItem = {
          itemId:
            typeof r.itemId === 'string' && r.itemId.length > 0
              ? r.itemId
              : undefined,
          description:
            typeof r.description === 'string' && r.description.length > 0
              ? r.description
              : undefined,
          hsnSac:
            typeof r.hsnSac === 'string' && r.hsnSac.length > 0
              ? r.hsnSac
              : undefined,
          qty,
          unit:
            typeof r.unit === 'string' && r.unit.length > 0
              ? r.unit
              : undefined,
          rate,
          taxRatePct:
            taxRatePct != null && Number.isFinite(taxRatePct)
              ? taxRatePct
              : undefined,
          total: Number(lineTotal.toFixed(2)),
        };
        return item;
      })
      .filter((row): row is CrmSalesOrderLineItem => row !== null);
  } catch {
    return [];
  }
}

function computeTotals(
  items: CrmSalesOrderLineItem[],
  formData: FormData,
): CrmSalesOrderTotals {
  const subTotal = items.reduce((sum, it) => sum + it.qty * it.rate, 0);
  const total = items.reduce((sum, it) => sum + it.total, 0);
  const shippingCharge = pickNumber(formData, 'shippingCharge');
  const discountOverall = pickNumber(formData, 'discountOverall');
  const adjustment = pickNumber(formData, 'adjustment');
  const finalTotal = Number(
    (
      total +
      (shippingCharge ?? 0) -
      (discountOverall ?? 0) +
      (adjustment ?? 0)
    ).toFixed(2),
  );
  return {
    subTotal: Number(subTotal.toFixed(2)),
    discountOverall,
    shippingCharge,
    adjustment,
    total: finalTotal,
  };
}

const VALID_STATUSES: ReadonlySet<CrmSalesOrderStatus> = new Set<CrmSalesOrderStatus>([
  'open',
  'partial',
  'fulfilled',
  'closed',
  'cancelled',
]);

function pickStatus(formData: FormData): CrmSalesOrderStatus | undefined {
  const raw = pickString(formData, 'status');
  if (!raw) return undefined;
  const lc = raw.toLowerCase() as CrmSalesOrderStatus;
  return VALID_STATUSES.has(lc) ? lc : undefined;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. There is no custom-field round-trip here — sales orders are
 * not registered with the worksuite custom-field system.
 */
export async function saveSalesOrderAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const soNo = pickString(formData, 'soNo');
  const clientId = pickString(formData, 'clientId');
  const dateStr = pickString(formData, 'date');
  const currency = pickString(formData, 'currency') ?? 'INR';

  const items = parseLineItems(formData);
  const totals = computeTotals(items, formData);

  // On create the Rust endpoint requires soNo / clientId / date /
  // currency / items / totals.
  if (!id) {
    if (!soNo) return { error: 'Order number is required.' };
    if (!clientId) return { error: 'Customer is required.' };
    if (!dateStr) return { error: 'Order date is required.' };
    if (items.length === 0) return { error: 'Add at least one line item.' };
  }

  const status = pickStatus(formData);

  try {
    let result: CrmSalesOrderDoc;
    if (id) {
      const patch: CrmSalesOrderUpdateInput = {
        date: toIso(dateStr),
        poNo: pickString(formData, 'poNo'),
        poDate: toIso(pickString(formData, 'poDate')),
        expectedShipmentDate: toIso(pickString(formData, 'expectedShipmentDate')),
        paymentTerms: pickString(formData, 'paymentTerms'),
        currency: currency,
        items: items.length > 0 ? items : undefined,
        totals: items.length > 0 ? totals : undefined,
        customerNotes: pickString(formData, 'customerNotes'),
        internalNotes: pickString(formData, 'internalNotes'),
        status,
      };
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ) as CrmSalesOrderUpdateInput;
      result = await crmSalesOrdersApi.update(id, clean);
    } else {
      const draft: CrmSalesOrderCreateInput = {
        soNo: soNo!,
        date: toIso(dateStr)!,
        clientId: clientId!,
        poNo: pickString(formData, 'poNo'),
        poDate: toIso(pickString(formData, 'poDate')),
        expectedShipmentDate: toIso(pickString(formData, 'expectedShipmentDate')),
        paymentTerms: pickString(formData, 'paymentTerms'),
        currency,
        items,
        totals,
        customerNotes: pickString(formData, 'customerNotes'),
        internalNotes: pickString(formData, 'internalNotes'),
        status: status ?? 'open',
      };
      result = await crmSalesOrdersApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Sales order updated.' : 'Sales order created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a sales order. The Rust handler removes the row from
 * the collection — no soft-delete flag.
 */
export async function deleteSalesOrderAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing sales-order id.' };
  try {
    await crmSalesOrdersApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Sales order not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createSalesOrder(input: CrmSalesOrderCreateInput) {
  return crmSalesOrdersApi.create(input);
}

export async function updateSalesOrder(
  id: string,
  patch: CrmSalesOrderUpdateInput,
) {
  return crmSalesOrdersApi.update(id, patch);
}

export async function deleteSalesOrder(id: string) {
  return crmSalesOrdersApi.delete(id);
}
