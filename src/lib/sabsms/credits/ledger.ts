import 'server-only';

import { type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

import {
  coreHandles,
  finaliseMovement,
  getSmsCreditBalance as coreGetSmsCreditBalance,
  releaseExpiredMovements,
  reserveMovement,
  SABSMS_CREDIT_COLLECTIONS,
  type CoreHandles,
  type FinaliseResult,
  type ReserveResult,
} from './core';

/**
 * SabSMS credits ledger — the real balance source of truth.
 *
 * Balance lives on the `users` collection at `users.credits.sms`
 * (workspaceId in SabSMS == the user `_id` hex string; undefined is
 * treated as 0). Holds are taken ATOMICALLY with a conditional `$inc`
 * so concurrent sends can never overdraw.
 *
 * The atomic mechanics themselves live in worker-safe `./core` (no
 * `server-only`, no `@/`), so the tsx events worker / agent store share
 * ONE implementation. This module is the thin `server-only` wrapper:
 * `connectToDatabase()` + delegate. See `agent/store.ts` for the worker
 * caller of `instantDebit`.
 */

// Re-exported for back-compat with existing importers (ratecards/store.ts).
export {
  SABSMS_CREDIT_COLLECTIONS,
  type SabsmsReservationStatus,
  type SabsmsCreditReservation,
  type SabsmsLedgerKind,
  type SabsmsChargeType,
  type SabsmsCreditLedgerRow,
} from './core';
export type { ReserveResult, FinaliseResult } from './core';

async function handles(): Promise<CoreHandles & { db: Db }> {
  const { db } = await connectToDatabase();
  return { db, ...coreHandles(db) };
}

/** Current SMS credit balance — `users.credits.sms`, undefined → 0. */
export async function getSmsCreditBalance(workspaceId: string): Promise<number> {
  const h = await handles();
  return coreGetSmsCreditBalance(h, workspaceId);
}

/**
 * Atomically hold `amount` credits for one message. The conditional
 * `$gte` filter + `$inc` make the hold race-safe: two concurrent
 * reservations can never push the balance below zero.
 */
export async function reserveCredits(params: {
  workspaceId: string;
  messageId?: string;
  amount: number;
}): Promise<ReserveResult> {
  const h = await handles();
  return reserveMovement(h, {
    workspaceId: params.workspaceId,
    messageId: params.messageId,
    amount: params.amount,
  });
}

/**
 * Single hold covering a whole campaign chunk — same mechanics as
 * `reserveCredits`, keyed by campaignId instead of messageId.
 */
export async function reserveBatch(params: {
  workspaceId: string;
  campaignId?: string;
  count?: number;
  segmentsTotal?: number;
  amount: number;
}): Promise<ReserveResult> {
  const h = await handles();
  return reserveMovement(h, params);
}

/**
 * Settle a hold after the engine reports the send outcome.
 *
 *   - charge=false → refund the held amount, mark released ('release').
 *   - charge=true  → keep the debit, mark finalised ('debit'); when the
 *     recomputed CREDIT charge differs from the hold, the difference is
 *     adjusted on the balance and logged as 'adjust'.
 *
 * `chargeCredits` MUST already be denominated in credits — the credits
 * route recomputes it from the engine's `actualSegments` + channel via
 * `creditCostForWorkspace`. `providerCostCents` (provider wholesale cost)
 * is recorded on the debit row metadata only; it NEVER moves the balance.
 *
 * Idempotent: a reservation already finalised/released returns ok without
 * moving credits again.
 */
export async function finaliseCredits(params: {
  workspaceId: string;
  reservationToken: string;
  charge: boolean;
  /** Recomputed true credit charge (from real billed segments + channel). */
  chargeCredits?: number;
  /** Provider wholesale cost in cents — analytics metadata only. */
  providerCostCents?: number;
}): Promise<FinaliseResult> {
  const h = await handles();
  return finaliseMovement(h, {
    workspaceId: params.workspaceId,
    reservationToken: params.reservationToken,
    charge: params.charge,
    chargeCredits: params.chargeCredits,
    providerCostCents: params.providerCostCents,
  });
}

/**
 * Sweep: refund holds whose `expiresAt` passed without a finalise.
 *
 * Called both opportunistically (fire-and-forget) from the credits route
 * and on a periodic interval — the foundations agent wires a 60 s loop in
 * the PM2 events worker (see contractNotes). Default cap raised to 200.
 */
export async function releaseExpiredHolds(limit = 200): Promise<number> {
  const h = await handles();
  return releaseExpiredMovements(h, limit);
}
