'use server';

/**
 * SabCRM Supply — doc-surface shared plumbing (rollout spec WI-1).
 *
 * The full-surface verbs the kit rollout needs that the back-compat
 * dialog module (`sabcrm-supply.actions.ts`) never grew:
 *
 *   1. PICKERS — `DocEntityOption[]`-shaped searches for vendors,
 *      warehouses, items (line-item enriched `DocItemOption`), RFQs,
 *      purchase orders and BOMs. Every option carries a HUMAN label,
 *      never a raw ObjectId.
 *   2. NUMBER SUGGESTION — `suggestNextSupplyNumber(kind)`, cloning the
 *      regex-increment of `getNextSabcrmInvoiceNumber`.
 *   3. GET — `getById` for all ten supply entities (edit-drawer seeds +
 *      `[id]` detail server entries).
 *   4. UPDATE — full-DTO patches for the master-data entities (items,
 *      warehouses, vendors) + stock adjustments.
 *   5. TRANSITION — status moves validated against the vocab records in
 *      `sabcrm-supply-docs.actions.types.ts` (Identity crates also
 *      validate server-side; crm-common crates are free-form so these
 *      records are the ONLY guard).
 *
 * Document `createFull`/`updateFull` actions (line mapping via
 * `computeDocTotals`) are per-entity work items (spec §3) and live in
 * the entity's own module-extension pass — NOT here.
 *
 * Paged list fetchers must go through `listPaged` on the supply client
 * (`src/lib/rust-client/sabcrm-supply.ts`) — the single 0-indexed vs
 * 1-indexed normalizer. Never hand-roll pagination in actions.
 *
 * Gate pipeline copied verbatim from `sabcrm-supply.actions.ts`
 * (session → project membership → RBAC → plan), failing closed.
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
import type { CrmItemUpdateInput } from '@/lib/rust-client/crm-items';
import type { CrmWarehouseUpdateInput } from '@/lib/rust-client/crm-warehouses';
import type { CrmVendorUpdateInput } from '@/lib/rust-client/crm-vendors';
import type { CrmStockAdjustmentUpdateInput } from '@/lib/rust-client/crm-stock-adjustments';
import type { CrmBomUpdateInput } from '@/lib/rust-client/crm-bom';
import type { CrmProductionOrderUpdateInput } from '@/lib/rust-client/crm-production-orders';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  DocEntityOption,
  DocItemOption,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import { searchSabcrmFinanceItems } from './sabcrm-finance-invoices.actions';
import {
  SABCRM_PO_TRANSITIONS,
  SABCRM_GRN_TRANSITIONS,
  SABCRM_RFQ_TRANSITIONS,
  SABCRM_STOCK_ADJUSTMENT_TRANSITIONS,
  SABCRM_BOM_TRANSITIONS,
  SABCRM_PRODUCTION_ORDER_TRANSITIONS,
} from './sabcrm-supply-docs.actions.types';
import type {
  SabcrmPoStatus,
  SabcrmGrnStatus,
  SabcrmRfqStatus,
  SabcrmStockAdjustmentStatus,
  SabcrmBomStatus,
  SabcrmProductionOrderStatus,
  SabcrmSupplyNumberKind,
  SabcrmStockAdjustmentTransitionExtras,
  SabcrmProductionOrderTransitionExtras,
} from './sabcrm-supply-docs.actions.types';

// ---------------------------------------------------------------------------
// Constants + gate (mirrors sabcrm-supply.actions.ts verbatim)
// ---------------------------------------------------------------------------

const MODULE_KEY = 'sabcrm';
const SUPPLY_BASE = '/sabcrm/supply';

/** Picker page size (rollout spec WI-1.1 — "trim/limit 10"). */
const PICKER_LIMIT = 10;

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

