/**
 * SabCRM Supply — RFQ surface action types (rollout WI-8).
 *
 * Shared between `sabcrm-supply-rfqs.actions.ts` ('use server' modules
 * may only export async functions) and the RFQ clients. Status
 * vocabulary + transitions live in `sabcrm-supply-docs.actions.types.ts`
 * (`SabcrmRfqStatus`, `SABCRM_RFQ_FLOW`, `SABCRM_RFQ_TRANSITIONS`) — the
 * `crm-rfqs` crate validates the same `ALLOWED_RFQ_STATUSES` server-side.
 *
 * RFQ lines carry NO price (price is collected via vendor bids), so the
 * kit `LineItemsEditor` does not fit — the client renders a bespoke
 * `RfqLinesEditor`, and these types describe the no-rate line shape.
 */

import type { SabcrmRfqStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Create / update (full form payloads) ────────────────────── */

/** One requested-item line (no price). Mirrors `CrmRfqLineItem`. */
export interface SabcrmRfqLineInput {
  /** REAL picked catalog item id — required by the crate. */
  itemId: string;
  /** Cached label so a re-opened edit form never shows an id. */
  itemLabel?: string;
  description?: string;
  qty: number;
  unit?: string;
  specs?: string;
}

/** The full RFQ-form payload. */
export interface SabcrmRfqFullInput {
  title: string;
  lines: SabcrmRfqLineInput[];
  /** `YYYY-MM-DD` — when the goods are needed. */
  requiredBy?: string;
  /** `YYYY-MM-DD` — bid submission deadline. */
  deadline?: string;
  /** REAL picked vendor ids invited to quote. */
  vendorsInvited: string[];
  terms?: string;
  /** Open the RFQ to vendors immediately (draft → open after create). */
  issue?: boolean;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmRfqFullPatch = Partial<Omit<SabcrmRfqFullInput, 'issue'>>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the RFQ list page sends to the fetcher. */
export interface SabcrmRfqListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcrmRfqStatus | '';
  /** Inclusive `YYYY-MM-DD` bounds applied to the required-by date. */
  from?: string;
  to?: string;
}

/** A display-ready RFQ list row. */
export interface SabcrmRfqListRow {
  id: string;
  title: string;
  itemCount: number;
  requiredBy: string | null;
  deadline: string | null;
  invitedCount: number;
  bidCount: number;
  status: SabcrmRfqStatus;
  /** Days past the bid deadline for still-open RFQs; null otherwise. */
  agingDays: number | null;
}

export interface SabcrmRfqListPage {
  rows: SabcrmRfqListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmRfqKpis {
  /** RFQs scanned. */
  count: number;
  /** RFQs currently open for bidding. */
  openCount: number;
  /** RFQs awarded. */
  awardedCount: number;
  /** Open RFQs whose bid deadline has passed. */
  overdueCount: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Bids (RFQ detail rail) ───────────────────────────────────── */

/** One bid row in the RFQ detail bids table (vendor resolved). */
export interface SabcrmRfqBidRow {
  id: string;
  vendorId: string;
  vendorLabel: string;
  total: number;
  currency: string;
  /** Max promised lead time across the bid's lines (days); null when none. */
  leadTimeDays: number | null;
  status: string;
  submittedAt: string | null;
}
