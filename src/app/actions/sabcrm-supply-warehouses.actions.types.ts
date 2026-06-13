/**
 * SabCRM Supply — warehouses surface action types (rollout spec WI-3).
 *
 * Shared between `sabcrm-supply-warehouses.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/supply/warehouses` doc-surface client (DocListPage +
 * full-field edit Drawer, no detail route).
 *
 * `crm-warehouses` is a FREE-FORM crm-common crate: the engine
 * validates neither `status` nor `type` — the vocab constants below are
 * the ONLY guard (spec risk #4); the surface must never write outside
 * them.
 */

import type {
  CrmWarehouseStatus,
  CrmWarehouseType,
} from '@/lib/rust-client/crm-warehouses';

/* ─── Vocabulary (UI-authoritative, spec WI-3) ────────────────── */

export const SABCRM_WAREHOUSE_TYPES: {
  value: CrmWarehouseType;
  label: string;
}[] = [
  { value: 'main', label: 'Main' },
  { value: 'branch', label: 'Branch' },
  { value: 'franchise', label: 'Franchise' },
  { value: '3pl', label: '3PL' },
  { value: 'virtual', label: 'Virtual' },
];

export const SABCRM_WAREHOUSE_STATUS_VALUES: CrmWarehouseStatus[] = [
  'active',
  'inactive',
  'archived',
];

/* ─── Create / update (full drawer payloads) ──────────────────── */

/** Full-field payload — every `CreateWarehouseInput` field. */
export interface SabcrmSupplyWarehouseFullInput {
  name: string;
  code?: string;
  type?: CrmWarehouseType;
  status?: CrmWarehouseStatus;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  /** People record id (records engine) + cached display name. */
  managerId?: string;
  managerName?: string;
  gstin?: string;
  capacityUnits?: number;
  capacitySqft?: number;
  climateControlled?: boolean;
  isDefault?: boolean;
}

export type SabcrmSupplyWarehouseFullPatch =
  Partial<SabcrmSupplyWarehouseFullInput>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmSupplyWarehouseListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** '' ⇒ crate default (archived hidden). */
  status?: CrmWarehouseStatus | '';
  /** '' ⇒ all (rides the kit's party-filter slot). */
  type?: CrmWarehouseType | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to `updatedAt`. */
  from?: string;
  to?: string;
}

/**
 * A display-ready list row. Carries the FULL editable field set so the
 * row-click edit drawer seeds without a second fetch.
 */
export interface SabcrmSupplyWarehouseListRow {
  id: string;
  name: string;
  code: string;
  type: CrmWarehouseType | '';
  status: CrmWarehouseStatus;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  managerId: string | null;
  /** Resolved manager display name (null renders "Unknown"). */
  managerName: string | null;
  gstin: string;
  capacityUnits: number | null;
  capacitySqft: number | null;
  climateControlled: boolean;
  isDefault: boolean;
  updatedAt: string;
}

export interface SabcrmSupplyWarehouseListPage {
  rows: SabcrmSupplyWarehouseListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (capped scan). */
export interface SabcrmSupplyWarehouseKpis {
  /** Warehouses scanned (archived excluded). */
  count: number;
  activeCount: number;
  /** Σ capacityUnits where set. */
  totalCapacityUnits: number;
  climateControlledCount: number;
  /** Name of the default warehouse, when one is flagged. */
  defaultWarehouseName: string | null;
  /** True when the scan hit its cap. */
  sampled: boolean;
}
