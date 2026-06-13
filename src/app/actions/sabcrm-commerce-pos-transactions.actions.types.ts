/**
 * SabCRM Commerce — POS transactions surface action types (spec WI-19).
 *
 * Lives beside `sabcrm-commerce-pos-transactions.actions.ts` (`'use
 * server'` modules export only async functions). Transactions are
 * created at the register (WI-22) — no create payload here, only
 * display-ready list rows (session + customer labels resolved, never
 * an ObjectId), filters and the KPI strip.
 */

import type { CrmPosTransactionStatus } from '@/lib/rust-client/crm-pos';

export interface SabcrmPosTransactionListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** Transaction status ('' = all). */
  status: CrmPosTransactionStatus | string;
  /** Toolbar party filter — POS session. */
  sessionId?: string;
  from?: string;
  to?: string;
}

/** One display-ready POS-transaction row. */
export interface SabcrmPosTransactionListRow {
  id: string;
  transactionNumber: string;
  createdAt: string;
  sessionId: string;
  /** Resolved session label (terminal · date) — null renders "Unknown". */
  sessionLabel: string | null;
  customerId: string | null;
  /** Resolved customer name, or "Walk-in" when no customer. */
  customerLabel: string;
  itemsCount: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  status: string;
}

export interface SabcrmPosTransactionListPage {
  rows: SabcrmPosTransactionListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmPosTransactionKpis {
  currency: string;
  count: number;
  completedCount: number;
  completedTotal: number;
  refundedCount: number;
  voidedCount: number;
  sampled: boolean;
}
