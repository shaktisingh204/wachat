'use server';

/**
 * SabCRM Supply — inventory + purchasing server actions.
 *
 * Thin, gated wrappers over the project-scoped re-mounts of the legacy
 * CRM inventory/purchasing Rust crates (`/v1/sabcrm/supply/*`, clients
 * in `@/lib/rust-client/sabcrm-supply`): items, warehouses, stock
 * adjustments, purchase orders, GRNs, vendors, RFQs, vendor bids, BOMs
 * and production orders. Same crates, same Mongo collections as the
 * legacy `/v1/crm/*` mounts, but tenant-scoped by `projectId` instead
 * of `userId`.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-finance.actions.ts` (gate recipe verbatim):
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised into `{ ok: false, error }` so the UI degrades
 * gracefully.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyItemsApi,
  sabcrmSupplyWarehousesApi,
  sabcrmSupplyStockAdjustmentsApi,
  sabcrmSupplyPurchaseOrdersApi,
  sabcrmSupplyGrnsApi,
  sabcrmSupplyVendorsApi,
  sabcrmSupplyRfqsApi,
  sabcrmSupplyVendorBidsApi,
  sabcrmSupplyBomApi,
  sabcrmSupplyProductionOrdersApi,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  SabcrmSupplyListParams,
  CrmItemDoc,
  CrmWarehouseDoc,
  CrmStockAdjustmentDoc,
  CrmPurchaseOrderDoc,
  CrmGrnDoc,
  CrmVendorDoc,
  CrmRfqDoc,
  CrmVendorBidDoc,
  CrmBomDoc,
  CrmProductionOrderDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmSupplyItemFormInput,
  SabcrmSupplyWarehouseFormInput,
  SabcrmSupplyStockAdjustmentFormInput,
  SabcrmSupplyPurchaseOrderFormInput,
  SabcrmSupplyGrnFormInput,
  SabcrmSupplyVendorFormInput,
  SabcrmSupplyRfqFormInput,
  SabcrmSupplyVendorBidFormInput,
  SabcrmSupplyBomFormInput,
  SabcrmSupplyProductionOrderFormInput,
} from './sabcrm-supply.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the Supply UI re-fetches. */
const SUPPLY_BASE = '/sabcrm/supply';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-finance.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
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

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
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

/** Validate a 24-char hex ObjectId picked from a select. */
function isOid(raw: string | undefined): raw is string {
  return typeof raw === 'string' && /^[0-9a-fA-F]{24}$/.test(raw.trim());
}

// ---------------------------------------------------------------------------
// Items (`crm-items` → /v1/sabcrm/supply/items)
// ---------------------------------------------------------------------------

/** Lists the project's inventory items. */
export async function listSabcrmSupplyItems(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmItemDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyItemsApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list items.');
  }
}

/** Creates an inventory item from the "New item" dialog payload. */
export async function createSabcrmSupplyItem(
  input: SabcrmSupplyItemFormInput,
  projectId?: string,
): Promise<ActionResult<CrmItemDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.sku?.trim()) return { ok: false, error: 'A SKU is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyItemsApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      sku: input.sku.trim(),
      sellingPrice: Number(input.sellingPrice ?? 0) || 0,
      costPrice: Number(input.costPrice ?? 0) || 0,
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
      itemType: input.itemType?.trim() || undefined,
    });
    revalidatePath(`${SUPPLY_BASE}/items`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create item.');
  }
}

/** Deletes an inventory item (hard delete — no archive column). */
export async function deleteSabcrmSupplyItem(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Item id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyItemsApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/items`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete item.');
  }
}

// ---------------------------------------------------------------------------
// Warehouses (`crm-warehouses` → /v1/sabcrm/supply/warehouses)
// ---------------------------------------------------------------------------

/** Lists the project's warehouses. */
export async function listSabcrmSupplyWarehouses(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmWarehouseDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyWarehousesApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list warehouses.');
  }
}

/** Creates a warehouse from the "New warehouse" dialog payload. */
export async function createSabcrmSupplyWarehouse(
  input: SabcrmSupplyWarehouseFormInput,
  projectId?: string,
): Promise<ActionResult<CrmWarehouseDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyWarehousesApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      code: input.code?.trim() || undefined,
      type: (input.type?.trim() ||
        undefined) as CrmWarehouseDoc['type'],
      city: input.city?.trim() || undefined,
    });
    revalidatePath(`${SUPPLY_BASE}/warehouses`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create warehouse.');
  }
}

/** Archives a warehouse (crm-common-style soft delete). */
export async function deleteSabcrmSupplyWarehouse(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Warehouse id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyWarehousesApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/warehouses`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive warehouse.');
  }
}

