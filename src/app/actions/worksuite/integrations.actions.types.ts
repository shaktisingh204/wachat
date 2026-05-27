/**
 * Types extracted from integrations.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type IntegrationProvider =

export interface IntegrationEvent {
  _id: string;
  provider: IntegrationProvider;
  /** `'sync' | 'test' | 'delivery' | 'connect' | 'disconnect' | 'error'` */
  kind: string;
  /** `'success' | 'failure' | 'pending'` */
  status: 'success' | 'failure' | 'pending';
  message?: string;
  count?: number;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationStats {
  /** Sum of `count` on events of any provider-defined "delivery" kind today. */
  deliveriesToday: number;
  /** Failures recorded today. */
  failuresToday: number;
  /** Total successful deliveries this month. */
  deliveriesThisMonth: number;
  /** Last successful event timestamp (ISO) or null. */
  lastSuccessAt: string | null;
  /** Last failed event message (truncated) or null. */
  lastErrorMessage: string | null;
  /** Failures / (successes + failures) over the last 30 days, 0..1. */
  errorRate30d: number;
}
