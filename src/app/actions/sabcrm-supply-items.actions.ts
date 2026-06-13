'use server';

/**
 * SabCRM Supply — items surface server actions (rollout spec WI-2).
 *
 * Full doc-surface adoption for `/sabcrm/supply/items`: paged
 * display-ready rows (per-warehouse stock labels batch-resolved — never
 * a raw ObjectId), KPI strip (catalog size, stock on hand, inventory
 * value, low-stock count), capped CSV export and full-field
 * create/update over the complete `CrmItemCreateInput` DTO (identity,
 * pricing, inventory, physical, images).
 *
 * Wire traps honoured here (spec §1.3 / risk #5): `crm-items` is a
 * crm-common-style crate — pagination goes through the supply client's
 * `listPaged`, the SINGLE 0-indexed/1-indexed normalizer (never
 * hand-rolled). The crate's ListQuery only supports `q` — `itemType`
 * and date bounds post-filter the fetched page. `sku` is tenant-unique:
 * the engine's duplicate error surfaces verbatim into the form.
 *
 * Per-surface get/update/delete siblings live in
 * `sabcrm-supply-docs.actions.ts` (WI-1 shared plumbing) and
 * `sabcrm-supply.actions.ts` (back-compat) — this module only adds the
 * verbs the kit needs that those don't carry.
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
  type CrmItemDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type { CrmItemUpdateInput } from '@/lib/rust-client/crm-items';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmSupplyItemFullInput,
  SabcrmSupplyItemFullPatch,
  SabcrmSupplyItemInventoryInput,
  SabcrmSupplyItemKpis,
  SabcrmSupplyItemListFilters,
  SabcrmSupplyItemListPage,
  SabcrmSupplyItemListRow,
} from './sabcrm-supply-items.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ─────── */

const MODULE_KEY = 'sabcrm';
const ITEMS_PATH = '/sabcrm/supply/items';

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

/* ─── Row mapping ──────────────────────────────────────────────── */

/**
 * Batch-resolves warehouse names for the unique ids referenced by the
 * page's inventory rows — one parallel pass, never N+1 per row (spec
 * risk #6). Vanished warehouses resolve to null ("Unknown warehouse").
 */
async function resolveWarehouseLabels(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  await Promise.all(
    [...new Set(ids.filter(Boolean))].map(async (id) => {
      try {
        const w = await sabcrmSupplyWarehousesApi.getById(projectId, id);
        labels.set(id, w.name || 'Unnamed warehouse');
      } catch {
        // Warehouse gone — the row renders "Unknown warehouse".
      }
    }),
  );
  return labels;
}

function isLowStock(doc: CrmItemDoc): boolean {
  if (!doc.isTrackInventory) return false;
  return (doc.inventory ?? []).some(
    (row) =>
      row.reorderPoint !== undefined &&
      row.reorderPoint !== null &&
      (row.stock ?? 0) <= row.reorderPoint,
  );
}

function toRow(
  doc: CrmItemDoc,
  warehouseLabels: Map<string, string>,
): SabcrmSupplyItemListRow {
  return {
    id: String(doc._id ?? ''),
    name: doc.name,
    sku: doc.sku,
    description: doc.description ?? '',
    itemType: doc.itemType === 'service' ? 'service' : 'goods',
    hsnSac: doc.hsnSac ?? '',
    costPrice: doc.costPrice ?? 0,
    sellingPrice: doc.sellingPrice ?? 0,
    taxRate: doc.taxRate ?? null,
    currency: doc.currency || 'INR',
    isTrackInventory: Boolean(doc.isTrackInventory),
    batchTracking: Boolean(doc.batchTracking),
    totalStock: doc.totalStock ?? 0,
    inventory: (doc.inventory ?? []).map((row) => ({
      warehouseId: row.warehouseId,
      warehouseLabel: warehouseLabels.get(row.warehouseId) ?? null,
      stock: row.stock ?? 0,
      reorderPoint: row.reorderPoint ?? undefined,
    })),
    dimensions: doc.dimensions ?? null,
    weight: doc.weight ?? null,
    images: doc.images ?? [],
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? doc.createdAt ?? '',
    lowStock: isLowStock(doc),
  };
}

/** Post-filters the crate can't apply on the wire (q-only ListQuery). */
function applyLocalFilters(
  rows: SabcrmSupplyItemListRow[],
  filters: SabcrmSupplyItemListFilters,
): SabcrmSupplyItemListRow[] {
  let out = rows;
  if (filters.itemType) {
    out = out.filter((r) => r.itemType === filters.itemType);
  }
  if (filters.from || filters.to) {
    const fromKey = filters.from ?? '0000-00-00';
    const toKey = filters.to ?? '9999-12-31';
    out = out.filter((r) => {
      const day = r.updatedAt.slice(0, 10);
      return day >= fromKey && day <= toKey;
    });
  }
  return out;
}

