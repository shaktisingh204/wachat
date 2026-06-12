/**
 * SabCRM Finance — quotation surface config (client-safe).
 *
 * The quotation entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow for the StatusFlow rail, and route helpers.
 * Mirrors `crm_sales_types::QuotationStatus` exactly (lowercase wire
 * literals — finance-rollout spec §3.1).
 */

import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmQuotationListFilters } from '@/app/actions/sabcrm-finance-quotations.actions.types';

export const QUOTATION_STATUSES: (DocStatusDef & {
  value: CrmQuotationStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'accepted', label: 'Accepted', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
  { value: 'expired', label: 'Expired', tone: 'warning' },
  { value: 'converted', label: 'Converted', tone: 'success' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const QUOTATION_FLOW: CrmQuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'converted',
];

/**
 * Kit list filters → quotation action filters. Both the list fetcher
 * and the CSV exporter MUST go through this mapping (the toolbar's
 * status values come from `QUOTATION_STATUSES`, so the narrowing cast
 * is safe).
 */
export function toQuotationFilters(
  f: DocListFilters,
): SabcrmQuotationListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmQuotationStatus | '') || '',
    clientId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const QUOTATIONS_PATH = '/sabcrm/finance/quotations';

export function quotationDetailHref(id: string): string {
  return `${QUOTATIONS_PATH}/${encodeURIComponent(id)}`;
}

export function partyRecordHref(
  objectSlug: string | null,
  id: string,
): string | null {
  if (!objectSlug || !id) return null;
  return `/sabcrm/${encodeURIComponent(objectSlug)}/${encodeURIComponent(id)}`;
}
