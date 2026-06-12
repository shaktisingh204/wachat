/**
 * SabCRM Finance — petty-cash surface config (client-safe).
 *
 * Status defs + tones (mirrors `crm-petty-cash`' lowercase vocabulary),
 * the float lifecycle for the StatusFlow rail, and the kit-filters
 * mapping (spec §3.15).
 */

import type { CrmPettyCashStatus } from '@/lib/rust-client/crm-petty-cash';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmPettyCashListFilters } from '@/app/actions/sabcrm-finance-petty-cash.actions.types';

export const PETTY_CASH_STATUSES: (DocStatusDef & {
  value: CrmPettyCashStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail. */
export const PETTY_CASH_FLOW: CrmPettyCashStatus[] = ['active', 'closed'];

/** Kit list filters → petty-cash action filters. */
export function toPettyCashFilters(
  f: DocListFilters,
): SabcrmPettyCashListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmPettyCashStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const PETTY_CASH_PATH = '/sabcrm/finance/petty-cash';

export function pettyCashDetailHref(id: string): string {
  return `${PETTY_CASH_PATH}/${encodeURIComponent(id)}`;
}
