/**
 * SabCRM Finance — payout surface config (client-safe).
 *
 * The payout entity's doc-surface vocabulary: status defs + tones, the
 * happy-path flow for the StatusFlow rail, mode labels and route
 * helpers. Mirrors `crm_purchases_types::PayoutStatus` exactly
 * (spec §3.8 — the vendor-side mirror of payment receipts).
 */

import type {
  CrmPayoutMode,
  CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import {
  SABCRM_PAYOUT_MODES,
  type SabcrmPayoutListFilters,
} from '@/app/actions/sabcrm-finance-payouts.actions.types';

export const PAYOUT_STATUSES: (DocStatusDef & { value: CrmPayoutStatus })[] = [
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'cleared', label: 'Cleared', tone: 'success' },
  { value: 'failed', label: 'Failed', tone: 'danger' },
];

/** Happy path for the StatusFlow rail (failed renders as a pill). */
export const PAYOUT_FLOW: CrmPayoutStatus[] = ['sent', 'cleared'];

/** Display label for a payment rail value. */
export function payoutModeLabel(mode: CrmPayoutMode | undefined): string {
  if (!mode) return '—';
  return SABCRM_PAYOUT_MODES.find((m) => m.value === mode)?.label ?? mode;
}

/**
 * Kit list filters → payout action filters. The kit's `partyId` slot is
 * repurposed as the VENDOR filter (the toolbar picker searches supply
 * vendors). Both the list fetcher and the CSV exporter MUST go through
 * this mapping.
 */
export function toPayoutFilters(f: DocListFilters): SabcrmPayoutListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmPayoutStatus | '') || '',
    vendorId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const PAYOUTS_PATH = '/sabcrm/finance/payouts';

export function payoutDetailHref(id: string): string {
  return `${PAYOUTS_PATH}/${encodeURIComponent(id)}`;
}
