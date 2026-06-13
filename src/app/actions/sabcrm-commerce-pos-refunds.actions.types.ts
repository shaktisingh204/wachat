/**
 * SabCRM Commerce — POS refunds surface action types (spec WI-20).
 *
 * Read-mostly: refunds are minted from the transaction detail (WI-19);
 * here they get a paged list (with the original transaction number
 * resolved + linked, never an ObjectId) and a vocab-guarded status
 * PATCH (`SABCRM_POS_REFUND_TRANSITIONS` in the shared docs types).
 */

import type { SabcrmPosRefundUiStatus } from './sabcrm-commerce-docs.actions.types';

export interface SabcrmPosRefundListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** Refund status ('' = all). */
  status: SabcrmPosRefundUiStatus | '';
}

/** One display-ready POS-refund row. */
export interface SabcrmPosRefundListRow {
  id: string;
  originalTransactionId: string;
  /** Resolved original transaction number (null renders "Unknown"). */
  originalTransactionNumber: string | null;
  reason: string;
  refundTotal: number;
  refundMethod: string;
  processedBy: string;
  processedAt: string;
  status: SabcrmPosRefundUiStatus;
}

export interface SabcrmPosRefundListPage {
  rows: SabcrmPosRefundListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmPosRefundKpis {
  currency: string;
  count: number;
  pendingCount: number;
  completedCount: number;
  refundedTotal: number;
  sampled: boolean;
}
