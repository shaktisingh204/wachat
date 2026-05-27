/**
 * Types extracted from payment-receipts.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface PaymentReceiptKpis {
  receivedThisMonthTotal: number;
  receivedThisMonthCount: number;
  clearedCount: number;
  bouncedCount: number;
  avgDaysToCollect: number;
  currency: string;
  /** Count of receipts not yet cleared (status = received or unset). */
  pendingCount: number;
  /** Count of receipts that bounced or are unreconciled. */
  failedCount: number;
  /** Most-used payment mode across the loaded window (e.g. `upi`). */
  topMethod: string;
}
