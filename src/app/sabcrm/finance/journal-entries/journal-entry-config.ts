/**
 * SabCRM Finance — journal-entries surface config (client-safe).
 *
 * The voucher-entry entity's doc-surface vocabulary: status defs +
 * tones, the happy-path flow for the StatusFlow rail, and the
 * kit-filters → action-filters mapper. Mirrors
 * `crm-voucher-entries::CrmVoucherEntryStatus` exactly (spec §3.14).
 */

import type { CrmVoucherEntryStatus } from '@/lib/rust-client/crm-voucher-entries';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmJournalEntryListFilters } from '@/app/actions/sabcrm-finance-journal-entries.actions.types';

export const JOURNAL_ENTRY_STATUSES: (DocStatusDef & {
  value: CrmVoucherEntryStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'posted', label: 'Posted', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (archived renders as a pill). */
export const JOURNAL_ENTRY_FLOW: CrmVoucherEntryStatus[] = ['draft', 'posted'];

/**
 * Kit list filters → journal-entry action filters. The kit's party
 * slot is repurposed as the VOUCHER BOOK filter (spec §3.13 deep-links
 * `?book=<id>` from the books surface into this list).
 */
export function toJournalEntryFilters(
  f: DocListFilters,
): SabcrmJournalEntryListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmVoucherEntryStatus | '') || '',
    voucherBookId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const JOURNAL_ENTRIES_PATH = '/sabcrm/finance/journal-entries';
