import type { SabsmsChannel } from '../types';

/**
 * SabSMS credit-route wire types (V2.12 shared billing contract).
 *
 * These extend the engine ⇄ Next credits-callback contract for the
 * finalise true-up. They live here (not in `../types.ts`, which the
 * foundations agent owns) so the billing surface stays self-contained;
 * `route.ts` reads the request body through this shape.
 *
 * SHARED BILLING CONTRACT (engine `types.rs` mirrors this exactly):
 *   - `actualSegments` — the REAL billed segment count from the provider
 *     send. The route reprices credits from this + channel, never from
 *     provider cents.
 *   - `providerCostCents` — provider wholesale cost in cents, recorded on
 *     the ledger row metadata for analytics ONLY. NEVER adjusts credits.
 *     (This is the field formerly named `actualCost`, now renamed.)
 */
export interface SabsmsCreditFinaliseBody {
  workspaceId: string;
  messageId: string;
  reservationToken: string;
  charge: boolean;
  /** Real billed segment count — drives the credit reprice on finalise. */
  actualSegments?: number;
  /** Provider wholesale cost in cents — analytics metadata only. */
  providerCostCents?: number;
  /** Channel for the reprice; defaults to 'sms'. */
  channel?: SabsmsChannel | string;
  /** ISO 3166-1 alpha-2 destination; falls back to default rate. */
  destinationCountry?: string;
}

/** Narrow an arbitrary wire string to a known channel ('sms' default). */
export function normalizeChannel(raw: unknown): SabsmsChannel {
  return raw === 'mms' || raw === 'rcs' ? raw : 'sms';
}
