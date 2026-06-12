/**
 * SabCRM Finance — budget-surface action types (spec §3.16).
 *
 * Shared between `sabcrm-finance-budgets.actions.ts` ('use server'
 * modules may only export async functions) and the budget clients.
 */

import type { CrmBudgetStatus } from '@/lib/rust-client/crm-budgets';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed manual transitions per current status. NB: the crate's
 * create DTO has NO status — budgets are born `draft`; everything else
 * moves through these transitions (spec §3.16).
 */
export const SABCRM_BUDGET_TRANSITIONS: Record<
  CrmBudgetStatus,
  CrmBudgetStatus[]
> = {
  draft: ['approved', 'rejected'],
  approved: ['locked'],
  rejected: ['draft'],
  locked: [],
  archived: [],
};

/* ─── Create / update (full form payloads) ────────────────────── */

/** The full budget form payload. */
export interface SabcrmBudgetFullInput {
  budgetHead: string;
  department?: string;
  /** `FY 2026-27` / `2026-06` — free-form period key. */
  period: string;
  plannedAmount: number;
  currency?: string;
  notes?: string;
}

/**
 * Full-form patch — also patches `actualAmount` ("record actuals").
 * Status changes go through the transition action instead.
 */
export type SabcrmBudgetFullPatch = Partial<SabcrmBudgetFullInput> & {
  actualAmount?: number;
};

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmBudgetListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmBudgetStatus | '';
  department?: string;
  period?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the creation date. */
  from?: string;
  to?: string;
}

/** A display-ready list row. */
export interface SabcrmBudgetListRow {
  id: string;
  budgetHead: string;
  department: string;
  period: string;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  /** actual ÷ planned (0 when planned is 0). */
  utilisation: number;
  /** True when actual > planned. */
  overBudget: boolean;
  status: CrmBudgetStatus;
  createdAt: string;
}

export interface SabcrmBudgetListPage {
  rows: SabcrmBudgetListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmBudgetKpis {
  currency: string;
  /** Σ plannedAmount across non-archived budgets. */
  plannedTotal: number;
  /** Σ actualAmount across non-archived budgets. */
  actualTotal: number;
  /** actualTotal ÷ plannedTotal as a percentage (0 when no plan). */
  utilisationPct: number;
  /** Heads where actual > planned. */
  overBudgetCount: number;
  count: number;
  sampled: boolean;
}
