/**
 * SabSMS analytics — event-consumer handler registration (V2.10).
 *
 * Adapts [`bumpStats`] onto the `sabsms:events` consumer router as a
 * WILDCARD handler: every event (known or future — otpSent, fraudBlocked,
 * ...) flows through; `incrementsForEvent` decides which kinds actually
 * touch counters, so unknown kinds are a graceful no-op.
 *
 * Registration is ADDITIVE (same contract as `../journeys/handlers.ts`):
 * the handler no-ops when the dispatch context carries no `db`, so the
 * pure-router unit tests and the V2.2 consumer behaviour are untouched.
 *
 * Indexes are ensured lazily, once per `Db` handle, so `consumer.ts`
 * needs no startup edits beyond registration.
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import type { Db } from 'mongodb';

import {
  ALL_KINDS,
  type HandlerContext,
  type SabsmsEngineEvent,
  type SabsmsEventRouter,
} from '../events/consumer';
import { bumpStats, ensureStatsIndexes } from './rollups';

const indexesEnsured = new WeakSet<Db>();

async function ensureOnce(db: Db): Promise<void> {
  if (indexesEnsured.has(db)) return;
  indexesEnsured.add(db);
  try {
    await ensureStatsIndexes(db);
  } catch {
    // Index creation is best-effort here (it may race a parallel
    // consumer); the unique key still guards correctness once present.
    indexesEnsured.delete(db);
  }
}

export function registerAnalyticsEventHandlers(
  router: SabsmsEventRouter,
): SabsmsEventRouter {
  router.on(ALL_KINDS, async (event: SabsmsEngineEvent, ctx: HandlerContext) => {
    const db = ctx.db;
    if (!db) return;
    await ensureOnce(db);
    await bumpStats(db, event);
  });
  return router;
}
