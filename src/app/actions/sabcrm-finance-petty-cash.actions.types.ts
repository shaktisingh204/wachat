/**
 * SabCRM Finance — petty-cash-surface action types (spec §3.15).
 *
 * Shared between `sabcrm-finance-petty-cash.actions.ts` ('use server'
 * modules may only export async functions) and the petty-cash clients.
 */

import type { CrmPettyCashStatus } from '@/lib/rust-client/crm-petty-cash';

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status. */
export const SABCRM_PETTY_CASH_TRANSITIONS: Record<
  CrmPettyCashStatus,
  CrmPettyCashStatus[]
> = {
  active: ['closed'],
  closed: ['active'],
  archived: [],
};

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full petty-cash-float form payload. The custodian is a REAL
 * picked records-engine person when one exists (`custodianId` +
 * `custodianName`); for non-CRM custodians only the free-text name is
 * stored — this surface never mints placeholder ObjectIds.
 */
export interface SabcrmPettyCashFullInput {
  branchName?: string;
  custodianId?: string;
  custodianName?: string;
  openingBalance: number;
  currency?: string;
  notes?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmPettyCashFullPatch = Partial<SabcrmPettyCashFullInput>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmPettyCashListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPettyCashStatus | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to the creation date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (custodian label already resolved). */
export interface SabcrmPettyCashListRow {
  id: string;
  branchLabel: string;
  custodianId: string;
  /** `custodianName` or the batch-resolved person label, else null. */
  custodianLabel: string | null;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  /** Current ÷ opening, 0–1+ (1 when opening is 0). */
  utilisation: number;
  /** True when current < 10% of opening (refill alert). */
  lowBalance: boolean;
  status: CrmPettyCashStatus;
  createdAt: string;
}

export interface SabcrmPettyCashListPage {
  rows: SabcrmPettyCashListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmPettyCashKpis {
  currency: string;
  /** Σ currentBalance across non-archived floats. */
  totalFloatBalance: number;
  /** Floats in `active`. */
  activeCount: number;
  /** Active floats with current < 10% of opening. */
  lowBalanceCount: number;
  /** Floats in `closed`. */
  closedCount: number;
  count: number;
  sampled: boolean;
}
