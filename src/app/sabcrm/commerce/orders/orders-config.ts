/**
 * SabCRM Commerce — order surface config (client-safe).
 *
 * Payment-status vocabulary (the kit `status` column + StatusFlow rail)
 * plus the fulfilment vocabulary rendered as a `badge` column, the kit
 * filter mapping and route helpers. Mirrors `crm_store`
 * `OrderPaymentStatus` / `OrderFulfillmentStatus`.
 */

import type {
  CrmStoreOrderFulfillmentStatus,
  CrmStoreOrderPaymentStatus,
} from '@/lib/rust-client/crm-store';
import type { BadgeTone } from '@/components/sabcrm/20ui';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmStoreOrderListFilters } from '@/app/actions/sabcrm-commerce-orders.actions.types';

/** Payment status — the kit `status` column + flow. */
export const ORDER_PAYMENT_STATUSES: (DocStatusDef & {
  value: CrmStoreOrderPaymentStatus;
})[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'paid', label: 'Paid', tone: 'success' },
  { value: 'failed', label: 'Failed', tone: 'danger' },
  { value: 'refunded', label: 'Refunded', tone: 'neutral' },
];

export const ORDER_PAYMENT_FLOW: CrmStoreOrderPaymentStatus[] = [
  'pending',
  'paid',
];

/** Fulfilment status — rendered as a `badge` column (not the flow). */
export const ORDER_FULFILLMENT_LABEL: Record<
  CrmStoreOrderFulfillmentStatus,
  string
> = {
  unfulfilled: 'Unfulfilled',
  partial: 'Partial',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export const ORDER_FULFILLMENT_TONE: Record<
  CrmStoreOrderFulfillmentStatus,
  BadgeTone
> = {
  unfulfilled: 'warning',
  partial: 'info',
  fulfilled: 'success',
  cancelled: 'danger',
};

export function toOrderFilters(f: DocListFilters): SabcrmStoreOrderListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmStoreOrderPaymentStatus | '') || '',
    storefrontId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const ORDERS_PATH = '/sabcrm/commerce/orders';

export function orderDetailHref(id: string): string {
  return `${ORDERS_PATH}/${encodeURIComponent(id)}`;
}
