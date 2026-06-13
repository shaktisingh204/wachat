/**
 * SabCRM Supply — items surface action types (rollout spec WI-2).
 *
 * Shared between `sabcrm-supply-items.actions.ts` ('use server' modules
 * may only export async functions) and the `/sabcrm/supply/items`
 * doc-surface client (DocListPage + full-field edit Drawer, no detail
 * route — the drawer doubles as the detail view).
 *
 * Items are master data with NO status field (spec WI-2): the list
 * `statuses` vocabulary is empty and the toolbar select degrades to
 * "All statuses" only. `itemType` rides the party-filter slot instead.
 */

import type {
  CrmItemDimensions,
  CrmItemWeight,
} from '@/lib/rust-client/crm-items';

/* ─── Vocabulary ──────────────────────────────────────────────── */

export type SabcrmSupplyItemType = 'goods' | 'service';

/** Item-type select options (form + list filter). */
export const SABCRM_SUPPLY_ITEM_TYPES: {
  value: SabcrmSupplyItemType;
  label: string;
}[] = [
  { value: 'goods', label: 'Goods' },
  { value: 'service', label: 'Service' },
];

/* ─── Create / update (full drawer payloads) ──────────────────── */

/** One per-warehouse stock row in the drawer's Inventory section. */
export interface SabcrmSupplyItemInventoryInput {
  warehouseId: string;
  stock: number;
  reorderPoint?: number;
}

/**
 * Full-field create payload — every `CreateItemInput` field the crate
 * accepts (spec WI-2: identity, pricing, inventory, physical, images).
 */
export interface SabcrmSupplyItemFullInput {
  name: string;
  sku: string;
  description?: string;
  itemType?: SabcrmSupplyItemType;
  hsnSac?: string;
  /* pricing */
  costPrice?: number;
  sellingPrice?: number;
  taxRate?: number;
  currency?: string;
  /* inventory */
  isTrackInventory?: boolean;
  batchTracking?: boolean;
  inventory?: SabcrmSupplyItemInventoryInput[];
  /* physical */
  dimensions?: CrmItemDimensions;
  weight?: CrmItemWeight;
  /* images — SabFiles URLs only (repo policy: never a URL paste) */
  images?: string[];
}

export type SabcrmSupplyItemFullPatch = Partial<SabcrmSupplyItemFullInput>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmSupplyItemListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' ⇒ all (rides the kit's party-filter slot). */
  itemType?: SabcrmSupplyItemType | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to `updatedAt`. */
  from?: string;
  to?: string;
}

/** A per-warehouse stock row with its label batch-resolved server-side. */
export interface SabcrmSupplyItemInventoryRowResolved {
  warehouseId: string;
  /** Resolved warehouse name (null when the warehouse is gone). */
  warehouseLabel: string | null;
  stock: number;
  reorderPoint?: number;
}

/**
 * A display-ready list row. Carries the FULL editable field set (incl.
 * resolved per-warehouse stock) so the row-click edit drawer seeds
 * without a second fetch — never a raw ObjectId.
 */
export interface SabcrmSupplyItemListRow {
  id: string;
  name: string;
  sku: string;
  description: string;
  itemType: SabcrmSupplyItemType;
  hsnSac: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number | null;
  currency: string;
  isTrackInventory: boolean;
  batchTracking: boolean;
  totalStock: number;
  inventory: SabcrmSupplyItemInventoryRowResolved[];
  dimensions: CrmItemDimensions | null;
  weight: CrmItemWeight | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
  /** Any tracked warehouse row at/below its reorder point. */
  lowStock: boolean;
}

export interface SabcrmSupplyItemListPage {
  rows: SabcrmSupplyItemListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (capped catalog scan). */
export interface SabcrmSupplyItemKpis {
  /** Items scanned. */
  count: number;
  goodsCount: number;
  serviceCount: number;
  /** Σ totalStock over tracked items. */
  totalStockUnits: number;
  /** Σ totalStock × costPrice (cost basis). */
  stockValue: number;
  /** Items with a warehouse row at/below its reorder point. */
  lowStockCount: number;
  /** Majority currency across the catalog. */
  currency: string;
  /** True when the scan hit its cap. */
  sampled: boolean;
}
