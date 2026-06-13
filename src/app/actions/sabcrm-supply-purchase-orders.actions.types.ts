/**
 * SabCRM Supply — purchase-order surface action types.
 *
 * Shared between `sabcrm-supply-purchase-orders.actions.ts` ('use
 * server' modules may only export async functions) and the PO clients.
 * Mirrors the `sabcrm-finance-quotations.actions.types.ts` convention.
 *
 * Status vocabulary + transitions live in
 * `sabcrm-supply-docs.actions.types.ts` (`SabcrmPoStatus`,
 * `SABCRM_PO_FLOW`, `SABCRM_PO_TRANSITIONS`) — the crate validates the
 * same `ALLOWED_STATUSES` server-side (supply-commerce rollout WI-5).
 */

import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { SabcrmPoStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full PO-form payload. Totals are NOT part of the input — the
 * action recomputes them from `lines` + `totalsModifiers` via the
 * shared doc math, so the client can never save inconsistent money.
 */
export interface SabcrmPoFullInput {
  poNo: string;
  /** REAL picked vendor (`/v1/sabcrm/supply/vendors` id). Required. */
  vendorId: string;
  currency: string;
  /** Order date, `YYYY-MM-DD`. */
  date: string;
  /** Expected delivery, `YYYY-MM-DD` (the kit's due-date slot). */
  expectedDelivery: string;
  lines: DocLineInput[];
  /** Header modifiers folded into the recomputed wire `totals`. */
  totalsModifiers?: DocTotalsModifiersInput;
  /** Receiving warehouse (REAL picked id). */
  shipToWarehouseId?: string;
  paymentTerms?: string;
  notes?: string;
  termsAndConditions?: string;
  /** Save-and-send ⇒ the PO is transitioned to `sent` after create. */
  issue?: boolean;
  /** Optional lineage parent (RFQ award → PO). */
  fromKind?: 'rfq' | 'vendorBid';
  fromId?: string;
}

/**
 * Full-form patch — same shape, everything optional. `poNo` is
 * intentionally absent: the crate's PATCH DTO keeps PO numbers
 * immutable (audit trail).
 */
export type SabcrmPoFullPatch = Partial<
  Omit<SabcrmPoFullInput, 'poNo' | 'issue' | 'fromKind' | 'fromId'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmPoListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcrmPoStatus | '';
  vendorId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the order date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (vendor already resolved to a label). */
export interface SabcrmPoListRow {
  id: string;
  poNo: string;
  vendorId: string;
  /** Resolved vendor label, or null when the record no longer exists. */
  vendorLabel: string | null;
  date: string;
  expectedDelivery: string | null;
  currency: string;
  total: number;
  status: SabcrmPoStatus;
  /**
   * Days past the expected delivery for still-open orders
   * (sent/partial); null when not applicable.
   */
  agingDays: number | null;
}

export interface SabcrmPoListPage {
  rows: SabcrmPoListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmPoKpis {
  /** Dominant currency among scanned POs (formats the strip). */
  currency: string;
  /** Σ totals.total over open POs (draft → partial). */
  openValue: number;
  openCount: number;
  /** POs waiting in `awaiting_approval`. */
  awaitingApprovalCount: number;
  /** Open POs whose expected delivery is in the past. */
  overdueCount: number;
  /** POs received (or closed) with an update in the current month. */
  receivedThisMonth: number;
  /** POs scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Converts / related ──────────────────────────────────────── */

/** Result payload of the convert actions (route target for the toast). */
export interface SabcrmPoConvertResult {
  /** Id of the freshly created document. */
  id: string;
  /** Display number of the created document. */
  number: string;
  /** Route of the created document's surface. */
  href: string;
}
