/**
 * SabCRM Commerce — POS holds surface action types (spec WI-21).
 *
 * Read-mostly: holds are parked from the register (WI-22) and recalled
 * there. Here they get a paged list (session + customer labels
 * resolved, never an ObjectId) with the cart value rolled up; void
 * reuses the back-compat verb.
 */

import type { CrmPosHoldStatus } from '@/lib/rust-client/crm-pos';

export interface SabcrmPosHoldListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** Hold status ('' = all). */
  status: CrmPosHoldStatus | '';
}

/** One display-ready POS-hold row. */
export interface SabcrmPosHoldListRow {
  id: string;
  heldAt: string;
  heldBy: string;
  sessionId: string;
  /** Resolved session label (terminal · date) — null renders "Unknown". */
  sessionLabel: string | null;
  customerId: string | null;
  /** Resolved customer name, or "Walk-in" when no customer. */
  customerLabel: string;
  itemsCount: number;
  /** Cart value rolled up from line-item totals. */
  cartValue: number;
  holdReason: string | null;
  status: CrmPosHoldStatus;
}

export interface SabcrmPosHoldListPage {
  rows: SabcrmPosHoldListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmPosHoldKpis {
  currency: string;
  count: number;
  heldCount: number;
  recalledCount: number;
  heldCartValue: number;
  sampled: boolean;
}
