/**
 * SabCRM Supply — stock-adjustments surface action types (rollout WI-4).
 *
 * Shared between `sabcrm-supply-stock-adjustments.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/supply/stock-adjustments` doc-surface client (DocForm list +
 * `[id]` DocDetailPage).
 *
 * `crm-stock-adjustments` is a FREE-FORM crm-common crate: the engine
 * validates no status — the UI vocab (`SabcrmStockAdjustmentStatus`,
 * exported by `sabcrm-supply-docs.actions.types.ts`) is the only guard.
 */

import type { SabcrmStockAdjustmentStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Create / update (full DocForm payloads) ─────────────────────── */

/**
 * Full-field create payload — every `CreateStockAdjustmentInput` field
 * the crate accepts (spec WI-4). v1 carries the single product/quantity
 * header the crate requires; multi-line `lines[]` is a documented
 * fast-follow.
 */
export interface SabcrmSupplyStockAdjustmentFullInput {
  adjustmentNumber?: string;
  /** `YYYY-MM-DD`. */
  date: string;
  reason: string;
  referenceNumber?: string;
  warehouseId: string;
  productId: string;
  /** Signed delta (negative = stock out). */
  quantity: number;
  costPerUnit?: number;
  notes?: string;
}

export type SabcrmSupplyStockAdjustmentFullPatch =
  Partial<SabcrmSupplyStockAdjustmentFullInput>;

/* ─── List page / KPIs ────────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmSupplyStockAdjustmentListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' ⇒ all. */
  status?: SabcrmStockAdjustmentStatus | '';
  /** Warehouse record id (rides the kit's party-filter slot). */
  warehouseId?: string;
  productId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to `date`. */
  from?: string;
  to?: string;
}

/**
 * A display-ready list row. Warehouse + product ids are batch-resolved
 * to labels server-side (never a raw ObjectId).
 */
export interface SabcrmSupplyStockAdjustmentListRow {
  id: string;
  adjustmentNumber: string;
  date: string;
  reason: string;
  referenceNumber: string;
  warehouseId: string;
  warehouseLabel: string | null;
  productId: string;
  productLabel: string | null;
  quantity: number;
  costPerUnit: number | null;
  status: SabcrmStockAdjustmentStatus;
  approvedByName: string | null;
  notes: string;
}

export interface SabcrmSupplyStockAdjustmentListPage {
  rows: SabcrmSupplyStockAdjustmentListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (capped scan). */
export interface SabcrmSupplyStockAdjustmentKpis {
  /** Adjustments scanned. */
  count: number;
  draftCount: number;
  approvedCount: number;
  /** Σ |quantity × costPerUnit| over approved adjustments. */
  approvedValue: number;
  /** Net signed Σ quantity across the scan. */
  netUnits: number;
  /** Majority currency (always INR for this crate today). */
  currency: string;
  /** True when the scan hit its cap. */
  sampled: boolean;
}
