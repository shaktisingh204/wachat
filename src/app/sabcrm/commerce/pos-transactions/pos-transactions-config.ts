/**
 * SabCRM Commerce — POS transaction surface config (client-safe).
 *
 * Status vocabulary + tones + happy-path flow, kit filter mapping, and
 * route helpers (spec WI-19). The crate validates
 * `completed|voided|refunded`; `partially_refunded` is the UI vocab
 * surface for partial-line refunds.
 */

import type { BadgeTone } from '@/components/sabcrm/20ui';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmPosTransactionListFilters } from '@/app/actions/sabcrm-commerce-pos-transactions.actions.types';

export const POS_TXN_STATUSES: DocStatusDef[] = [
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'voided', label: 'Voided', tone: 'danger' },
  { value: 'refunded', label: 'Refunded', tone: 'neutral' },
  { value: 'partially_refunded', label: 'Partially refunded', tone: 'warning' },
];

export const POS_TXN_FLOW: string[] = ['completed'];

export const POS_TXN_METHOD_TONE: Record<string, BadgeTone> = {
  cash: 'success',
  card: 'info',
  upi: 'info',
  wallet: 'neutral',
  split: 'warning',
};

export function toPosTransactionFilters(
  f: DocListFilters,
): SabcrmPosTransactionListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: f.status || '',
    sessionId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const POS_TRANSACTIONS_PATH = '/sabcrm/commerce/pos-transactions';

export function posTransactionDetailHref(id: string): string {
  return `${POS_TRANSACTIONS_PATH}/${encodeURIComponent(id)}`;
}
