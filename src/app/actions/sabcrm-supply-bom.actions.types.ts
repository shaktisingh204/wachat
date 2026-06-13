/**
 * SabCRM Supply — BOM surface action types (rollout WI-10).
 *
 * Shared between `sabcrm-supply-bom.actions.ts` ('use server' modules may
 * only export async functions) and the BOM clients. Status vocabulary +
 * transitions live in `sabcrm-supply-docs.actions.types.ts`
 * (`SabcrmBomStatus`, `SABCRM_BOM_FLOW`, `SABCRM_BOM_TRANSITIONS`).
 */

import type { SabcrmBomStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Components ────────────────────────────────────────────────── */

/** One BOM component draft from the bespoke components editor. */
export interface SabcrmBomComponentInput {
  /** Optional catalog item (free-text components allowed). */
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct?: number;
  optional?: boolean;
  costPerUnit?: number;
}

/* ─── Create / update ──────────────────────────────────────────── */

export interface SabcrmBomFullInput {
  bomNo: string;
  finishedGoodName: string;
  finishedGoodId?: string;
  outputQty: number;
  unit: string;
  effectiveDate?: string;
  version?: string;
  notes?: string;
  components: SabcrmBomComponentInput[];
  labourCost?: number;
  overheadCost?: number;
}

/** Full-form patch — `bomNo` immutable. */
export type SabcrmBomFullPatch = Partial<Omit<SabcrmBomFullInput, 'bomNo'>>;

/* ─── List page / KPIs ─────────────────────────────────────────── */

export interface SabcrmBomListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcrmBomStatus | '';
  from?: string;
  to?: string;
}

export interface SabcrmBomListRow {
  id: string;
  bomNo: string;
  finishedGoodName: string;
  outputQty: number;
  unit: string;
  componentCount: number;
  version: string;
  totalCost: number;
  status: SabcrmBomStatus;
}

export interface SabcrmBomListPage {
  rows: SabcrmBomListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmBomKpis {
  activeCount: number;
  draftCount: number;
  obsoleteCount: number;
  /** Average rolled-up cost over scanned BOMs (0 when none). */
  avgCost: number;
  count: number;
  sampled: boolean;
}
