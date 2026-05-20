/**
 * Shared types for the canonical Items module client islands.
 *
 * `ItemListRow` is the wire-format the server-side `page.tsx` projects its
 * docs into before handing them off to the client tables / grid. IDs are
 * stringified so the components stay serialization-safe.
 *
 * Keep this file in sync with `saveCrmProduct` (FormData keys) and the
 * `CrmProduct` Mongo shape — `page.tsx` is responsible for the projection.
 */

export interface ItemInventoryRow {
  warehouseId: string;
  stock: number;
  reorderPoint?: number;
}

export interface ItemListRow {
  _id: string;
  name: string;
  sku: string;
  description?: string;
  itemType?: 'goods' | 'service' | 'bundle';
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  vendorIds?: string[];
  taxRateId?: string | null;
  hsnSac?: string;
  barcode?: string;

  currency: string;
  costPrice: number;
  sellingPrice: number;
  taxRate?: number;

  isTrackInventory: boolean;
  inventory: ItemInventoryRow[];
  totalStock: number;
  reorderPoint?: number;

  thumbnail?: string;
  status?: 'active' | 'archived';

  createdAt?: string;
  updatedAt?: string;
}

export interface ItemKpiSnapshot {
  totalCount: number;
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValue: number;
  /** Items with `totalStock > 0` (or untracked items, which are always
   *  considered in-stock since they aren't inventory-managed). */
  inStockCount: number;
}

export type ItemPresetKey =
  | 'all'
  | 'active'
  | 'low-stock'
  | 'out-of-stock'
  | 'archived';

export type ItemViewMode = 'table' | 'grid';

export type ItemDensity = 'comfortable' | 'compact' | 'dense';

/**
 * Per-row low-stock predicate. Tracks inventory + below per-row reorder
 * point (falling back to the doc-level reorderPoint when unset).
 */
export function isLowStock(row: ItemListRow): boolean {
  if (!row.isTrackInventory) return false;
  if (row.totalStock <= 0) return false;
  const rp = row.reorderPoint ?? row.inventory.find((i) => (i.reorderPoint ?? 0) > 0)?.reorderPoint ?? 0;
  if (rp <= 0) return false;
  return row.totalStock <= rp;
}

export function isOutOfStock(row: ItemListRow): boolean {
  return row.isTrackInventory && row.totalStock <= 0;
}

export function inventoryValue(row: ItemListRow): number {
  if (!row.isTrackInventory) return 0;
  return (row.costPrice || 0) * (row.totalStock || 0);
}
