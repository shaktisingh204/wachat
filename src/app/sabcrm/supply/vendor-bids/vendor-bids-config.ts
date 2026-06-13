/**
 * SabCRM Supply — vendor-bid surface config (client-safe, rollout
 * WI-9).
 *
 * The bid doc-surface vocabulary: status defs + tones, the happy-path
 * flow for the StatusFlow rail, kit-filter mapping and route helpers.
 * The status union + transitions are authoritative in
 * `sabcrm-supply-docs.actions.types.ts` (the `crm-vendor-bids` crate
 * validates the same `ALLOWED_STATUSES` server-side — rollout WI-9).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmVendorBidStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_VENDOR_BID_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmBidListFilters } from '@/app/actions/sabcrm-supply-vendor-bids.actions.types';

export const BID_STATUSES: (DocStatusDef & { value: SabcrmVendorBidStatus })[] =
  [
    { value: 'submitted', label: 'Submitted', tone: 'info' },
    { value: 'shortlisted', label: 'Shortlisted', tone: 'warning' },
    { value: 'awarded', label: 'Awarded', tone: 'success' },
    { value: 'rejected', label: 'Rejected', tone: 'danger' },
    { value: 'withdrawn', label: 'Withdrawn', tone: 'neutral' },
  ];

/**
 * Happy path for the StatusFlow rail (exceptions render as a pill). A
 * mutable copy of the shared readonly const so it satisfies both the
 * kit's `StatusFlow` (readonly) and `DocDetailPage.flow` (`string[]`).
 */
export const BID_FLOW: SabcrmVendorBidStatus[] = [...SABCRM_VENDOR_BID_FLOW];

/** Label for a stored bid status value (humanised fallback). */
export function bidStatusLabel(value: string | undefined): string {
  if (!value) return 'Submitted';
  return (
    BID_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

/**
 * Kit list filters → bid action filters. The kit's `partyId` is the
 * vendor here (the bid list's `partyFilter` searches vendors).
 */
export function toBidFilters(f: DocListFilters): SabcrmBidListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmVendorBidStatus | '') || '',
    vendorId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const VENDOR_BIDS_PATH = '/sabcrm/supply/vendor-bids';

export function vendorBidDetailHref(id: string): string {
  return `${VENDOR_BIDS_PATH}/${encodeURIComponent(id)}`;
}