/* ─── List page / export ───────────────────────────────────────── */

/**
 * Lists a page of display-ready item rows. Pagination goes through the
 * supply client's `listPaged` (the single envelope normalizer);
 * warehouse labels are batch-resolved per page.
 */
export async function listSabcrmSupplyItemsPage(
  filters: SabcrmSupplyItemListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyItemListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmSupplyItemsApi.listPaged(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
    });
    const warehouseIds = res.items.flatMap((doc) =>
      (doc.inventory ?? []).map((row) => row.warehouseId),
    );
    const labels = await resolveWarehouseLabels(g.ctx.projectId, warehouseIds);
    const rows = applyLocalFilters(
      res.items.map((doc) => toRow(doc, labels)),
      filters,
    );
    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list items.');
  }
}

/** Pages scanned for export/KPIs (100 docs each, 500 cap). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring current filters. */
export async function exportSabcrmSupplyItemRows(
  filters: SabcrmSupplyItemListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyItemListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmItemDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmSupplyItemsApi.listPaged(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const warehouseIds = docs.flatMap((doc) =>
      (doc.inventory ?? []).map((row) => row.warehouseId),
    );
    const labels = await resolveWarehouseLabels(g.ctx.projectId, warehouseIds);
    const rows = applyLocalFilters(
      docs.map((doc) => toRow(doc, labels)),
      filters,
    );
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export items.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * KPI strip: catalog size (goods/services split), stock on hand,
 * inventory value at cost and low-stock count — ONE capped scan,
 * `sampled: true` when it hits the cap.
 */
export async function getSabcrmSupplyItemKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmSupplyItemKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmItemDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmSupplyItemsApi.listPaged(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES && res.hasMore) sampled = true;
    }

    const currencyVotes = new Map<string, number>();
    let goodsCount = 0;
    let serviceCount = 0;
    let totalStockUnits = 0;
    let stockValue = 0;
    let lowStockCount = 0;
    for (const doc of docs) {
      if (doc.itemType === 'service') serviceCount += 1;
      else goodsCount += 1;
      if (doc.isTrackInventory) {
        totalStockUnits += doc.totalStock ?? 0;
        stockValue += (doc.totalStock ?? 0) * (doc.costPrice ?? 0);
      }
      if (isLowStock(doc)) lowStockCount += 1;
      const code = doc.currency || 'INR';
      currencyVotes.set(code, (currencyVotes.get(code) ?? 0) + 1);
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
        count: docs.length,
        goodsCount,
        serviceCount,
        totalStockUnits: round2(totalStockUnits),
        stockValue: round2(stockValue),
        lowStockCount,
        currency,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute item KPIs.');
  }
}

/* ─── Create / update (full drawer) ────────────────────────────── */

interface CleanNumbersResult {
  ok: boolean;
  error?: string;
}

function checkFinite(
  pairs: [string, number | undefined][],
): CleanNumbersResult {
  for (const [label, value] of pairs) {
    if (value !== undefined && !Number.isFinite(Number(value))) {
      return { ok: false, error: `${label} is invalid.` };
    }
  }
  return { ok: true };
}

/** Drops empty inventory rows + recomputes the stock rollup. */
function cleanInventory(
  rows: SabcrmSupplyItemInventoryInput[] | undefined,
): { inventory: SabcrmSupplyItemInventoryInput[]; totalStock: number } {
  const inventory = (rows ?? [])
    .filter((row) => row.warehouseId)
    .map((row) => ({
      warehouseId: row.warehouseId,
      stock: Number.isFinite(Number(row.stock)) ? Number(row.stock) : 0,
      reorderPoint:
        row.reorderPoint !== undefined &&
        Number.isFinite(Number(row.reorderPoint))
          ? Number(row.reorderPoint)
          : undefined,
    }));
  const totalStock = round2(
    inventory.reduce((sum, row) => sum + row.stock, 0),
  );
  return { inventory, totalStock };
}