// ---------------------------------------------------------------------------
// Stock adjustments (`crm-stock-adjustments` → /v1/sabcrm/supply/stock-adjustments)
// ---------------------------------------------------------------------------

/** Lists the project's stock adjustments. */
export async function listSabcrmSupplyStockAdjustments(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyStockAdjustmentsApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list stock adjustments.');
  }
}

/** Creates a stock adjustment from the "New adjustment" dialog payload. */
export async function createSabcrmSupplyStockAdjustment(
  input: SabcrmSupplyStockAdjustmentFormInput,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc>> {
  if (!input?.reason?.trim()) {
    return { ok: false, error: 'A reason is required.' };
  }
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity === 0) {
    return { ok: false, error: 'Quantity must be a non-zero number.' };
  }
  if (!isOid(input.warehouseId)) {
    return { ok: false, error: 'Pick a warehouse (create one first if the list is empty).' };
  }
  if (!isOid(input.productId)) {
    return { ok: false, error: 'Pick an item (create one first if the list is empty).' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyStockAdjustmentsApi.create(
      g.ctx.projectId,
      {
        reason: input.reason.trim(),
        quantity,
        warehouseId: input.warehouseId.trim(),
        productId: input.productId.trim(),
        date: input.date ? (toIso(input.date) ?? undefined) : undefined,
        notes: input.notes?.trim() || undefined,
      },
    );
    revalidatePath(`${SUPPLY_BASE}/stock-adjustments`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create stock adjustment.');
  }
}

/** Deletes a stock adjustment (hard delete, matching the crate). */
export async function deleteSabcrmSupplyStockAdjustment(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Adjustment id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyStockAdjustmentsApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${SUPPLY_BASE}/stock-adjustments`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete stock adjustment.');
  }
}

// ---------------------------------------------------------------------------
// Purchase orders (`crm-purchase-orders` → /v1/sabcrm/supply/purchase-orders)
// ---------------------------------------------------------------------------

/** Lists the project's purchase orders. */
export async function listSabcrmSupplyPurchaseOrders(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmPurchaseOrderDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyPurchaseOrdersApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list purchase orders.');
  }
}

/** Creates a purchase order from the "New purchase order" dialog payload. */
export async function createSabcrmSupplyPurchaseOrder(
  input: SabcrmSupplyPurchaseOrderFormInput,
  projectId?: string,
): Promise<ActionResult<CrmPurchaseOrderDoc>> {
  if (!input?.poNo?.trim()) {
    return { ok: false, error: 'A PO number is required.' };
  }
  const date = input.date ? toIso(input.date) : null;
  if (!date) return { ok: false, error: 'A valid date is required.' };
  if (!isOid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor (create one first if the list is empty).' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyPurchaseOrdersApi.create(
      g.ctx.projectId,
      {
        poNo: input.poNo.trim(),
        date,
        vendorId: input.vendorId.trim(),
        currency: input.currency?.trim()
          ? input.currency.trim().toUpperCase()
          : 'INR',
        // Minimal dialog has no line-item editor — a single derived line.
        items: [{ qty: 1, rate: amount, total: amount }],
        totals: { subTotal: amount, total: amount },
      },
    );
    revalidatePath(`${SUPPLY_BASE}/purchase-orders`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create purchase order.');
  }
}

/** Deletes a purchase order (hard delete, matching the crate). */
export async function deleteSabcrmSupplyPurchaseOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Purchase order id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyPurchaseOrdersApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/purchase-orders`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete purchase order.');
  }
}

// ---------------------------------------------------------------------------
// GRNs (`crm-grns` → /v1/sabcrm/supply/grn)
// ---------------------------------------------------------------------------

/** Lists the project's goods-receipt notes. */
export async function listSabcrmSupplyGrns(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmGrnDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyGrnsApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list GRNs.');
  }
}

