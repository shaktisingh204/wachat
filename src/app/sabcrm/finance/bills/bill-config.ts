/**
 * SabCRM Finance — bill surface config (client-safe).
 *
 * The bill entity's doc-surface vocabulary: status defs + tones, the
 * happy-path flow for the StatusFlow rail and route helpers. Mirrors
 * `crm_purchases_types::BillStatus` exactly (finance-rollout spec §3.6).
 */

import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmBillListFilters } from '@/app/actions/sabcrm-finance-bills.actions.types';

export const BILL_STATUSES: (DocStatusDef & { value: CrmBillStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'submitted', label: 'Submitted', tone: 'info' },
  { value: 'approved', label: 'Approved', tone: 'info' },
  { value: 'partially_paid', label: 'Partially paid', tone: 'warning' },
  { value: 'paid', label: 'Paid', tone: 'success' },
  { value: 'overdue', label: 'Overdue', tone: 'danger' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const BILL_FLOW: CrmBillStatus[] = [
  'draft',
  'submitted',
  'approved',
  'paid',
];

/**
 * Kit list filters → bill action filters. The kit's `partyId` is the
 * VENDOR filter here (the toolbar picker searches supply vendors).
 */
export function toBillFilters(f: DocListFilters): SabcrmBillListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmBillStatus | '') || '',
    vendorId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const BILLS_PATH = '/sabcrm/finance/bills';

export function billDetailHref(id: string): string {
  return `${BILLS_PATH}/${encodeURIComponent(id)}`;
}
