/**
 * Types extracted from payouts.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface PayoutKpis {
  paidThisMonthTotal: number;
  paidThisMonthCount: number;
  clearedCount: number;
  failedCount: number;
  pendingCount: number;
  currency: string;
}

export interface UnpaidBillRow {
  _id: string;
  billNo?: string;
  total: number;
  paid: number;
  balance: number;
  currency?: string;
  status?: string;
  billDate?: string;
}
