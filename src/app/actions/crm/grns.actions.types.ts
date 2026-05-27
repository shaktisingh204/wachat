/**
 * Types extracted from grns.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface GrnKpis {
  pendingQcCount: number;
  acceptedCount: number;
  partiallyAcceptedCount: number;
  rejectedCount: number;
  /** Number of GRNs created in the current calendar month. */
  mtdCount: number;
  /** Sum of received-quantity × unit cost across the sampled window. */
  totalReceivedValue: number;
  /** ISO currency code dominant across the sampled window. */
  totalReceivedCurrency: string;
}
