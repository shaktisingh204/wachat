/**
 * SabCRM Supply — warehouses surface config (client-safe, rollout WI-3).
 *
 * Warehouses are MASTER DATA with a small status vocabulary (free-form
 * crate — the UI vocab is the only guard, spec risk #4). The kit's
 * status select carries `status`; the `type` filter rides the kit's
 * party-filter slot. The bespoke full-field drawer lives in
 * `warehouses-client.tsx`.
 */

import type { BadgeTone } from '@/components/sabcrm/20ui';
import type {
  DocListColumn,
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import {
  SABCRM_WAREHOUSE_TYPES,
} from '@/app/actions/sabcrm-supply-warehouses.actions.types';
import type {
  SabcrmSupplyWarehouseListFilters,
  SabcrmSupplyWarehouseListRow,
} from '@/app/actions/sabcrm-supply-warehouses.actions.types';
import type {
  CrmWarehouseStatus,
  CrmWarehouseType,
} from '@/lib/rust-client/crm-warehouses';

export const WAREHOUSES_PATH = '/sabcrm/supply/warehouses';

/** UI status vocab (spec WI-3). Flow happy-path is just `active`. */
export const WAREHOUSE_STATUSES: (DocStatusDef & {
  value: CrmWarehouseStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'inactive', label: 'Inactive', tone: 'neutral' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const WAREHOUSE_FLOW: readonly CrmWarehouseStatus[] = ['active'];

/** type → badge tone. */
const TYPE_TONES: Record<CrmWarehouseType, BadgeTone> = {
  main: 'info',
  branch: 'accent',
  franchise: 'warning',
  '3pl': 'neutral',
  virtual: 'neutral',
};

const TYPE_LABELS: Record<CrmWarehouseType, string> = Object.fromEntries(
  SABCRM_WAREHOUSE_TYPES.map((t) => [t.value, t.label]),
) as Record<CrmWarehouseType, string>;

export function warehouseTypeLabel(type: CrmWarehouseType | ''): string {
  return type ? (TYPE_LABELS[type] ?? type) : '—';
}

export function warehouseTypeTone(type: CrmWarehouseType | ''): BadgeTone {
  return type ? (TYPE_TONES[type] ?? 'neutral') : 'neutral';
}

/** type filter options surfaced through the kit's party-filter slot. */
export const WAREHOUSE_TYPE_FILTER_OPTIONS: {
  id: CrmWarehouseType;
  label: string;
  meta?: string;
}[] = SABCRM_WAREHOUSE_TYPES.map((t) => ({ id: t.value, label: t.label }));

/**
 * Kit list filters → warehouse action filters. `status` maps straight
 * through; the type filter rides `partyId` (warehouses have no party).
 */
export function toWarehouseFilters(
  f: DocListFilters,
): SabcrmSupplyWarehouseListFilters {
  const type = (
    SABCRM_WAREHOUSE_TYPES.some((t) => t.value === f.partyId)
      ? f.partyId
      : ''
  ) as CrmWarehouseType | '';
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmWarehouseStatus | '') || '',
    type,
    from: f.from,
    to: f.to,
  };
}

/** List columns (spec WI-3). */
export const WAREHOUSE_COLUMNS: DocListColumn<SabcrmSupplyWarehouseListRow>[] = [
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  { key: 'code', header: 'Code', kind: 'text', value: (r) => r.code },
  {
    key: 'type',
    header: 'Type',
    kind: 'badge',
    value: (r) => warehouseTypeLabel(r.type),
    tone: (r) => warehouseTypeTone(r.type),
  },
  { key: 'city', header: 'City', kind: 'text', value: (r) => r.city },
  {
    key: 'managerName',
    header: 'Manager',
    kind: 'party',
    value: (r) => r.managerName,
  },
  {
    key: 'capacityUnits',
    header: 'Capacity',
    kind: 'text',
    align: 'right',
    value: (r) => (r.capacityUnits === null ? '—' : r.capacityUnits),
    csv: (r) => (r.capacityUnits === null ? '' : String(r.capacityUnits)),
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'isDefault',
    header: 'Default',
    kind: 'badge',
    value: (r) => (r.isDefault ? 'Default' : ''),
    tone: () => 'info',
  },
];
