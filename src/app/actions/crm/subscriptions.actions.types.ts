/**
 * Types extracted from subscriptions.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface SubscriptionKpiSnapshot {
  /** Active subscriptions (status === 'active'). */
  activeCount: number;
  /** Trial subscriptions (status === 'trial'). */
  trialCount: number;
  /** Past-due subscriptions (status === 'past_due'). */
  pastDueCount: number;
  /** Churned subscriptions (status ∈ {'cancelled','expired'}). */
  churnedCount: number;
  /**
   * Monthly recurring revenue across active + trial subscriptions, in the
   * default tenant currency. Trial subscriptions contribute at full plan
   * price — adjust if/when a tenant ever wants ARR-style tiering.
   */
  mrr: number;
  /** Default currency for the MRR figure. Picked from the first row. */
  currency: string;
}
