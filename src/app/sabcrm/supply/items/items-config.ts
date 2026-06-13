/**
 * SabCRM Supply — items surface config (client-safe, rollout WI-2).
 *
 * Items are MASTER DATA with no status field (spec WI-2): the
 * doc-surface `statuses` vocabulary is empty, so the toolbar status
 * select degrades to "All statuses" only and `itemType` rides the
 * kit's party-filter slot. This module carries the list columns + the
 * generic-filters → item-filters mapping; the bespoke full-field drawer
 * lives in `items-client.tsx`.
 */

import type {
  DocListColumn,
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type {
  SabcrmSupplyItemListFilters,
  SabcrmSupplyItemListRow,
  SabcrmSupplyItemType,
} from '@/app/actions/sabcrm-supply-items.actions.types';

export const ITEMS_PATH = '/sabcrm/supply/items';

/** Master data — no status workflow (spec WI-2). */
export const ITEM_STATUSES: DocStatusDef[] = [];

/** Item-type filter options surfaced through the party-filter slot. */
export const ITEM_TYPE_FILTER_OPTIONS: {
  id: SabcrmSupplyItemType;
  label: string;
  meta: string;
}[] = [
  { id: 'goods', label: 'Goods', meta: 'Stock-tracked products' },
  { id: 'service', label: 'Service', meta: 'Non-inventory services' },
];

/** Humanised item-type label. */
export function itemTypeLabel(type: SabcrmSupplyItemType): string {
  return type === 'service' ? 'Service' : 'Goods';
}

/**
 * Kit list filters → item action filters. The kit's generic shape uses
 * `partyId` (the item-type here, since items have no party) and a
 * stringly `status` (unused). Both the list fetcher and the CSV
 * exporter MUST go through this mapping.
 */
export function toItemFilters(f: DocListFilters): SabcrmSupplyItemListFilters {
  const itemType =
    f.partyId === 'goods' || f.partyId === 'service'
      ? (f.partyId as SabcrmSupplyItemType)
      : '';
  return {
    page: f.page,
    q: f.q || undefined,
    itemType,
    from: f.from,
    to: f.to,
  };
}

/** List columns (spec WI-2: name · sku · type · cost · sell · tax · stock · updated). */
export const ITEM_COLUMNS: DocListColumn<SabcrmSupplyItemListRow>[] = [
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  { key: 'sku', header: 'SKU', kind: 'text', value: (r) => r.sku },
  {
    key: 'itemType',
    header: 'Type',
    kind: 'badge',
    value: (r) => itemTypeLabel(r.itemType),
    tone: (r) => (r.itemType === 'service' ? 'neutral' : 'info'),
  },
  {
    key: 'costPrice',
    header: 'Cost',
    kind: 'money',
    value: (r) => r.costPrice,
    currency: (r) => r.currency,
  },
  {
    key: 'sellingPrice',
    header: 'Selling',
    kind: 'money',
    value: (r) => r.sellingPrice,
    currency: (r) => r.currency,
  },
  {
    key: 'taxRate',
    header: 'Tax',
    kind: 'text',
    align: 'right',
    value: (r) => (r.taxRate === null ? '—' : `${r.taxRate}%`),
    csv: (r) => (r.taxRate === null ? '' : String(r.taxRate)),
  },
  {
    key: 'totalStock',
    header: 'In stock',
    kind: 'text',
    align: 'right',
    value: (r) => (r.isTrackInventory ? r.totalStock : '—'),
    csv: (r) => (r.isTrackInventory ? String(r.totalStock) : ''),
  },
  { key: 'updatedAt', header: 'Updated', kind: 'date', value: (r) => r.updatedAt },
];
