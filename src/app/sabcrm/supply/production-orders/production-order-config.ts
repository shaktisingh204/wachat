/**
 * SabCRM Supply — Production-order surface config (client-safe, WI-11).
 *
 * Status defs + tones, the happy-path flow for the StatusFlow rail, kit
 * filter mapping and route helpers. The status union + transitions are
 * authoritative in `sabcrm-supply-docs.actions.types.ts` (free-form
 * crate — the UI vocab is the only guard).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmProductionOrderStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_PRODUCTION_ORDER_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmProductionOrderListFilters } from '@/app/actions/sabcrm-supply-production-orders.actions.types';

export const PRODUCTION_ORDER_STATUSES: (DocStatusDef & {
  value: SabcrmProductionOrderStatus;
})[] = [
  { value: 'planned', label: 'Planned', tone: 'neutral' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

export const PRODUCTION_ORDER_FLOW: readonly SabcrmProductionOrderStatus[] =
  SABCRM_PRODUCTION_ORDER_FLOW;

export function productionOrderStatusLabel(value: string | undefined): string {
  if (!value) return 'Planned';
  // The crate's snake_case "complete" maps onto the UI "completed".
  if (value === 'complete') return 'Completed';
  return (
    PRODUCTION_ORDER_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

export function toProductionOrderFilters(
  f: DocListFilters,
): SabcrmProductionOrderListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmProductionOrderStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const PRODUCTION_ORDERS_PATH = '/sabcrm/supply/production-orders';

export function productionOrderDetailHref(id: string): string {
  return `${PRODUCTION_ORDERS_PATH}/${encodeURIComponent(id)}`;
}
