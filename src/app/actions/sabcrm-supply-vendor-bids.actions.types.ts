/**
 * SabCRM Supply — vendor-bid surface action types (rollout WI-9).
 *
 * Shared between `sabcrm-supply-vendor-bids.actions.ts` ('use server'
 * modules may only export async functions) and the bid clients. Status
 * vocabulary + transitions live in `sabcrm-supply-docs.actions.types.ts`
 * (`SabcrmVendorBidStatus`, `SABCRM_VENDOR_BID_FLOW`,
 * `SABCRM_VENDOR_BID_TRANSITIONS`) — the `crm-vendor-bids` crate
 * validates the same `ALLOWED_STATUSES` server-side.
 */

import type { SabcrmVendorBidStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Create / update (full form payloads) ────────────────────── */

/** One priced bid line. Mirrors `CrmVendorBidLineItem`. */
export interface SabcrmBidLineInput {
  /** REAL picked catalog item id (optional on the crate). */
  itemId?: string;
  /** Cached label so a re-opened edit form never shows an id. */
  itemLabel?: string;
  qty: number;
  rate: number;
  leadTimeDays?: number;
  notes?: string;
}

/**
 * The full bid-form payload. Totals are NOT part of the input — the
 * action recomputes `subTotal` + `total` from the lines (qty × rate)
 * via the shared doc math, so the client can never save inconsistent
 * money. `vendorName` is denormalised for list views.
 */
export interface SabcrmBidFullInput {
  /** REAL picked RFQ id. Required. */
  rfqId: string;
  /** REAL picked vendor id. Required. */
  vendorId: string;
  /** Cached vendor label (denormalised onto the doc for list views). */
  vendorName?: string;
  currency: string;
  lines: SabcrmBidLineInput[];
  terms?: string;
}

/**
 * Full-form patch. `rfqId`/`vendorId` are immutable on the crate PATCH
 * DTO (a bid belongs to exactly one RFQ + vendor) and are omitted.
 */
export type SabcrmBidFullPatch = Partial<
  Omit<SabcrmBidFullInput, 'rfqId' | 'vendorId'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the bid list page sends to the fetcher. */
export interface SabcrmBidListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcrmVendorBidStatus | '';
  /** Vendor filter (the kit's party filter). */
  vendorId?: string;
  rfqId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the submitted date. */
  from?: string;
  to?: string;
}

/** A display-ready bid list row (RFQ + vendor resolved to labels). */
export interface SabcrmBidListRow {
  id: string;
  rfqId: string;
  rfqLabel: string | null;
  vendorId: string;
  vendorLabel: string | null;
  submittedAt: string | null;
  currency: string;
  total: number;
  /** Max promised lead time across lines (days); null when none. */
  leadTimeDays: number | null;
  status: SabcrmVendorBidStatus;
}

export interface SabcrmBidListPage {
  rows: SabcrmBidListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmBidKpis {
  /** Dominant currency among scanned bids (formats the strip). */
  currency: string;
  /** Bids scanned. */
  count: number;
  /** Bids still in `submitted` (awaiting review). */
  submittedCount: number;
  /** Bids shortlisted. */
  shortlistedCount: number;
  /** Bids awarded. */
  awardedCount: number;
  /** Σ totals over awarded bids (committed spend). */
  awardedValue: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Convert (bid → PO) ──────────────────────────────────────── */

/** Result payload of the bid → PO convert (route target for the toast). */
export interface SabcrmBidConvertResult {
  id: string;
  number: string;
  href: string;
}
