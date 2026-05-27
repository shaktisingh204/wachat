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
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

async function _crmSoActorId(): Promise<string | null> {
  try {
    const session = await getSession();
    const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
    const raw = u?._id ?? u?.id;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : String(raw);
  } catch {
    return null;
  }
}
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

interface SalesOrderListResult {
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

/* ─── KPIs ────────────────────────────────────────────────────── */

interface SalesOrderKpis {
  totalOrders: number;
  pending: number;
  fulfilledThisMonth: number;
  totalOrderValue: number;
  currency: string;
}

/**
 * Derive list-page KPIs from a 200-row window. The Rust BFF doesn't
 * expose an aggregate yet (see CRM_REBUILD_PLAN.md Phase 2 W4); when
 * `/sales-orders/counts` lands we'll switch to that.
 */
export async function getSalesOrderKpis(): Promise<SalesOrderKpis> {
  const empty: SalesOrderKpis = {
    totalOrders: 0,
    pending: 0,
    fulfilledThisMonth: 0,
    totalOrderValue: 0,
    currency: 'INR',
  };
  try {
    const docs = await crmSalesOrdersApi.list({ page: 1, limit: 200 });
    if (!Array.isArray(docs) || docs.length === 0) return empty;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let pending = 0;
    let fulfilledThisMonth = 0;
    let totalOrderValue = 0;
    let currency = 'INR';
    for (const d of docs) {
      const s = (d.status ?? '').toLowerCase();
      if (s === 'open' || s === 'partial') pending += 1;
      if (typeof d.totals?.total === 'number') totalOrderValue += d.totals.total;
      if (d.currency) currency = d.currency;
      const dt = d.date ? new Date(d.date).getTime() : NaN;
      if (s === 'fulfilled' && !Number.isNaN(dt) && dt >= monthStart) {
        fulfilledThisMonth += 1;
      }
    }
    return {
      totalOrders: docs.length,
      pending,
      fulfilledThisMonth,
      totalOrderValue: Math.round(totalOrderValue),
      currency,
    };
  } catch {
    return empty;
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
    const actorId = await _crmSoActorId();
    if (actorId) {
      if (!id) {
        void recordFlowAction('crm.salesOrder.created', {
          userId: actorId,
          target: String(result._id),
          metadata: { soNo, clientId, currency },
        });
      } else if (status === 'fulfilled' || status === 'shipped' || status === 'delivered') {
        void recordFlowAction('crm.salesOrder.fulfilled', {
          userId: actorId,
          target: String(result._id),
          metadata: { status },
        });
      } else if (status === 'cancelled') {
        void recordFlowAction('crm.salesOrder.cancelled', {
          userId: actorId,
          target: String(result._id),
        });
      }
    }
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
    const actorId = await _crmSoActorId();
    if (actorId) {
      void recordFlowAction('crm.salesOrder.cancelled', {
        userId: actorId,
        target: id,
        metadata: { op: 'delete' },
      });
    }
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Sales order not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/**
 * Inline status mutation for the sales-order detail page. The CRM_ENUMS
 * `salesOrderStatus` picker exposes the user-facing fulfillment ladder
 * (`draft → confirmed → packed → shipped → delivered` plus
 * `cancelled` / `returned`), while the Rust DTO `CrmSalesOrderStatus`
 * enumerates the shorter `open | partial | fulfilled | closed |
 * cancelled` lifecycle. Map between them so the UI picker can stay
 * granular without the Rust API rejecting writes. P1.1B Wave 2.
 */
const SO_STATUS_TO_RUST: Record<
  string,
  'open' | 'partial' | 'fulfilled' | 'closed' | 'cancelled'
> = {
  draft: 'open',
  confirmed: 'open',
  packed: 'partial',
  shipped: 'partial',
  delivered: 'fulfilled',
  cancelled: 'cancelled',
  returned: 'cancelled',
  // Identity entries so callers passing a Rust value also work.
  open: 'open',
  partial: 'partial',
  fulfilled: 'fulfilled',
  closed: 'closed',
};

export async function setSalesOrderStatus(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing sales-order id.' };
  if (!status) return { success: false, error: 'Missing status.' };
  const mapped = SO_STATUS_TO_RUST[status];
  if (!mapped) {
    return { success: false, error: `Unknown sales-order status: ${status}` };
  }
  try {
    await crmSalesOrdersApi.update(id, { status: mapped });
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    const actorId = await _crmSoActorId();
    if (actorId) {
      void recordFlowAction('crm.salesOrder.statusChanged', {
        userId: actorId,
        target: id,
        metadata: { op: 'setStatus', uiStatus: status, rustStatus: mapped },
      });
    }
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

/* ─── getCrmSalesOrderRelatedCounts ─────────────────────────────────────
 * Right-rail counts (§5.6) for the sales-order detail page. Delivery
 * challans + invoices descend from a SO via lineage / direct FK. All
 * counts tenant-scoped on `userId`.
 */
export async function getCrmSalesOrderRelatedCounts(
  salesOrderId: string,
): Promise<{ deliveryChallans: number; invoices: number }> {
  const empty = { deliveryChallans: 0, invoices: 0 };
  if (!salesOrderId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [salesOrderId];
    if (ObjectId.isValid(salesOrderId)) idCandidates.push(new ObjectId(salesOrderId));

    const [deliveryChallans, invoices] = await Promise.all([
      db
        .collection('crm_delivery_challans')
        .countDocuments({
          userId,
          $or: [
            { salesOrderId: { $in: idCandidates } },
            { soId: { $in: idCandidates } },
            { 'lineage.id': salesOrderId, 'lineage.kind': 'salesOrder' },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_invoices')
        .countDocuments({
          userId,
          $or: [
            { salesOrderId: { $in: idCandidates } },
            { soId: { $in: idCandidates } },
            { 'lineage.id': salesOrderId, 'lineage.kind': 'salesOrder' },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
    ]);

    return {
      deliveryChallans: Number(deliveryChallans) || 0,
      invoices: Number(invoices) || 0,
    };
  } catch (e) {
    console.error('[getCrmSalesOrderRelatedCounts] failed:', e);
    return empty;
  }
}
