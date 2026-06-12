/**
 * SabCRM Finance — reconciliation surface config (client-safe).
 *
 * The reconciliation-run entity's doc-surface vocabulary: status defs
 * + tones, the happy-path flow, and the kit-filters → action-filters
 * mapper. Mirrors `crm-reconciliation::CrmReconciliationStatus`
 * exactly (spec §3.17).
 */

import type { CrmReconciliationStatus } from '@/lib/rust-client/crm-reconciliation';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmReconciliationListFilters } from '@/app/actions/sabcrm-finance-reconciliation.actions.types';

export const RECONCILIATION_STATUSES: (DocStatusDef & {
  value: CrmReconciliationStatus;
})[] = [
  { value: 'in_progress', label: 'In progress', tone: 'warning' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail. */
export const RECONCILIATION_FLOW: CrmReconciliationStatus[] = [
  'in_progress',
  'completed',
];

/**
 * Kit list filters → reconciliation action filters. The kit's party
 * slot is repurposed as the PAYMENT ACCOUNT filter.
 */
export function toReconciliationFilters(
  f: DocListFilters,
): SabcrmReconciliationListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmReconciliationStatus | '') || '',
    accountId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const RECONCILIATION_PATH = '/sabcrm/finance/reconciliation';