/** Creates a GRN from the "New GRN" dialog payload. */
export async function createSabcrmSupplyGrn(
  input: SabcrmSupplyGrnFormInput,
  projectId?: string,
): Promise<ActionResult<CrmGrnDoc>> {
  if (!input?.grnNo?.trim()) {
    return { ok: false, error: 'A GRN number is required.' };
  }
  const date = input.date ? toIso(input.date) : null;
  if (!date) return { ok: false, error: 'A valid date is required.' };
  if (!isOid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor (create one first if the list is empty).' };
  }
  if (!isOid(input.warehouseId)) {
    return { ok: false, error: 'Pick a warehouse (create one first if the list is empty).' };
  }
  if (!isOid(input.itemId)) {
    return { ok: false, error: 'Pick an item (create one first if the list is empty).' };
  }
  const qty = Number(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Quantity must be a positive number.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyGrnsApi.create(g.ctx.projectId, {
      grnNo: input.grnNo.trim(),
      date,
      vendorId: input.vendorId.trim(),
      warehouseId: input.warehouseId.trim(),
      // Minimal dialog receives one line in full (no rejections yet).
      items: [
        {
          itemId: input.itemId.trim(),
          orderedQty: qty,
          receivedQty: qty,
          acceptedQty: qty,
          rejectedQty: 0,
        },
      ],
    });
    revalidatePath(`${SUPPLY_BASE}/grn`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create GRN.');
  }
}

/** Deletes a GRN (hard delete, matching the crate). */
export async function deleteSabcrmSupplyGrn(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'GRN id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyGrnsApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/grn`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete GRN.');
  }
}

// ---------------------------------------------------------------------------
// Vendors (`crm-vendors` → /v1/sabcrm/supply/vendors)
// ---------------------------------------------------------------------------

/** Lists the project's vendors. */
export async function listSabcrmSupplyVendors(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmVendorDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyVendorsApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list vendors.');
  }
}

/** Creates a vendor from the "New vendor" dialog payload. */
export async function createSabcrmSupplyVendor(
  input: SabcrmSupplyVendorFormInput,
  projectId?: string,
): Promise<ActionResult<CrmVendorDoc>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyVendorsApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      gstin: input.gstin?.trim() || undefined,
      vendorType: input.vendorType?.trim() || undefined,
    });
    revalidatePath(`${SUPPLY_BASE}/vendors`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create vendor.');
  }
}

/** Deletes a vendor (hard delete — the crate has no archive column). */
export async function deleteSabcrmSupplyVendor(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Vendor id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyVendorsApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/vendors`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete vendor.');
  }
}

// ---------------------------------------------------------------------------
// RFQs (`crm-rfqs` → /v1/sabcrm/supply/rfqs)
// ---------------------------------------------------------------------------

/** Lists the project's RFQs. */
export async function listSabcrmSupplyRfqs(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmRfqDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyRfqsApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list RFQs.');
  }
}

/** Creates an RFQ from the "New RFQ" dialog payload. */
export async function createSabcrmSupplyRfq(
  input: SabcrmSupplyRfqFormInput,
  projectId?: string,
): Promise<ActionResult<CrmRfqDoc>> {
  if (!input?.title?.trim()) {
    return { ok: false, error: 'A title is required.' };
  }
  if (!isOid(input.itemId)) {
    return { ok: false, error: 'Pick an item (create one first if the list is empty).' };
  }
  const qty = Number(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: 'Quantity must be a positive number.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyRfqsApi.create(g.ctx.projectId, {
      title: input.title.trim(),
      items: [{ itemId: input.itemId.trim(), qty }],
      requiredBy: input.requiredBy
        ? (toIso(input.requiredBy) ?? undefined)
        : undefined,
      deadline: input.deadline
        ? (toIso(input.deadline) ?? undefined)
        : undefined,
    });
    revalidatePath(`${SUPPLY_BASE}/rfqs`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create RFQ.');
  }
}

/** Deletes an RFQ (hard delete, matching the crate). */
export async function deleteSabcrmSupplyRfq(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'RFQ id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyRfqsApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/rfqs`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete RFQ.');
  }
}

// ---------------------------------------------------------------------------
// Vendor bids (`crm-vendor-bids` → /v1/sabcrm/supply/vendor-bids)
// ---------------------------------------------------------------------------

/** Lists the project's vendor bids. */
export async function listSabcrmSupplyVendorBids(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmVendorBidDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyVendorBidsApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list vendor bids.');
  }
}

/**
 * Creates a vendor bid from the "New bid" dialog payload. The Rust side
 * is strict here: the parent RFQ must exist within the same project or
 * the create fails with 404.
 */
export async function createSabcrmSupplyVendorBid(
  input: SabcrmSupplyVendorBidFormInput,
  projectId?: string,
): Promise<ActionResult<CrmVendorBidDoc>> {
  if (!isOid(input?.rfqId)) {
    return { ok: false, error: 'Pick an RFQ (create one first if the list is empty).' };
  }
  if (!isOid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor (create one first if the list is empty).' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyVendorBidsApi.create(g.ctx.projectId, {
      rfqId: input.rfqId.trim(),
      vendorId: input.vendorId.trim(),
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : 'INR',
      items: [{ qty: 1, rate: amount }],
      totals: { subTotal: amount, total: amount },
    });
    revalidatePath(`${SUPPLY_BASE}/vendor-bids`);
    revalidatePath(`${SUPPLY_BASE}/rfqs`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create vendor bid.');
  }
}

