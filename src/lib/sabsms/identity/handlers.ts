/**
 * SabSMS identity graph — event-consumer handler registration (V2.10).
 *
 * Adapts [`touchIdentity`] onto the `sabsms:events` consumer router.
 * Registered per-kind (not wildcard) so only the four engagement kinds
 * pay the dispatch cost; everything else never reaches the identity
 * code path. Registration is ADDITIVE: handlers no-op without `ctx.db`
 * (pure-router unit tests), exactly like `../journeys/handlers.ts`.
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import type { Db } from 'mongodb';

import type {
  HandlerContext,
  SabsmsEngineEvent,
  SabsmsEventRouter,
} from '../events/consumer';
import { ensureIdentityIndexes, touchIdentity } from './graph';

/** Kinds that mutate the identity graph. */
export const IDENTITY_EVENT_KINDS = [
  'messageInbound',
  'linkClicked',
  'messageDelivered',
  'contactUnsubscribed',
] as const;

const indexesEnsured = new WeakSet<Db>();

async function ensureOnce(db: Db): Promise<void> {
  if (indexesEnsured.has(db)) return;
  indexesEnsured.add(db);
  try {
    await ensureIdentityIndexes(db);
  } catch {
    indexesEnsured.delete(db);
  }
}

export function registerIdentityEventHandlers(
  router: SabsmsEventRouter,
): SabsmsEventRouter {
  for (const kind of IDENTITY_EVENT_KINDS) {
    router.on(kind, async (event: SabsmsEngineEvent, ctx: HandlerContext) => {
      const db = ctx.db;
      if (!db) return;
      await ensureOnce(db);
      await touchIdentity(db, event);
    });
  }
  return router;
}
