/**
 * SabSMS V2.10 — consumer additivity check.
 *
 *   npx tsx --test src/lib/sabsms/analytics/__tests__/consumer-additive.test.ts
 *
 * The V2.10 registrations (analytics rollups wildcard + identity
 * per-kind handlers) ride the SAME default router as V2.2/V2.9. This
 * suite proves the contract is additive:
 *
 *   - without `ctx.db` (the V2.2 unit-test context) every kind still
 *     dispatches cleanly — the new handlers no-op, the event log and
 *     inbox poke behave exactly as before;
 *   - with a stub `db` the rollup + identity writes actually happen;
 *   - the wildcard/kind registration shape matches the design (rollups
 *     on `*`, identity only on its four engagement kinds).
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { Db } from 'mongodb';

import {
  ALL_KINDS,
  ENGINE_EVENT_KINDS,
  SabsmsEventRouter,
  createDefaultRouter,
  type HandlerContext,
  type SabsmsEngineEvent,
} from '../../events/consumer';
import { registerAnalyticsEventHandlers } from '../handlers';
import { registerIdentityEventHandlers, IDENTITY_EVENT_KINDS } from '../../identity/handlers';
import { SABSMS_STATS_DAILY_COLLECTION } from '../rollups';
import { SABSMS_IDENTITIES_COLLECTION } from '../../identity/graph';

const WS = 'ws1';
const AT = Date.UTC(2026, 5, 10, 14, 30);

function event(kind: string, payload: Record<string, unknown> = {}): SabsmsEngineEvent {
  return { kind, payload: { workspaceId: WS, ...payload }, at: AT };
}

function baseContext(db?: Db): {
  ctx: HandlerContext;
  eventLogUpserts: unknown[];
} {
  const eventLogUpserts: unknown[] = [];
  const ctx: HandlerContext = {
    entryId: '1750000000000-0',
    redis: { set: (async () => 'OK') as HandlerContext['redis']['set'] },
    eventLog: {
      updateOne: (async (filter: unknown) => {
        eventLogUpserts.push(filter);
        return {};
      }) as unknown as HandlerContext['eventLog']['updateOne'],
    },
    log: () => undefined,
    ...(db ? { db } : {}),
  };
  return { ctx, eventLogUpserts };
}

/** Stub `Db` good enough for the rollup/identity write paths. */
function stubDb() {
  const writes: Array<{ collection: string }> = [];
  const indexCalls: string[] = [];
  const db = {
    collection(name: string) {
      return {
        async updateOne() {
          writes.push({ collection: name });
          return {};
        },
        async findOne() {
          return null;
        },
        async createIndex() {
          indexCalls.push(name);
          return name;
        },
      };
    },
  } as unknown as Db;
  return { db, writes, indexCalls };
}

describe('V2.10 registrations are additive on the default router', () => {
  it('every engine kind dispatches WITHOUT ctx.db (V2.2 contract intact)', async () => {
    const router = createDefaultRouter();
    const { ctx, eventLogUpserts } = baseContext();
    for (const kind of ENGINE_EVENT_KINDS) {
      // Must not throw — the V2.10 handlers no-op without a db handle.
      await router.dispatch(event(kind, { from: '+15550001111' }), ctx);
    }
    // The V2.2 wildcard event-log handler still ran for every kind.
    assert.equal(eventLogUpserts.length, ENGINE_EVENT_KINDS.length);
  });

  it('unknown future kinds still dispatch cleanly (forward compat)', async () => {
    const router = createDefaultRouter();
    const { ctx } = baseContext();
    await router.dispatch(event('otpSent'), ctx);
    await router.dispatch(event('fraudBlocked'), ctx);
  });

  it('with a db, a counted kind writes the daily rollup', async () => {
    const { db, writes } = stubDb();
    const router = registerAnalyticsEventHandlers(new SabsmsEventRouter());
    const { ctx } = baseContext(db);
    await router.dispatch(event('messageSent', { segments: 1 }), ctx);
    assert.ok(
      writes.some((w) => w.collection === SABSMS_STATS_DAILY_COLLECTION),
      'expected a sabsms_stats_daily write',
    );
  });

  it('with a db, an engagement kind touches the identity graph', async () => {
    const { db, writes } = stubDb();
    const router = registerIdentityEventHandlers(new SabsmsEventRouter());
    const { ctx } = baseContext(db);
    await router.dispatch(event('messageInbound', { from: '+15550001111' }), ctx);
    assert.ok(
      writes.some((w) => w.collection === SABSMS_IDENTITIES_COLLECTION),
      'expected a sabsms_identities write',
    );
  });

  it('registration shape: rollups on the wildcard, identity per-kind', () => {
    const analytics = registerAnalyticsEventHandlers(new SabsmsEventRouter());
    // A made-up kind reaches the wildcard rollup handler…
    assert.equal(analytics.handlersFor('someFutureKind').length, 1);

    const identity = registerIdentityEventHandlers(new SabsmsEventRouter());
    for (const kind of IDENTITY_EVENT_KINDS) {
      assert.equal(identity.handlersFor(kind).length, 1, kind);
    }
    // …but identity handlers never see non-engagement kinds.
    assert.equal(identity.handlersFor('messageSent').length, 0);
    assert.equal(identity.handlersFor(ALL_KINDS === '*' ? 'otpSent' : 'x').length, 0);
  });

  it('default router wires both: engagement kinds get kind + 2 wildcards', () => {
    const router = createDefaultRouter();
    // messageInbound: V2.2 poke + V2.9 journey kind handlers + identity
    // kind handler + wildcards (event log, journeys?, rollups). Exact
    // counts evolve — assert the V2.10 minimum is present instead.
    const inbound = router.handlersFor('messageInbound').length;
    const unknown = router.handlersFor('someFutureKind').length;
    assert.ok(unknown >= 2, `wildcards missing (got ${unknown})`); // event log + rollups
    assert.ok(inbound > unknown, 'kind-specific handlers missing for messageInbound');
  });
});
