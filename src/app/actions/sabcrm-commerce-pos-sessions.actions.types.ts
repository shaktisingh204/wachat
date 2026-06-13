/**
 * SabCRM Commerce — POS sessions surface action types (spec WI-18).
 *
 * Lives beside `sabcrm-commerce-pos-sessions.actions.ts` because `'use
 * server'` modules may only export async functions. Sessions are
 * document-ish (no line items): opening float through close +
 * reconciliation. The open-session payload is the full crate
 * `OpenSessionInput`; lifecycle (close / reconcile / archive) reuses
 * the back-compat verbs.
 */

import type { CrmPosSessionStatus } from '@/lib/rust-client/crm-pos';

export interface SabcrmPosSessionListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** Session status ('' = all). */
  status: CrmPosSessionStatus | '';
}

/** One display-ready POS-session row. */
export interface SabcrmPosSessionListRow {
  id: string;
  terminalId: string;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  closedAt: string | null;
  closingCash: number | null;
  expectedCash: number | null;
  discrepancy: number | null;
  status: CrmPosSessionStatus;
  notes: string | null;
}

export interface SabcrmPosSessionListPage {
  rows: SabcrmPosSessionListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmPosSessionKpis {
  currency: string;
  count: number;
  openCount: number;
  closedCount: number;
  /** Sum of opening cash across the sample. */
  openingCashTotal: number;
  /** Absolute discrepancy sum across reconciled/closed sessions. */
  discrepancyTotal: number;
  sampled: boolean;
}
