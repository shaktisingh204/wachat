/**
 * SabCRM Supply — Production-order surface action types (rollout WI-11).
 *
 * Shared between `sabcrm-supply-production-orders.actions.ts` ('use
 * server' modules may only export async functions) and the clients.
 * Status vocabulary + transitions live in
 * `sabcrm-supply-docs.actions.types.ts`
 * (`SabcrmProductionOrderStatus`, `SABCRM_PRODUCTION_ORDER_FLOW`,
 * `SABCRM_PRODUCTION_ORDER_TRANSITIONS`).
 */

import type { SabcrmProductionOrderStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Components ────────────────────────────────────────────────── */

/** One production component (no `optional` flag — crate lacks it). */
export interface SabcrmProductionComponentInput {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct?: number;
  costPerUnit?: number;
}

/* ─── Create / update ──────────────────────────────────────────── */

export interface SabcrmProductionOrderFullInput {
  orderNo: string;
  bomRef?: string;
  bomId?: string;
  finishedGoodId?: string;
  finishedGoodName: string;
  plannedQty: number;
  unit: string;
  plannedStart?: string;
  plannedEnd?: string;
  machineId?: string;
  machineOperator?: string;
  machineOperatorId?: string;
  notes?: string;
  components: SabcrmProductionComponentInput[];
  labourCost?: number;
  overheadCost?: number;
}

/** Full-form patch — `orderNo` immutable. */
export type SabcrmProductionOrderFullPatch = Partial<
  Omit<SabcrmProductionOrderFullInput, 'orderNo'>
>;

/* ─── List page / KPIs ─────────────────────────────────────────── */

export interface SabcrmProductionOrderListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcrmProductionOrderStatus | '';
  from?: string;
  to?: string;
}

export interface SabcrmProductionOrderListRow {
  id: string;
  orderNo: string;
  finishedGoodName: string;
  plannedQty: number;
  actualYield: number;
  scrap: number;
  unit: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  machineOperator: string | null;
  totalCost: number;
  status: SabcrmProductionOrderStatus;
}

export interface SabcrmProductionOrderListPage {
  rows: SabcrmProductionOrderListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmProductionOrderKpis {
  plannedCount: number;
  inProgressCount: number;
  completedThisMonth: number;
  /** Σ actualYield over completed orders this scan. */
  unitsYielded: number;
  count: number;
  sampled: boolean;
}

/* ─── BOM prefill (Start production → order) ───────────────────── */

export interface SabcrmProductionOrderBomPrefill {
  bomId: string;
  bomRef: string;
  finishedGoodId: string | null;
  finishedGoodName: string;
  unit: string;
  outputQty: number;
  components: SabcrmProductionComponentInput[];
  labourCost?: number;
  overheadCost?: number;
}
