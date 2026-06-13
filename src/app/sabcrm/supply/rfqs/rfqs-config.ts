/**
 * SabCRM Supply — RFQ surface config (client-safe, rollout WI-8).
 *
 * The RFQ doc-surface vocabulary: status defs + tones, the happy-path
 * flow for the StatusFlow rail, kit-filter mapping and route helpers.
 * The status union + transitions are authoritative in
 * `sabcrm-supply-docs.actions.types.ts` (the `crm-rfqs` crate validates
 * the same `ALLOWED_RFQ_STATUSES` server-side — rollout WI-8).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmRfqStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_RFQ_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmRfqListFilters } from '@/app/actions/sabcrm-supply-rfqs.actions.types';

export const RFQ_STATUSES: (DocStatusDef & { value: SabcrmRfqStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'open', label: 'Open', tone: 'info' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
  { value: 'awarded', label: 'Awarded', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/**
 * Happy path for the StatusFlow rail (exceptions render as a pill). A
 * mutable copy of the shared readonly const so it satisfies both the
 * kit's `StatusFlow` (readonly) and `DocDetailPage.flow` (`string[]`).
 */
export const RFQ_FLOW: SabcrmRfqStatus[] = [...SABCRM_RFQ_FLOW];

/** Label for a stored RFQ status value (humanised fallback). */
export function rfqStatusLabel(value: string | undefined): string {
  if (!value) return 'Draft';
  return (
    RFQ_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

/** Kit list filters → RFQ action filters. */
export function toRfqFilters(f: DocListFilters): SabcrmRfqListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmRfqStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const RFQS_PATH = '/sabcrm/supply/rfqs';

export function rfqDetailHref(id: string): string {
  return `${RFQS_PATH}/${encodeURIComponent(id)}`;
}
