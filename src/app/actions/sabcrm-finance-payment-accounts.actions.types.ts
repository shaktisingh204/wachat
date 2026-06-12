/**
 * SabCRM Finance — payment-account surface action types.
 *
 * Shared between `sabcrm-finance-payment-accounts.actions.ts` ('use
 * server' modules may only export async functions) and the
 * `/sabcrm/finance/payment-accounts` doc-surface client (finance-rollout
 * spec §3.9 — DocListPage + full-field edit Dialog, no detail route).
 */

import type {
  CrmBankAccountDetails,
  CrmPaymentAccountStatus,
  CrmPaymentAccountType,
} from '@/lib/rust-client/crm-payment-accounts';

/* ─── Create / update (full dialog payloads) ──────────────────── */

export interface SabcrmPaymentAccountFullInput {
  accountName: string;
  accountType: CrmPaymentAccountType;
  openingBalance?: number;
  /** `YYYY-MM-DD`. */
  openingBalanceDate?: string;
  currency?: string;
  isDefault?: boolean;
  /** Bank section (shown when `accountType === 'bank'`). */
  bankDetails?: CrmBankAccountDetails;
}

export type SabcrmPaymentAccountFullPatch =
  Partial<SabcrmPaymentAccountFullInput> & {
    status?: CrmPaymentAccountStatus;
  };

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmPaymentAccountListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPaymentAccountStatus | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to `openingBalanceDate`. */
  from?: string;
  to?: string;
}

/**
 * A display-ready list row. Carries the full editable field set so the
 * row-click edit dialog seeds without a second fetch.
 */
export interface SabcrmPaymentAccountListRow {
  id: string;
  accountName: string;
  accountType: string;
  status: CrmPaymentAccountStatus;
  openingBalance: number;
  openingBalanceDate: string;
  currency: string;
  isDefault: boolean;
  bankDetails?: CrmBankAccountDetails;
}

export interface SabcrmPaymentAccountListPage {
  rows: SabcrmPaymentAccountListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (current balance computed over a capped tx scan). */
export interface SabcrmPaymentAccountKpis {
  currency: string;
  /** Σ openingBalance over non-archived accounts. */
  totalOpeningBalance: number;
  /**
   * Σ openingBalance + Σ(bank-tx credit − debit) over the scanned
   * transactions — a floor when `sampled`.
   */
  currentBalance: number;
  activeCount: number;
  /** Non-archived accounts scanned. */
  count: number;
  /** Name of the default account, when one is flagged. */
  defaultAccountName: string | null;
  /** True when the bank-transaction scan hit its cap. */
  sampled: boolean;
}
