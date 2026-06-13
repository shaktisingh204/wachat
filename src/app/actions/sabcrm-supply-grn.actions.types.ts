/**
 * SabCRM Supply — GRN surface action types (rollout WI-6).
 *
 * Shared between `sabcrm-supply-grn.actions.ts` ('use server' modules may
 * only export async functions) and the GRN clients. Mirrors the
 * `sabcrm-supply-purchase-orders.actions.types.ts` convention.
 *
 * Status vocabulary + transitions live in
 * `sabcrm-supply-docs.actions.types.ts` (`SabcrmGrnStatus`,
 * `SABCRM_GRN_FLOW`, `SABCRM_GRN_TRANSITIONS`).
 */

import type { CrmGrnLineItem } from '@/lib/rust-client/crm-grns';
import type { SabcrmGrnStatus } from './sabcrm-supply-docs.actions.types';

/* ─── Create / update (full form payloads) ─────────────────────── */

/**
 * One received-line draft from the bespoke GRN lines editor. Mirrors the
 * crate `GrnLineItem` (receivedQty == acceptedQty + rejectedQty is
 * validated in the action, not at the type level).
 */
export interface SabcrmGrnLineInput {
  itemId: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  batch?: string;
  expiry?: string;
  serialNos?: string[];
}

/** The full GRN-form payload. */
export interface SabcrmGrnFullInput {
  grnNo: string;
  date: string;
  /** REAL picked vendor. Required. */
  vendorId: string;
  /** REAL picked receiving warehouse. Required. */
  warehouseId: string;
  /** Optional parent PO (direct receipts allowed). */
  poId?: string;
  /** Optional inspector (records-engine person). */
  inspectorId?: string;
  items: SabcrmGrnLineInput[];
  /** SabFiles attachment ids. */
  attachments?: { fileId: string; name?: string; mimeType?: string; size?: number }[];
}

/** Full-form patch — `grnNo` + `poId` are immutable on the crate PATCH. */
export type SabcrmGrnFullPatch = Partial<
  Omit<SabcrmGrnFullInput, 'grnNo' | 'poId'>
>;

/* ─── List page / KPIs ─────────────────────────────────────────── */

export interface SabcrmGrnListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcrmGrnStatus | '';
  vendorId?: string;
  from?: string;
  to?: string;
}

/** A display-ready GRN list row (vendor/warehouse/PO already resolved). */
export interface SabcrmGrnListRow {
  id: string;
  grnNo: string;
  vendorId: string;
  vendorLabel: string | null;
  warehouseId: string;
  warehouseLabel: string | null;
  poId: string | null;
  poLabel: string | null;
  date: string;
  /** Σ acceptedQty over all lines. */
  acceptedQty: number;
  /** Σ receivedQty over all lines. */
  receivedQty: number;
  lineCount: number;
  status: SabcrmGrnStatus;
}

export interface SabcrmGrnListPage {
  rows: SabcrmGrnListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmGrnKpis {
  /** GRNs awaiting inspection (draft/received/partial). */
  awaitingInspectionCount: number;
  /** GRNs posted (or closed) this month. */
  postedThisMonth: number;
  /** GRNs flagged qc_failed / rejected. */
  rejectedCount: number;
  /** Σ acceptedQty across scanned GRNs. */
  unitsAccepted: number;
  count: number;
  sampled: boolean;
}

/** Resolved line for the [id] detail's ordered/received/accepted rail. */
export interface SabcrmGrnDetailLine extends CrmGrnLineItem {
  itemLabel: string | null;
}
