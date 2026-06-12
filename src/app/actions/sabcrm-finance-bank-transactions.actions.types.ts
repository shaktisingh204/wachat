/**
 * SabCRM Finance — bank-transaction surface action types.
 *
 * Shared between `sabcrm-finance-bank-transactions.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/bank-transactions` doc-surface client
 * (finance-rollout spec §3.10 — DocListPage + Dialog form, the kit's
 * party filter repurposed as an ACCOUNT filter, no detail route).
 */

import type {
  CrmBankTransactionStatus,
  CrmBankTransactionType,
} from '@/lib/rust-client/crm-bank-transactions';

/* ─── Create / update (full dialog payloads) ──────────────────── */

export interface SabcrmBankTransactionFullInput {
  /** REAL picked payment account (`crm_payment_accounts`). Required —
   *  this surface never mints placeholder ids. */
  accountId: string;
  /** `YYYY-MM-DD`. */
  transactionDate: string;
  /** Always positive; direction lives in `type`. */
  amount: number;
  type: CrmBankTransactionType;
  description?: string;
  referenceNumber?: string;
  balanceAfter?: number;
  category?: string;
  /** Link to the journal entry written by the matching flow. */
  voucherEntryId?: string;
  status?: CrmBankTransactionStatus;
  /** SabFiles URL of the source statement (CSV/PDF). */
  sourceFileUrl?: string;
}

export type SabcrmBankTransactionFullPatch =
  Partial<SabcrmBankTransactionFullInput>;

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status. */
export const SABCRM_BANK_TX_TRANSITIONS: Record<
  CrmBankTransactionStatus,
  CrmBankTransactionStatus[]
> = {
  pending: ['cleared'],
  cleared: ['reconciled'],
  reconciled: [],
  archived: [],
};

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmBankTransactionListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmBankTransactionStatus | '';
  /** Kit `partyId` repurposed — payment-account scope. */
  accountId?: string;
  /** Inclusive `YYYY-MM-DD` bounds (native Rust `from`/`to` filter). */
  from?: string;
  to?: string;
}

/**
 * A display-ready list row (account resolved to its name). Carries the
 * full editable field set so the row-click edit dialog seeds without a
 * second fetch.
 */
export interface SabcrmBankTransactionListRow {
  id: string;
  accountId: string;
  /** Resolved payment-account name, or null when it no longer exists. */
  accountLabel: string | null;
  transactionDate: string;
  amount: number;
  type: CrmBankTransactionType;
  description: string;
  referenceNumber: string;
  balanceAfter: number | null;
  category: string;
  /** Linked journal entry, when the matching flow wrote one. */
  voucherEntryId: string | null;
  status: CrmBankTransactionStatus;
  sourceFileUrl: string;
}

export interface SabcrmBankTransactionListPage {
  rows: SabcrmBankTransactionListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmBankTransactionKpis {
  currency: string;
  /** Σ credit amounts dated in the current month. */
  inflowThisMonth: number;
  /** Σ debit amounts dated in the current month. */
  outflowThisMonth: number;
  /** inflow − outflow. */
  netThisMonth: number;
  /** Transactions not yet reconciled (pending + cleared). */
  unreconciledCount: number;
  /** Transactions scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}
