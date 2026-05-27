/**
 * Types extracted from debit-notes.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface DebitNoteKpis {
  totalCount: number;
  refundedCount: number;
  pendingRefundCount: number;
  linkedBillValue: number;
  currency: string;
}
