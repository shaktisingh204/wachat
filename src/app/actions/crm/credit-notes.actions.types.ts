/**
 * Types extracted from credit-notes.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CreditNoteKpis {
  totalCount: number;
  refundedCount: number;
  pendingRefundCount: number;
  linkedInvoiceValue: number;
  currency: string;
}