/** Updates a vendor bid's workflow status (shortlist / award / reject). */
export async function updateSabcrmSupplyVendorBidStatus(
  id: string,
  status: string,
  projectId?: string,
): Promise<ActionResult<CrmVendorBidDoc>> {
  if (!id) return { ok: false, error: 'Bid id is required.' };
  if (!status?.trim()) return { ok: false, error: 'A status is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const updated = await sabcrmSupplyVendorBidsApi.update(g.ctx.projectId, id, {
      status: status.trim(),
    });
    revalidatePath(`${SUPPLY_BASE}/vendor-bids`);
    revalidatePath(`${SUPPLY_BASE}/rfqs`);
    return { ok: true, data: updated };
  } catch (e) {
    return fail(e, 'Failed to update vendor bid.');
  }
}

/** Deletes a vendor bid (hard delete, matching the crate). */
export async function deleteSabcrmSupplyVendorBid(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Bid id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyVendorBidsApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/vendor-bids`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete vendor bid.');
  }
}

// ---------------------------------------------------------------------------
// BOMs (`crm-bom` → /v1/sabcrm/supply/bom)
// ---------------------------------------------------------------------------

/** Lists the project's bills of material. */
export async function listSabcrmSupplyBoms(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmBomDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyBomApi.list(g.ctx.projectId, params);
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list BOMs.');
  }
}

/** Creates a BOM from the "New BOM" dialog payload. */
export async function createSabcrmSupplyBom(
  input: SabcrmSupplyBomFormInput,
  projectId?: string,
): Promise<ActionResult<CrmBomDoc>> {
  if (!input?.bomNo?.trim()) {
    return { ok: false, error: 'A BOM number is required.' };
  }
  if (!input?.finishedGoodName?.trim()) {
    return { ok: false, error: 'A finished good name is required.' };
  }
  const outputQty = Number(input.outputQty);
  if (!Number.isFinite(outputQty) || outputQty <= 0) {
    return { ok: false, error: 'Output quantity must be a positive number.' };
  }
  if (!input?.unit?.trim()) return { ok: false, error: 'A unit is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyBomApi.create(g.ctx.projectId, {
      bomNo: input.bomNo.trim(),
      finishedGoodName: input.finishedGoodName.trim(),
      outputQty,
      unit: input.unit.trim(),
    });
    revalidatePath(`${SUPPLY_BASE}/bom`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create BOM.');
  }
}

/** Archives a BOM (crm-common-style soft delete). */
export async function deleteSabcrmSupplyBom(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'BOM id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyBomApi.delete(g.ctx.projectId, id);
    revalidatePath(`${SUPPLY_BASE}/bom`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive BOM.');
  }
}

// ---------------------------------------------------------------------------
// Production orders (`crm-production-orders` → /v1/sabcrm/supply/production-orders)
// ---------------------------------------------------------------------------

/** Lists the project's production orders. */
export async function listSabcrmSupplyProductionOrders(
  params?: SabcrmSupplyListParams,
  projectId?: string,
): Promise<ActionResult<CrmProductionOrderDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const docs = await sabcrmSupplyProductionOrdersApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: docs };
  } catch (e) {
    return fail(e, 'Failed to list production orders.');
  }
}

/** Creates a production order from the "New production order" dialog payload. */
export async function createSabcrmSupplyProductionOrder(
  input: SabcrmSupplyProductionOrderFormInput,
  projectId?: string,
): Promise<ActionResult<CrmProductionOrderDoc>> {
  if (!input?.finishedGoodName?.trim()) {
    return { ok: false, error: 'A finished good name is required.' };
  }
  const plannedQty = Number(input.plannedQty);
  if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
    return { ok: false, error: 'Planned quantity must be a positive number.' };
  }
  if (!input?.unit?.trim()) return { ok: false, error: 'A unit is required.' };
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const created = await sabcrmSupplyProductionOrdersApi.create(
      g.ctx.projectId,
      {
        finishedGoodName: input.finishedGoodName.trim(),
        plannedQty,
        unit: input.unit.trim(),
        plannedStart: input.plannedStart
          ? (toIso(input.plannedStart) ?? undefined)
          : undefined,
      },
    );
    revalidatePath(`${SUPPLY_BASE}/production-orders`);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create production order.');
  }
}

/** Archives a production order (crm-common-style soft delete). */
export async function deleteSabcrmSupplyProductionOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Production order id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmSupplyProductionOrdersApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(`${SUPPLY_BASE}/production-orders`);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to archive production order.');
  }
}