function validateItemInput(
  input: SabcrmSupplyItemFullInput | SabcrmSupplyItemFullPatch,
  requireIdentity: boolean,
): string | null {
  if (requireIdentity || input.name !== undefined) {
    if (!input.name?.trim()) return 'An item name is required.';
  }
  if (requireIdentity || input.sku !== undefined) {
    if (!input.sku?.trim()) return 'A SKU is required.';
  }
  if (
    input.itemType !== undefined &&
    input.itemType !== 'goods' &&
    input.itemType !== 'service'
  ) {
    return 'Pick a valid item type.';
  }
  const numbers = checkFinite([
    ['Cost price', input.costPrice],
    ['Selling price', input.sellingPrice],
    ['Tax rate', input.taxRate],
    ['Length', input.dimensions?.length],
    ['Breadth', input.dimensions?.breadth],
    ['Height', input.dimensions?.height],
    ['Volume', input.dimensions?.volume],
    ['Gross weight', input.weight?.gross],
    ['Net weight', input.weight?.net],
  ]);
  if (!numbers.ok) return numbers.error ?? 'A number field is invalid.';
  if (input.taxRate !== undefined && input.taxRate !== null) {
    const t = Number(input.taxRate);
    if (t < 0 || t > 100) return 'Tax rate must be between 0 and 100.';
  }
  return null;
}

/** Full-input → wire DTO (trims strings, recomputes the stock rollup). */
function toWire(
  input: SabcrmSupplyItemFullInput,
): import('@/lib/rust-client/crm-items').CrmItemCreateInput {
  const { inventory, totalStock } = cleanInventory(input.inventory);
  const tracked = input.isTrackInventory !== false;
  return {
    name: input.name.trim(),
    sku: input.sku.trim(),
    description: input.description?.trim() || undefined,
    itemType: input.itemType ?? 'goods',
    hsnSac: input.hsnSac?.trim() || undefined,
    costPrice:
      input.costPrice !== undefined ? round2(Number(input.costPrice)) : undefined,
    sellingPrice:
      input.sellingPrice !== undefined
        ? round2(Number(input.sellingPrice))
        : undefined,
    taxRate: input.taxRate !== undefined ? Number(input.taxRate) : undefined,
    currency: input.currency?.trim().toUpperCase() || undefined,
    isTrackInventory: tracked,
    batchTracking: input.batchTracking,
    inventory: tracked ? inventory : [],
    totalStock: tracked ? totalStock : 0,
    dimensions: input.dimensions,
    weight: input.weight,
    images: (input.images ?? []).filter(Boolean),
  };
}

/**
 * Creates an item from the full drawer (every DTO field). The crate's
 * tenant-unique `sku` violation surfaces as the form error (spec WI-2
 * gotcha).
 */
export async function createSabcrmSupplyItemFull(
  input: SabcrmSupplyItemFullInput,
  projectId?: string,
): Promise<ActionResult<CrmItemDoc>> {
  const problem = validateItemInput(input, true);
  if (problem) return { ok: false, error: problem };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmSupplyItemsApi.create(g.ctx.projectId, toWire(input));
    revalidatePath(ITEMS_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to create the item.');
  }
}

/**
 * Full-field patch (identity, pricing, inventory, physical, images).
 * Only the provided keys hit the wire; inventory edits recompute
 * `totalStock` server-side here so the rollup can't drift.
 */
export async function updateSabcrmSupplyItemFull(
  id: string,
  patch: SabcrmSupplyItemFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmItemDoc>> {
  if (!id) return { ok: false, error: 'Item id is required.' };
  const problem = validateItemInput(patch, false);
  if (problem) return { ok: false, error: problem };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmItemUpdateInput = {};
  if (patch.name !== undefined) wire.name = patch.name.trim();
  if (patch.sku !== undefined) wire.sku = patch.sku.trim();
  if (patch.description !== undefined) {
    wire.description = patch.description.trim();
  }
  if (patch.itemType !== undefined) wire.itemType = patch.itemType;
  if (patch.hsnSac !== undefined) wire.hsnSac = patch.hsnSac.trim();
  if (patch.costPrice !== undefined) {
    wire.costPrice = round2(Number(patch.costPrice));
  }
  if (patch.sellingPrice !== undefined) {
    wire.sellingPrice = round2(Number(patch.sellingPrice));
  }
  if (patch.taxRate !== undefined) wire.taxRate = Number(patch.taxRate);
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.batchTracking !== undefined) {
    wire.batchTracking = patch.batchTracking;
  }
  if (patch.dimensions !== undefined) wire.dimensions = patch.dimensions;
  if (patch.weight !== undefined) wire.weight = patch.weight;
  if (patch.images !== undefined) {
    wire.images = patch.images.filter(Boolean);
  }
  if (patch.isTrackInventory !== undefined || patch.inventory !== undefined) {
    const tracked = patch.isTrackInventory !== false;
    wire.isTrackInventory = tracked;
    const { inventory, totalStock } = cleanInventory(patch.inventory);
    wire.inventory = tracked ? inventory : [];
    wire.totalStock = tracked ? totalStock : 0;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const doc = await sabcrmSupplyItemsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(ITEMS_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to update the item.');
  }
}

