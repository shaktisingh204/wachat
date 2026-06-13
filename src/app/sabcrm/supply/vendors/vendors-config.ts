/**
 * SabCRM Supply — vendors surface config (client-safe, rollout WI-7).
 *
 * Vendors are MASTER DATA: the `crm-vendors` crate has no status
 * column, so `statuses: []` (the toolbar status select degrades to
 * "All vendors") and there is no `[id]` detail page — a row click opens
 * the edit drawer via a shareable `?edit=<id>` deep link (mirrors the
 * finance payment-accounts pattern).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmVendorListFilters } from '@/app/actions/sabcrm-supply-vendors.actions.types';

export const VENDORS_PATH = '/sabcrm/supply/vendors';

/** Master data — no workflow vocabulary. */
export const VENDOR_STATUSES: DocStatusDef[] = [];

/** Vendor-type options (free text on the crate; seeded common buckets). */
export const VENDOR_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'service', label: 'Service provider' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'transporter', label: 'Transporter' },
];

/** GST tax-treatment options (mirrors the finance party vocabulary). */
export const VENDOR_TAX_TREATMENTS: { value: string; label: string }[] = [
  { value: 'registered', label: 'Registered business — regular' },
  { value: 'composition', label: 'Registered business — composition' },
  { value: 'unregistered', label: 'Unregistered business' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'overseas', label: 'Overseas' },
  { value: 'sez', label: 'SEZ' },
];

/** Kit list filters → vendor action filters. */
export function toVendorFilters(f: DocListFilters): SabcrmVendorListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    from: f.from,
    to: f.to,
  };
}

/** Shareable edit deep link (no detail route for master data). */
export function vendorEditHref(id: string): string {
  return `${VENDORS_PATH}?edit=${encodeURIComponent(id)}`;
}
