/**
 * SabCRM Commerce — shipping-zone surface config (client-safe).
 *
 * Status vocabulary + tones (spec WI-17), kit filter mapping, and
 * route helpers. The crate type is `active|paused|archived`; this
 * surface writes `active|archived`.
 */

import type { CrmStoreShippingZoneStatus } from '@/lib/rust-client/crm-store';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmShippingZoneListFilters } from '@/app/actions/sabcrm-commerce-shipping.actions.types';

export const SHIPPING_STATUSES: (DocStatusDef & {
  value: CrmStoreShippingZoneStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'paused', label: 'Paused', tone: 'warning' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const SHIPPING_FLOW: CrmStoreShippingZoneStatus[] = ['active'];

/** Shipping-method kinds (wire values) for the methods grid. */
export const SHIPPING_METHOD_KINDS: {
  value: 'flat' | 'weight_based' | 'free_above';
  label: string;
}[] = [
  { value: 'flat', label: 'Flat rate' },
  { value: 'weight_based', label: 'Weight based (per kg)' },
  { value: 'free_above', label: 'Free above subtotal' },
];

export function toShippingFilters(
  f: DocListFilters,
): SabcrmShippingZoneListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmStoreShippingZoneStatus | '') || '',
    storefrontId: f.partyId || undefined,
  };
}

export const SHIPPING_PATH = '/sabcrm/commerce/shipping';
