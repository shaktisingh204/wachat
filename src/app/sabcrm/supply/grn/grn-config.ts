/**
 * SabCRM Supply — GRN surface config (client-safe, rollout WI-6).
 *
 * The GRN entity's doc-surface vocabulary: status defs + tones, the
 * happy-path flow for the StatusFlow rail, kit-filter mapping and route
 * helpers. The status union + transitions are authoritative in
 * `sabcrm-supply-docs.actions.types.ts` (the crate validates the same
 * `ALLOWED_STATUSES` server-side).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmGrnStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_GRN_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmGrnListFilters } from '@/app/actions/sabcrm-supply-grn.actions.types';

export const GRN_STATUSES: (DocStatusDef & { value: SabcrmGrnStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'received', label: 'Received', tone: 'info' },
  { value: 'partial', label: 'Partially received', tone: 'warning' },
  { value: 'inspected', label: 'Inspected', tone: 'info' },
  { value: 'qc_failed', label: 'QC failed', tone: 'danger' },
  { value: 'posted', label: 'Posted', tone: 'success' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const GRN_FLOW: readonly SabcrmGrnStatus[] = SABCRM_GRN_FLOW;

export function grnStatusLabel(value: string | undefined): string {
  if (!value) return 'Draft';
  return (
    GRN_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

/** Kit list filters → GRN action filters (party = vendor). */
export function toGrnFilters(f: DocListFilters): SabcrmGrnListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmGrnStatus | '') || '',
    vendorId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const GRN_PATH = '/sabcrm/supply/grn';

export function grnDetailHref(id: string): string {
  return `${GRN_PATH}/${encodeURIComponent(id)}`;
}
