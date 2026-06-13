/**
 * SabCRM Commerce — Shipping zones surface action types (spec WI-17).
 *
 * Master data: each zone carries the FULL methods grid (name + kind +
 * rate + freeAboveSubtotal) and country/state scope, so the edit
 * drawer seeds without a second fetch. Storefront labels are resolved
 * to names in the list (never an ObjectId).
 */

import type {
  CrmStoreShippingMethod,
  CrmStoreShippingZoneStatus,
} from '@/lib/rust-client/crm-store';

export interface SabcrmShippingZoneListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status: CrmStoreShippingZoneStatus | '';
  /** Toolbar party filter — storefront. */
  storefrontId?: string;
}

/** Display-ready row + full editable fields. */
export interface SabcrmShippingZoneListRow {
  id: string;
  storefrontId: string;
  /** Resolved storefront name (null renders "Unknown"). */
  storefrontLabel: string | null;
  name: string;
  countries: string[];
  states: string[];
  methods: CrmStoreShippingMethod[];
  methodsCount: number;
  /** Cheapest method rate (0 when no methods). */
  cheapestRate: number;
  status: CrmStoreShippingZoneStatus;
}

export interface SabcrmShippingZoneListPage {
  rows: SabcrmShippingZoneListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmShippingZoneKpis {
  count: number;
  activeCount: number;
  methodsTotal: number;
  countriesCovered: number;
  sampled: boolean;
}

/** FULL create payload (the methods grid supersedes the single-method dialog). */
export interface SabcrmShippingZoneFullInput {
  storefrontId: string;
  name: string;
  countries: string[];
  states?: string[];
  methods: CrmStoreShippingMethod[];
}
