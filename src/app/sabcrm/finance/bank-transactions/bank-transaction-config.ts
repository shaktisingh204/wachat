/**
 * SabCRM Finance — bank-transaction surface config (client-safe).
 *
 * Status defs + tones, the happy-path flow, type/category vocabulary
 * and the kit-filters mapper (finance-rollout spec §3.10). The kit's
 * party filter is repurposed as an ACCOUNT filter — `partyId` maps to
 * the Rust `accountId` query param.
 */

import type {
  CrmBankTransactionStatus,
  CrmBankTransactionType,
} from '@/lib/rust-client/crm-bank-transactions';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmBankTransactionListFilters } from '@/app/actions/sabcrm-finance-bank-transactions.actions.types';

export const BANK_TX_STATUSES: (DocStatusDef & {
  value: CrmBankTransactionStatus;
})[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'cleared', label: 'Cleared', tone: 'info' },
  { value: 'reconciled', label: 'Reconciled', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path: pending → cleared → reconciled. */
export const BANK_TX_FLOW: CrmBankTransactionStatus[] = [
  'pending',
  'cleared',
  'reconciled',
];

export const BANK_TX_TYPES: {
  value: CrmBankTransactionType;
  label: string;
}[] = [
  { value: 'credit', label: 'Credit (money in)' },
  { value: 'debit', label: 'Debit (money out)' },
];

export function bankTxTypeLabel(value: string | undefined): string {
  return value === 'credit' ? 'Credit' : value === 'debit' ? 'Debit' : '—';
}

/**
 * Kit list filters → transaction action filters (`partyId` carries the
 * payment-account scope on this surface).
 */
export function toBankTxFilters(
  f: DocListFilters,
): SabcrmBankTransactionListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmBankTransactionStatus | '') || '',
    accountId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const BANK_TX_PATH = '/sabcrm/finance/bank-transactions';

export const JOURNAL_ENTRIES_PATH = '/sabcrm/finance/journal-entries';
