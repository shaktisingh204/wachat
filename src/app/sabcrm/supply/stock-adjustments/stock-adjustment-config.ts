/**
 * SabCRM Supply — stock-adjustment surface config (client-safe, WI-4).
 *
 * The adjustment's doc-surface vocabulary: status defs + tones, the
 * StatusFlow happy path and the generic-filters → action-filters
 * mapping. The status union + transitions are authoritative in
 * `sabcrm-supply-docs.actions.types.ts` (free-form crate — the UI vocab
 * is the only guard, spec risk #4).
 *
 * The adjustment has no party in the finance sense; the kit's party
 * slot is repurposed as the WAREHOUSE (required on every adjustment),
 * so the list's `partyFilter` filters by warehouse and the detail
 * page's party heading reads "Warehouse".
 */

import type {
  DocListColumn,
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type { SabcrmStockAdjustmentStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_STOCK_ADJUSTMENT_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type {
  SabcrmSupplyStockAdjustmentListFilters,
  SabcrmSupplyStockAdjustmentListRow,
} from '@/app/actions/sabcrm-supply-stock-adjustments.actions.types';

export const ADJUSTMENTS_PATH = '/sabcrm/supply/stock-adjustments';

export function adjustmentDetailHref(id: string): string {
  return `${ADJUSTMENTS_PATH}/${encodeURIComponent(id)}`;
}

/** UI status vocab (spec WI-4). */
export const ADJUSTMENT_STATUSES: (DocStatusDef & {
  value: SabcrmStockAdjustmentStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'approved', label: 'Approved', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const ADJUSTMENT_FLOW: readonly SabcrmStockAdjustmentStatus[] =
  SABCRM_STOCK_ADJUSTMENT_FLOW;

export function adjustmentStatusLabel(value: string | undefined): string {
  if (!value) return 'Draft';
  return (
    ADJUSTMENT_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

/**
 * Kit list filters → adjustment action filters. The kit's `partyId`
 * carries the warehouse here; `status` maps through.
 */
export function toAdjustmentFilters(
  f: DocListFilters,
): SabcrmSupplyStockAdjustmentListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmStockAdjustmentStatus | '') || '',
    warehouseId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

/** Signed quantity display (`+12` / `−4`). */
export function signedQty(qty: number): string {
  if (qty > 0) return `+${qty}`;
  if (qty < 0) return `−${Math.abs(qty)}`;
  return '0';
}

/** List columns (spec WI-4). */
export const ADJUSTMENT_COLUMNS: DocListColumn<SabcrmSupplyStockAdjustmentListRow>[] =
  [
    {
      key: 'adjustmentNumber',
      header: 'Number',
      kind: 'text',
      value: (r) => r.adjustmentNumber || r.id.slice(-6),
    },
    { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
    { key: 'reason', header: 'Reason', kind: 'text', value: (r) => r.reason },
    {
      key: 'warehouse',
      header: 'Warehouse',
      kind: 'party',
      value: (r) => r.warehouseLabel,
    },
    {
      key: 'product',
      header: 'Product',
      kind: 'party',
      value: (r) => r.productLabel,
    },
    {
      key: 'quantity',
      header: 'Qty',
      kind: 'text',
      align: 'right',
      value: (r) => signedQty(r.quantity),
      csv: (r) => String(r.quantity),
    },
    { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
    {
      key: 'approvedByName',
      header: 'Approved by',
      kind: 'text',
      value: (r) => r.approvedByName ?? '',
    },
  ];
