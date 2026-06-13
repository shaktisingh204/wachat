/**
 * SabCRM Commerce — Coupons surface action types (spec WI-15).
 *
 * Master data with ALL rule fields: minCart, maxUses,
 * perCustomerLimit, validity window, applicable products (resolved to
 * labels for the edit seed — never raw ids in the UI), stackable.
 *
 * Status note: the wire is free-form (`crm-coupons` stores
 * `Option<String>`), but the TS client narrows to
 * `draft|active|expired|archived` — that crate vocabulary is what this
 * surface writes (the spec's `inactive` is unreachable through the
 * typed client, so the UI vocab follows the crate).
 */

import type {
  CrmCouponStatus,
  CrmCouponType,
} from '@/lib/rust-client/crm-coupons';

export interface SabcrmCouponListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status: CrmCouponStatus | '';
}

/** Display-ready row + full editable fields. */
export interface SabcrmCouponListRow {
  id: string;
  code: string;
  type: CrmCouponType | string;
  value: number;
  minCart: number | null;
  maxUses: number | null;
  perCustomerLimit: number | null;
  validFrom: string | null;
  validTo: string | null;
  applicableProducts: string[];
  /** Resolved product labels, index-aligned with `applicableProducts`
   *  (unresolvable ids fall back to "Unknown item"). */
  applicableProductLabels: string[];
  stackable: boolean;
  status: CrmCouponStatus;
  usedCount: number;
  notes: string | null;
}

export interface SabcrmCouponListPage {
  rows: SabcrmCouponListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmCouponKpis {
  count: number;
  activeCount: number;
  totalRedemptions: number;
  expiringSoonCount: number;
  sampled: boolean;
}

/** FULL create payload (every `CreateCouponInput` rule field). */
export interface SabcrmCouponFullInput {
  code: string;
  type: CrmCouponType;
  value: number;
  minCart?: number;
  maxUses?: number;
  perCustomerLimit?: number;
  /** `YYYY-MM-DD`. */
  validFrom?: string;
  /** `YYYY-MM-DD`. */
  validTo?: string;
  /** Picked item ids (real picker — no placeholder ids). */
  applicableProducts?: string[];
  stackable?: boolean;
  notes?: string;
}
