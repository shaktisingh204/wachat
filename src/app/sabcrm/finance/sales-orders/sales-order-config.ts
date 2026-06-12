/**
 * SabCRM Finance — sales-order surface config (client-safe).
 *
 * The sales-order entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow for the StatusFlow rail, and route helpers.
 * Mirrors `crm_sales_types::SalesOrderStatus` exactly (lowercase wire
 * literals — finance-rollout spec §3.2).
 */

import type { CrmSalesOrderStatus } from '@/lib/rust-client/crm-sales-orders';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmSalesOrderListFilters } from '@/app/actions/sabcrm-finance-sales-orders.actions.types';

export const SALES_ORDER_STATUSES: (DocStatusDef & {
  value: CrmSalesOrderStatus;
})[] = [
  { value: 'open', label: 'Open', tone: 'info' },
  { value: 'partial', label: 'Partially fulfilled', tone: 'warning' },
  { value: 'fulfilled', label: 'Fulfilled', tone: 'success' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const SALES_ORDER_FLOW: CrmSalesOrderStatus[] = [
  'open',
  'partial',
  'fulfilled',
];

/**
 * Kit list filters → sales-order action filters. Both the list fetcher
 * and the CSV exporter MUST go through this mapping.
 */
export function toSalesOrderFilters(
  f: DocListFilters,
): SabcrmSalesOrderListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmSalesOrderStatus | '') || '',
    clientId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const SALES_ORDERS_PATH = '/sabcrm/finance/sales-orders';

export function salesOrderDetailHref(id: string): string {
  return `${SALES_ORDERS_PATH}/${encodeURIComponent(id)}`;
}

export function partyRecordHref(
  objectSlug: string | null,
  id: string,
): string | null {
  if (!objectSlug || !id) return null;
  return `/sabcrm/${encodeURIComponent(objectSlug)}/${encodeURIComponent(id)}`;
}