/** `YYYY-MM-DD` display key from an ISO instant ('' when absent). */
function dayKey(iso: string | undefined): string {
  return (iso ?? '').slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. Pickers (DocEntityOption / DocItemOption shaped)
// ---------------------------------------------------------------------------

/**
 * Vendor party picker (PO/GRN/bid forms + list `partyFilter`).
 * `label = displayName ?? name`, `meta = email ?? vendorType`.
 */
export async function searchSabcrmSupplyVendors(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const vendors = await sabcrmSupplyVendorsApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });
    return {
      ok: true,
      data: vendors
        .filter((v) => v._id)
        .map((v) => ({
          id: String(v._id),
          label: v.displayName || v.name || 'Unnamed vendor',
          meta: v.email || v.vendorType || undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search vendors.');
  }
}

/**
 * Warehouse picker (stock adjustments, GRNs, PO ship-to, item
 * inventory rows). `label = name`, `meta = code ?? city`.
 */
export async function searchSabcrmSupplyWarehouses(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows = await sabcrmSupplyWarehousesApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });
    return {
      ok: true,
      data: rows
        .filter((w) => w._id && w.archived !== true)
        .map((w) => ({
          id: String(w._id),
          label: w.name || 'Unnamed warehouse',
          meta: w.code || w.city || undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search warehouses.');
  }
}

/**
 * Line-item picker, enriched with rate/tax defaults for
 * `LineItemsEditor`. Reuses `searchSabcrmFinanceItems` (same supply
 * catalog, spec WI-1.1) and maps `SabcrmItemOption → DocItemOption`.
 */
export async function searchSabcrmSupplyItemOptions(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocItemOption[]>> {
  const res = await searchSabcrmFinanceItems(q, projectId);
  if (!res.ok) return res;
  return {
    ok: true,
    data: res.data.map((it) => ({
      id: it.id,
      label: it.name,
      meta: it.sku,
      rate: it.sellingPrice,
      taxRatePct: it.taxRate,
      hsnSac: it.hsnSac,
      description: it.description,
    })),
  };
}

/** RFQ reference picker (vendor-bid forms). `label = title`, `meta = status`. */
export async function searchSabcrmSupplyRfqs(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows = await sabcrmSupplyRfqsApi.list(g.ctx.projectId, {
      page: 1, // Identity-style crate — pages are 1-indexed.
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });
    return {
      ok: true,
      data: rows
        .filter((r) => r._id)
        .map((r) => ({
          id: String(r._id),
          label: r.title || 'Untitled RFQ',
          meta: (r.status ?? 'draft').replaceAll('_', ' '),
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search RFQs.');
  }
}

/**
 * Purchase-order reference picker (GRN `poId`). `label = poNo`,
 * `meta = "vendor · date"` — vendor names batch-resolved (≤10 ids, one
 * parallel pass; never a raw ObjectId).
 */
export async function searchSabcrmSupplyPurchaseOrders(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows = await sabcrmSupplyPurchaseOrdersApi.list(g.ctx.projectId, {
      page: 1, // Identity-style crate — pages are 1-indexed.
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });

    // Batch-resolve vendor labels for the option metas.
    const vendorIds = [
      ...new Set(rows.map((r) => r.vendorId).filter(Boolean)),
    ] as string[];
    const vendorNames = new Map<string, string>();
    await Promise.all(
      vendorIds.map(async (id) => {
        try {
          const v = await sabcrmSupplyVendorsApi.getById(g.ctx.projectId, id);
          vendorNames.set(id, v.displayName || v.name || 'Unknown vendor');
        } catch {
          // Vendor gone — meta falls back to the date alone.
        }
      }),
    );

    return {
      ok: true,
      data: rows
        .filter((r) => r._id)
        .map((r) => {
          const vendor = r.vendorId ? vendorNames.get(r.vendorId) : undefined;
          const date = dayKey(r.date);
          return {
            id: String(r._id),
            label: r.poNo || 'Unnumbered PO',
            meta: [vendor, date].filter(Boolean).join(' · ') || undefined,
          };
        }),
    };
  } catch (e) {
    return fail(e, 'Failed to search purchase orders.');
  }
}

/**
 * BOM reference picker (production-order forms).
 * `label = "bomNo — finishedGoodName"`.
 */
export async function searchSabcrmSupplyBoms(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rows = await sabcrmSupplyBomApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });
    return {
      ok: true,
      data: rows
        .filter((b) => b._id)
        .map((b) => ({
          id: String(b._id),
          label: [b.bomNo, b.finishedGoodName].filter(Boolean).join(' — '),
          meta: b.version ? `v${b.version}` : undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search BOMs.');
  }
}

// ---------------------------------------------------------------------------
// 2. Number suggestion
// ---------------------------------------------------------------------------

/**
 * Suggests the next document number for a supply entity, cloning the
 * `getNextSabcrmInvoiceNumber` recipe: scan the latest 100 documents,
 * take the highest numeric suffix and increment it preserving prefix +
 * zero-padding. First document ⇒ the spec's per-kind seed
 * (`PO-<year>-0001`, `GRN-<year>-0001`, `ADJ-<year>-0001`, `BOM-001`,
 * `MO-<year>-0001`).
 */
export async function suggestNextSupplyNumber(
  kind: SabcrmSupplyNumberKind,
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const year = new Date().getUTCFullYear();
  try {
    let numbers: (string | undefined)[];
    let seed: string;
    switch (kind) {
      case 'purchase-order': {
        const rows = await sabcrmSupplyPurchaseOrdersApi.list(g.ctx.projectId, {
          page: 1,
          limit: 100,
        });
        numbers = rows.map((r) => r.poNo);
        seed = `PO-${year}-0001`;
        break;
      }
      case 'grn': {
        const rows = await sabcrmSupplyGrnsApi.list(g.ctx.projectId, {
          page: 1,
          limit: 100,
        });
        numbers = rows.map((r) => r.grnNo);
        seed = `GRN-${year}-0001`;
        break;
      }
      case 'stock-adjustment': {
        const rows = await sabcrmSupplyStockAdjustmentsApi.list(
          g.ctx.projectId,
          { limit: 100 }, // crm-common — omit page for page one (0-indexed).
        );
        numbers = rows.map((r) => r.adjustmentNumber);
        seed = `ADJ-${year}-0001`;
        break;
      }
      case 'bom': {
        const rows = await sabcrmSupplyBomApi.list(g.ctx.projectId, {
          limit: 100,
        });
        numbers = rows.map((r) => r.bomNo);
        seed = 'BOM-001';
        break;
      }
      case 'production-order': {
        const rows = await sabcrmSupplyProductionOrdersApi.list(
          g.ctx.projectId,
          { limit: 100 },
        );
        numbers = rows.map((r) => r.orderNo);
        seed = `MO-${year}-0001`;
        break;
      }
      default:
        return { ok: false, error: 'Unknown document kind.' };
    }

    let best: { prefix: string; num: number; width: number } | null = null;
    for (const raw of numbers) {
      const m = /^(.*?)(\d+)\s*$/.exec(raw ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) return { ok: true, data: seed };
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a document number.');
  }
}

// ---------------------------------------------------------------------------
// 3. Get (edit-drawer seeds + [id] detail server entries)
// ---------------------------------------------------------------------------

/** Loads one inventory item. */
export async function getSabcrmSupplyItem(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmItemDoc>> {
  if (!id) return { ok: false, error: 'Item id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyItemsApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the item.');
  }
}

/** Loads one warehouse. */
export async function getSabcrmSupplyWarehouse(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmWarehouseDoc>> {
  if (!id) return { ok: false, error: 'Warehouse id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyWarehousesApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the warehouse.');
  }
}

/** Loads one stock adjustment. */
export async function getSabcrmSupplyStockAdjustment(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc>> {
  if (!id) return { ok: false, error: 'Adjustment id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyStockAdjustmentsApi.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the stock adjustment.');
  }
}

/** Loads one purchase order. */
export async function getSabcrmSupplyPurchaseOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmPurchaseOrderDoc>> {
  if (!id) return { ok: false, error: 'Purchase order id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyPurchaseOrdersApi.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the purchase order.');
  }
}

/** Loads one goods-receipt note. */
export async function getSabcrmSupplyGrn(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmGrnDoc>> {
  if (!id) return { ok: false, error: 'GRN id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyGrnsApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the GRN.');
  }
}

/** Loads one vendor. */
export async function getSabcrmSupplyVendor(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmVendorDoc>> {
  if (!id) return { ok: false, error: 'Vendor id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyVendorsApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the vendor.');
  }
}

/** Loads one RFQ. */
export async function getSabcrmSupplyRfq(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmRfqDoc>> {
  if (!id) return { ok: false, error: 'RFQ id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyRfqsApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the RFQ.');
  }
}

/** Loads one vendor bid. */
export async function getSabcrmSupplyVendorBid(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmVendorBidDoc>> {
  if (!id) return { ok: false, error: 'Bid id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyVendorBidsApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the vendor bid.');
  }
}

/** Loads one bill of materials. */
export async function getSabcrmSupplyBom(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmBomDoc>> {
  if (!id) return { ok: false, error: 'BOM id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyBomApi.getById(g.ctx.projectId, id);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the BOM.');
  }
}

/** Loads one production order. */
export async function getSabcrmSupplyProductionOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmProductionOrderDoc>> {
  if (!id) return { ok: false, error: 'Production order id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyProductionOrdersApi.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the production order.');
  }
}

// ---------------------------------------------------------------------------
// 4. Update (master data + stock adjustments — full crate PATCH DTOs)
// ---------------------------------------------------------------------------

/** Patches an inventory item with the full `CrmItemUpdateInput` DTO. */
export async function updateSabcrmSupplyItem(
  id: string,
  patch: CrmItemUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmItemDoc>> {
  if (!id) return { ok: false, error: 'Item id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyItemsApi.update(g.ctx.projectId, id, patch);
    revalidatePath(`${SUPPLY_BASE}/items`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the item.');
  }
}

/** Patches a warehouse with the full `CrmWarehouseUpdateInput` DTO. */
export async function updateSabcrmSupplyWarehouse(
  id: string,
  patch: CrmWarehouseUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmWarehouseDoc>> {
  if (!id) return { ok: false, error: 'Warehouse id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyWarehousesApi.update(
      g.ctx.projectId,
      id,
      patch,
    );
    revalidatePath(`${SUPPLY_BASE}/warehouses`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the warehouse.');
  }
}

/** Patches a vendor with the full `CrmVendorUpdateInput` DTO. */
export async function updateSabcrmSupplyVendor(
  id: string,
  patch: CrmVendorUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmVendorDoc>> {
  if (!id) return { ok: false, error: 'Vendor id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyVendorsApi.update(g.ctx.projectId, id, patch);
    revalidatePath(`${SUPPLY_BASE}/vendors`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the vendor.');
  }
}

/** Patches a stock adjustment (header fields — status moves go through
 *  {@link transitionSabcrmSupplyStockAdjustmentStatus}). */
export async function updateSabcrmSupplyStockAdjustment(
  id: string,
  patch: CrmStockAdjustmentUpdateInput,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc>> {
  if (!id) return { ok: false, error: 'Adjustment id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = await sabcrmSupplyStockAdjustmentsApi.update(
      g.ctx.projectId,
      id,
      patch,
    );
    revalidatePath(`${SUPPLY_BASE}/stock-adjustments`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the stock adjustment.');
  }
}

// ---------------------------------------------------------------------------
// 5. Transitions (vocab-validated status moves)
// ---------------------------------------------------------------------------

/**
 * Moves a purchase order along the 8-status workflow, validating the
 * `from → to` edge against {@link SABCRM_PO_TRANSITIONS} (the crate
 * also validates membership server-side).
 */
export async function transitionSabcrmSupplyPurchaseOrderStatus(
  id: string,
  next: SabcrmPoStatus,
  projectId?: string,
): Promise<ActionResult<CrmPurchaseOrderDoc>> {
  if (!id) return { ok: false, error: 'Purchase order id is required.' };
  if (!(next in SABCRM_PO_TRANSITIONS)) {
    return { ok: false, error: 'Invalid purchase order status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmSupplyPurchaseOrdersApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'draft') as SabcrmPoStatus;
    if (!SABCRM_PO_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a purchase order from "${from.replaceAll('_', ' ')}" to "${next.replaceAll('_', ' ')}".`,
      };
    }
    const doc = await sabcrmSupplyPurchaseOrdersApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(`${SUPPLY_BASE}/purchase-orders`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the purchase order status.');
  }
}

/** Moves a GRN along its workflow (vocab-validated). */
export async function transitionSabcrmSupplyGrnStatus(
  id: string,
  next: SabcrmGrnStatus,
  projectId?: string,
): Promise<ActionResult<CrmGrnDoc>> {
  if (!id) return { ok: false, error: 'GRN id is required.' };
  if (!(next in SABCRM_GRN_TRANSITIONS)) {
    return { ok: false, error: 'Invalid GRN status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmSupplyGrnsApi.getById(g.ctx.projectId, id);
    const from = (current.status ?? 'draft') as SabcrmGrnStatus;
    if (!SABCRM_GRN_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a GRN from "${from.replaceAll('_', ' ')}" to "${next.replaceAll('_', ' ')}".`,
      };
    }
    const doc = await sabcrmSupplyGrnsApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(`${SUPPLY_BASE}/grn`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the GRN status.');
  }
}

/** Moves an RFQ along its workflow (vocab-validated). */
export async function transitionSabcrmSupplyRfqStatus(
  id: string,
  next: SabcrmRfqStatus,
  projectId?: string,
): Promise<ActionResult<CrmRfqDoc>> {
  if (!id) return { ok: false, error: 'RFQ id is required.' };
  if (!(next in SABCRM_RFQ_TRANSITIONS)) {
    return { ok: false, error: 'Invalid RFQ status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmSupplyRfqsApi.getById(g.ctx.projectId, id);
    const from = (current.status ?? 'draft') as SabcrmRfqStatus;
    if (!SABCRM_RFQ_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move an RFQ from "${from.replaceAll('_', ' ')}" to "${next.replaceAll('_', ' ')}".`,
      };
    }
    const doc = await sabcrmSupplyRfqsApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(`${SUPPLY_BASE}/rfqs`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the RFQ status.');
  }
}

/**
 * Approves / cancels / re-drafts a stock adjustment. FREE-FORM crate —
 * {@link SABCRM_STOCK_ADJUSTMENT_TRANSITIONS} is the only guard; the
 * approval can carry `approvalNotes`.
 */
export async function transitionSabcrmSupplyStockAdjustmentStatus(
  id: string,
  next: SabcrmStockAdjustmentStatus,
  extras?: SabcrmStockAdjustmentTransitionExtras,
  projectId?: string,
): Promise<ActionResult<CrmStockAdjustmentDoc>> {
  if (!id) return { ok: false, error: 'Adjustment id is required.' };
  if (!(next in SABCRM_STOCK_ADJUSTMENT_TRANSITIONS)) {
    return { ok: false, error: 'Invalid adjustment status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmSupplyStockAdjustmentsApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'draft') as SabcrmStockAdjustmentStatus;
    if (!SABCRM_STOCK_ADJUSTMENT_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move an adjustment from "${from}" to "${next}".`,
      };
    }
    // The crate stores free-form Option<String> status (+ approvalNotes
    // on the doc) — the narrow legacy TS union doesn't cover the UI
    // vocab, so the patch is built loosely and cast at the wire.
    const patch: Record<string, unknown> = { status: next };
    if (extras?.approvalNotes?.trim()) {
      patch.approvalNotes = extras.approvalNotes.trim();
    }
    const doc = await sabcrmSupplyStockAdjustmentsApi.update(
      g.ctx.projectId,
      id,
      patch as CrmStockAdjustmentUpdateInput,
    );
    revalidatePath(`${SUPPLY_BASE}/stock-adjustments`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the adjustment status.');
  }
}

/** Activates / obsoletes a BOM (free-form crate, vocab-guarded). */
export async function transitionSabcrmSupplyBomStatus(
  id: string,
  next: SabcrmBomStatus,
  projectId?: string,
): Promise<ActionResult<CrmBomDoc>> {
  if (!id) return { ok: false, error: 'BOM id is required.' };
  if (!(next in SABCRM_BOM_TRANSITIONS)) {
    return { ok: false, error: 'Invalid BOM status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmSupplyBomApi.getById(g.ctx.projectId, id);
    const from = (current.status ?? 'draft') as SabcrmBomStatus;
    if (!SABCRM_BOM_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a BOM from "${from}" to "${next}".`,
      };
    }
    const doc = await sabcrmSupplyBomApi.update(g.ctx.projectId, id, {
      status: next,
      active: next === 'active',
    } as CrmBomUpdateInput);
    revalidatePath(`${SUPPLY_BASE}/bom`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the BOM status.');
  }
}

/**
 * Moves a production order along its workflow (free-form crate,
 * vocab-guarded). The `completed` move can carry `actualYield` +
 * `scrap` from the completion dialog (spec WI-11).
 */
export async function transitionSabcrmSupplyProductionOrderStatus(
  id: string,
  next: SabcrmProductionOrderStatus,
  extras?: SabcrmProductionOrderTransitionExtras,
  projectId?: string,
): Promise<ActionResult<CrmProductionOrderDoc>> {
  if (!id) return { ok: false, error: 'Production order id is required.' };
  if (!(next in SABCRM_PRODUCTION_ORDER_TRANSITIONS)) {
    return { ok: false, error: 'Invalid production order status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const current = await sabcrmSupplyProductionOrdersApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'planned') as SabcrmProductionOrderStatus;
    if (!SABCRM_PRODUCTION_ORDER_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a production order from "${from.replaceAll('_', ' ')}" to "${next.replaceAll('_', ' ')}".`,
      };
    }
    // Free-form crate — the UI vocab ('completed') is authoritative
    // over the narrow legacy TS union ('complete'); cast at the wire.
    const patch: Record<string, unknown> = { status: next };
    if (next === 'completed') {
      if (Number.isFinite(extras?.actualYield)) {
        patch.actualYield = Number(extras?.actualYield);
      }
      if (Number.isFinite(extras?.scrap)) {
        patch.scrap = Number(extras?.scrap);
      }
    }
    const doc = await sabcrmSupplyProductionOrdersApi.update(
      g.ctx.projectId,
      id,
      patch as CrmProductionOrderUpdateInput,
    );
    revalidatePath(`${SUPPLY_BASE}/production-orders`);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the production order status.');
  }
}
