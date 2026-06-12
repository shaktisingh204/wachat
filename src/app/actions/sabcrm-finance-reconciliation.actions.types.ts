/**
 * SabCRM Finance — reconciliation surface action types.
 *
 * Shared between `sabcrm-finance-reconciliation.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/reconciliation` doc-surface client. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention; the wire
 * shape is `crm-reconciliation::CrmReconciliation` (crm-common style,
 * 0-indexed list pagination — the actions translate the kit's 1-based
 * pages).
 */

import type { CrmReconciliationStatus } from '@/lib/rust-client/crm-reconciliation';

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status. */
export const SABCRM_RECONCILIATION_TRANSITIONS: Record<
  CrmReconciliationStatus,
  CrmReconciliationStatus[]
> = {
  in_progress: ['completed'],
  completed: [],
  archived: [],
};

/* ─── List page ───────────────────────────────────────────────── */

/** Filters the list page sends to the fetcher (kit page is 1-based). */
export interface SabcrmReconciliationListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' = all statuses (mapped to the crate's `all`). */
  status?: CrmReconciliationStatus | '';
  /** Payment-account filter (the kit's party slot is repurposed). */
  accountId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to `periodStart` (in-page). */
  from?: string;
  to?: string;
}

/** A display-ready list row (account already resolved to a label). */
export interface SabcrmReconciliationListRow {
  id: string;
  accountId: string;
  /** Resolved payment-account name, or null when it no longer exists. */
  accountLabel: string | null;
  /** Account currency for the money columns (defaults to INR). */
  currency: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  matchedCount: number;
  unmatchedCount: number;
  notes: string;
  status: CrmReconciliationStatus;
  finalizedAt: string | null;
  createdAt?: string;
}

export interface SabcrmReconciliationListPage {
  rows: SabcrmReconciliationListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmReconciliationKpis {
  /** Runs scanned. */
  count: number;
  inProgressCount: number;
  completedCount: number;
  /** ISO date of the most recent completed run (null = none yet). */
  lastCompletedAt: string | null;
  /** Σ unmatchedCount over non-archived runs. */
  unmatchedTotal: number;
  /**
   * Latest run's difference: `closing − opening − net bank-tx`
   * (credits − debits over the run's account + period). Null when no
   * runs exist or the bank-transactions engine call failed.
   */
  latestDifference: number | null;
  /** Currency formatting the difference (latest run's account). */
  currency: string;
  /** True when any scan hit a cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Create / update (full form payloads) ────────────────────── */

export interface SabcrmReconciliationFullInput {
  /** REAL picked payment-account id — required, never minted. */
  accountId: string;
  /** `YYYY-MM-DD`. */
  periodStart: string;
  /** `YYYY-MM-DD` (≥ periodStart). */
  periodEnd: string;
  openingBalance?: number;
  closingBalance?: number;
  notes?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmReconciliationFullPatch =
  Partial<SabcrmReconciliationFullInput>;
