/**
 * SabCRM Supply — purchase-order surface config (client-safe).
 *
 * The PO entity's doc-surface vocabulary: status defs + tones, the
 * happy-path flow for the StatusFlow rail, and route helpers. The
 * status union + transitions are authoritative in
 * `sabcrm-supply-docs.actions.types.ts` (the crate validates the same
 * `ALLOWED_STATUSES` server-side — supply-commerce rollout WI-5).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type {
  SabcrmPoStatus,
} from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_PO_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmPoListFilters } from '@/app/actions/sabcrm-supply-purchase-orders.actions.types';

export const PO_STATUSES: (DocStatusDef & { value: SabcrmPoStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'awaiting_approval', label: 'Awaiting approval', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'info' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'partial', label: 'Partially received', tone: 'warning' },
  { value: 'received', label: 'Received', tone: 'success' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const PO_FLOW: readonly SabcrmPoStatus[] = SABCRM_PO_FLOW;

/** Label for a stored PO status value (humanised fallback). */
export function poStatusLabel(value: string | undefined): string {
  if (!value) return 'Draft';
  return (
    PO_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

/**
 * Kit list filters → PO action filters. The kit's generic shape uses
 * `partyId` (the vendor here) + a stringly `status`; the PO actions
 * expect `vendorId` + the `SabcrmPoStatus` union. Both the list fetcher
 * and the CSV exporter MUST go through this mapping (the toolbar's
 * status values come from `PO_STATUSES`, so the narrowing cast is safe).
 */
export function toPoFilters(f: DocListFilters): SabcrmPoListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmPoStatus | '') || '',
    vendorId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const PURCHASE_ORDERS_PATH = '/sabcrm/supply/purchase-orders';

export function purchaseOrderDetailHref(id: string): string {
  return `${PURCHASE_ORDERS_PATH}/${encodeURIComponent(id)}`;
}
