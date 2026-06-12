/**
 * SabCRM Finance — invoice surface config (client-safe).
 *
 * The invoice entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow for the StatusFlow rail, and route helpers.
 * Mirrors `crm_sales_types::InvoiceStatus` exactly.
 */

import type {
  CrmInvoiceGstTreatment,
  CrmInvoiceStatus,
} from '@/lib/rust-client/crm-invoices';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmInvoiceListFilters } from '@/app/actions/sabcrm-finance-invoices.actions.types';

export const INVOICE_STATUSES: (DocStatusDef & { value: CrmInvoiceStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'partially_paid', label: 'Partially paid', tone: 'warning' },
  { value: 'paid', label: 'Paid', tone: 'success' },
  { value: 'overdue', label: 'Overdue', tone: 'danger' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/**
 * GST treatment vocabulary — mirrors `crm_sales_types::GstTreatment`
 * exactly (snake_case wire values). Feeds the DocForm `taxFields`
 * Select and the detail meta row.
 */
export const INVOICE_GST_TREATMENTS: {
  value: CrmInvoiceGstTreatment;
  label: string;
}[] = [
  { value: 'registered', label: 'Registered business' },
  { value: 'composition', label: 'Composition scheme' },
  { value: 'unregistered', label: 'Unregistered business' },
  { value: 'overseas', label: 'Overseas (export)' },
  { value: 'sez_with_payment', label: 'SEZ — with IGST payment' },
  { value: 'sez_without_payment', label: 'SEZ — without IGST payment' },
  { value: 'deemed_export', label: 'Deemed export' },
  { value: 'consumer', label: 'Consumer (B2C)' },
];

/** Display label for a stored treatment value. */
export function gstTreatmentLabel(
  value: CrmInvoiceGstTreatment | undefined,
): string | null {
  if (!value) return null;
  return (
    INVOICE_GST_TREATMENTS.find((t) => t.value === value)?.label ?? value
  );
}

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const INVOICE_FLOW: CrmInvoiceStatus[] = ['draft', 'sent', 'paid'];

/**
 * Kit list filters → invoice action filters. The kit's generic shape
 * uses `partyId` + a stringly `status`; the invoice actions expect
 * `clientId` + the `CrmInvoiceStatus` union. Both the list fetcher and
 * the CSV exporter MUST go through this mapping (the toolbar's status
 * values come from `INVOICE_STATUSES`, so the narrowing cast is safe).
 */
export function toInvoiceFilters(f: DocListFilters): SabcrmInvoiceListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmInvoiceStatus | '') || '',
    clientId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const INVOICES_PATH = '/sabcrm/finance/invoices';

export function invoiceDetailHref(id: string): string {
  return `${INVOICES_PATH}/${encodeURIComponent(id)}`;
}

export function partyRecordHref(
  objectSlug: string | null,
  id: string,
): string | null {
  if (!objectSlug || !id) return null;
  return `/sabcrm/${encodeURIComponent(objectSlug)}/${encodeURIComponent(id)}`;
}
