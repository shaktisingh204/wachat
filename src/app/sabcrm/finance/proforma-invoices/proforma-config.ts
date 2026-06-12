/**
 * SabCRM Finance — proforma-invoice surface config (client-safe).
 *
 * ⚠️ The mounted shape is the LEGACY `crm-proforma-invoices` crate:
 * the status vocabulary is **TitleCase** (`Draft, Issued, Converted,
 * Cancelled`) plus the crm-common `archived` soft-delete state —
 * finance-rollout spec §3.3.
 */

import type { CrmProformaStatus } from '@/lib/rust-client/crm-proforma-invoices';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmProformaListFilters } from '@/app/actions/sabcrm-finance-proforma.actions.types';

export const PROFORMA_STATUSES: (DocStatusDef & {
  value: CrmProformaStatus;
})[] = [
  { value: 'Draft', label: 'Draft', tone: 'neutral' },
  { value: 'Issued', label: 'Issued', tone: 'info' },
  { value: 'Converted', label: 'Converted', tone: 'success' },
  { value: 'Cancelled', label: 'Cancelled', tone: 'neutral' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const PROFORMA_FLOW: CrmProformaStatus[] = [
  'Draft',
  'Issued',
  'Converted',
];

/**
 * Kit list filters → proforma action filters. Both the list fetcher and
 * the CSV exporter MUST go through this mapping (the toolbar's status
 * values come from `PROFORMA_STATUSES`, so the narrowing cast is safe).
 */
export function toProformaFilters(
  f: DocListFilters,
): SabcrmProformaListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmProformaStatus | '') || '',
    accountId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const PROFORMA_PATH = '/sabcrm/finance/proforma-invoices';

export function proformaDetailHref(id: string): string {
  return `${PROFORMA_PATH}/${encodeURIComponent(id)}`;
}

export function partyRecordHref(
  objectSlug: string | null,
  id: string,
): string | null {
  if (!objectSlug || !id) return null;
  return `/sabcrm/${encodeURIComponent(objectSlug)}/${encodeURIComponent(id)}`;
}
