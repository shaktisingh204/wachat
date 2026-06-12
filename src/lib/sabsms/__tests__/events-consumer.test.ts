/**
 * SabSMS events consumer — pure-logic tests (parse + dispatch).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/events-consumer.test.ts
 *
 * Covers the Redis-free surface of `../events/consumer.ts`:
 *
 *   - `parseStreamEntry` against the exact wire shape the Rust engine
 *     XADDs (`services/sabsms-engine/src/events.rs` — serde tag `kind`,
 *     camelCase fields, `payload` as a JSON string, `at` epoch ms);
 *   - malformed-payload tolerance (missing kind, broken JSON, non-object
 *     payload) — parse failures must be reported, never thrown;
 *   - `SabsmsEventRouter` routing: kind handlers + `*` catch-alls,
 *     ordering, error propagation (so the caller skips XACK);
 *   - default-router handlers: inbox poke key on `messageInbound`,
 *     event-log upsert keyed on the stream entry id, replay tolerance.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  ALL_KINDS,
  ENGINE_EVENT_KINDS,
  SabsmsEventRouter,
  createDefaultRouter,
  eventWorkspaceId,
  inboxPokeKey,
  parseStreamEntry,
  type HandlerContext,
  type SabsmsEngineEvent,
} from '../events/consumer';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Build the flat field array the engine XADDs (events.rs `try_emit`). */
function engineFields(event: Record<string, unknown>, at = 1_750_000_000_000): string[] {
  return ['kind', String(event.kind), 'payload', JSON.stringify(event), 'at', String(at)];
}

interface RecordedSet {
  key: string;
  value: string;
  mode?: string;
  ttl?: number;
}

function mockContext(entryId = '1750000000000-0') {
  const sets: RecordedSet[] = [];
  const upserts: Array<{ filter: unknown; update: unknown; options: unknown }> = [];
  const logs: Array<{ message: string; extra?: Record<string, unknown> }> = [];

  const ctx: HandlerContext = {
    entryId,
    redis: {
      set: (async (key: string, value: string, mode?: string, ttl?: number) => {
        sets.push({ key, value, mode, ttl });
        return 'OK';
      }) as HandlerContext['redis']['set'],
    },
    eventLog: {
      updateOne: (async (filter: unknown, update: unknown, options: unknown) => {
        upserts.push({ filter, update, options });
        return { acknowledged: true } as never;
      }) as HandlerContext['eventLog']['updateOne'],
    },
    log: (message, extra) => logs.push({ message, extra }),
  };

  return { ctx, sets, upserts, logs };
}

// ─── parseStreamEntry ─────────────────────────────────────────────────────

describe('parseStreamEntry', () => {
  it('parses a messageSent entry with camelCase payload fields', () => {
    const fields = engineFields({
      kind: 'messageSent',
      workspaceId: 'ws1',
      messageId: 'm1',
      provider: 'twilio',
      segments: 2,
    });
    const parsed = parseStreamEntry('1-0', fields);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.id, '1-0');
    assert.equal(parsed.event.kind, 'messageSent');
    assert.equal(parsed.event.payload.workspaceId, 'ws1');
    assert.equal(parsed.event.payload.messageId, 'm1');
    assert.equal(parsed.event.payload.segments, 2);
    assert.equal(parsed.event.at, 1_750_000_000_000);
  });

  it('parses a messageInbound entry (conversationId + from + body)', () => {
    const fields = engineFields({
      kind: 'messageInbound',
      workspaceId: 'ws1',
      messageId: 'm2',
      conversationId: 'c1',
      from: '+15551230000',
      body: 'hi there',
    });
    const parsed = parseStreamEntry('2-0', fields);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.event.payload.conversationId, 'c1');
    assert.equal(parsed.event.payload.from, '+15551230000');
  });

  it('parses complianceRescheduled untilEpoch as camelCase', () => {
    const fields = engineFields({
      kind: 'complianceRescheduled',
      workspaceId: 'ws1',
      messageId: 'm3',
      untilEpoch: 1_700_000_000,
    });
    const parsed = parseStreamEntry('3-0', fields);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.event.payload.untilEpoch, 1_700_000_000);
  });

  it('reports a missing kind field instead of throwing', () => {
    const parsed = parseStreamEntry('4-0', ['payload', '{}', 'at', '1']);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /kind/);
  });

  it('reports invalid payload JSON instead of throwing', () => {
    const parsed = parseStreamEntry('5-0', [
      'kind',
      'messageQueued',
      'payload',
      '{not json',
      'at',
      '1',
    ]);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /JSON/);
  });

  it('rejects non-object payloads (arrays, null, scalars)', () => {
    for (const bad of ['[1,2]', 'null', '"str"', '42']) {
      const parsed = parseStreamEntry('6-0', [
        'kind',
        'messageQueued',
        'payload',
        bad,
        'at',
        '1',
      ]);
      assert.equal(parsed.ok, false, `payload ${bad} must be rejected`);
    }
  });

  it('tolerates a missing/garbage `at` (falls back to 0)', () => {
    const noAt = parseStreamEntry('7-0', [
      'kind',
      'messageQueued',
      'payload',
      '{"kind":"messageQueued","workspaceId":"w","messageId":"m"}',
    ]);
    assert.equal(noAt.ok, true);
    if (noAt.ok) assert.equal(noAt.event.at, 0);

    const badAt = parseStreamEntry('8-0', [
      'kind',
      'messageQueued',
      'payload',
      '{}',
      'at',
      'soon',
    ]);
    assert.equal(badAt.ok, true);
    if (badAt.ok) assert.equal(badAt.event.at, 0);
  });

  it('tolerates a missing payload field entirely (empty object)', () => {
    const parsed = parseStreamEntry('9-0', ['kind', 'messageQueued', 'at', '5']);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.event.payload, {});
  });

  it('ignores a trailing odd field instead of crashing', () => {
    const parsed = parseStreamEntry('10-0', [
      'kind',
      'messageQueued',
      'payload',
      '{}',
      'orphan',
    ]);
    assert.equal(parsed.ok, true);
  });
});

// ─── eventWorkspaceId ─────────────────────────────────────────────────────

describe('eventWorkspaceId', () => {
  it('extracts workspaceId and defaults to empty string', () => {
    const ev = (payload: Record<string, unknown>): SabsmsEngineEvent => ({
      kind: 'messageQueued',
      payload,
      at: 0,
    });
    assert.equal(eventWorkspaceId(ev({ workspaceId: 'ws9' })), 'ws9');
    assert.equal(eventWorkspaceId(ev({})), '');
    assert.equal(eventWorkspaceId(ev({ workspaceId: 42 })), '');
  });
});

// ─── SabsmsEventRouter ────────────────────────────────────────────────────

describe('SabsmsEventRouter', () => {
  const event: SabsmsEngineEvent = {
    kind: 'messageDelivered',
    payload: { workspaceId: 'ws1', messageId: 'm1' },
    at: 1,
  };

  it('routes to the kind handler then the wildcard, in order', async () => {
    const calls: string[] = [];
    const router = new SabsmsEventRouter()
      .on('messageDelivered', () => {
        calls.push('kind');
      })
      .on(ALL_KINDS, () => {
        calls.push('star');
      });

    const { ctx } = mockContext();
    const ran = await router.dispatch(event, ctx);
    assert.equal(ran, 2);
    assert.deepEqual(calls, ['kind', 'star']);
  });

  it('runs only the wildcard for kinds with no specific handler', async () => {
    const calls: string[] = [];
    const router = new SabsmsEventRouter()
      .on('messageInbound', () => {
        calls.push('inbound');
      })
      .on(ALL_KINDS, () => {
        calls.push('star');
      });

    const { ctx } = mockContext();
    const ran = await router.dispatch(event, ctx);
    assert.equal(ran, 1);
    assert.deepEqual(calls, ['star']);
  });

  it('handles unknown future kinds without throwing (forward compat)', async () => {
    const router = new SabsmsEventRouter().on(ALL_KINDS, () => undefined);
    const { ctx } = mockContext();
    const ran = await router.dispatch(
      { kind: 'somethingNewFromTheEngine', payload: {}, at: 0 },
      ctx,
    );
    assert.equal(ran, 1);
  });

  it('propagates handler errors so the caller skips XACK', async () => {
    const router = new SabsmsEventRouter().on(ALL_KINDS, () => {
      throw new Error('mongo down');
    });
    const { ctx } = mockContext();
    await assert.rejects(() => router.dispatch(event, ctx), /mongo down/);
  });
});

// ─── createDefaultRouter ──────────────────────────────────────────────────

describe('createDefaultRouter', () => {
  it('messageInbound bumps the per-workspace inbox poke key', async () => {
    const router = createDefaultRouter();
    const { ctx, sets } = mockContext();
    await router.dispatch(
      {
        kind: 'messageInbound',
        payload: {
          workspaceId: 'ws1',
          messageId: 'm1',
          conversationId: 'c1',
          from: '+15551230000',
          body: 'hello',
        },
        at: 1_750_000_000_000,
      },
      ctx,
    );
    assert.equal(sets.length, 1);
    assert.equal(sets[0].key, inboxPokeKey('ws1'));
    assert.equal(sets[0].mode, 'EX');
    assert.ok((sets[0].ttl ?? 0) > 0, 'poke key must expire');
  });

  it('every kind lands in the event log, keyed on the stream entry id', async () => {
    const router = createDefaultRouter();
    for (const kind of ENGINE_EVENT_KINDS) {
      const { ctx, upserts } = mockContext(`${kind}-entry-0`);
      await router.dispatch(
        { kind, payload: { workspaceId: 'wsX' }, at: 1_750_000_000_000 },
        ctx,
      );
      assert.equal(upserts.length, 1, `${kind} must be logged`);
      const { filter, update, options } = upserts[0] as {
        filter: { streamId: string };
        update: { $setOnInsert: Record<string, unknown> };
        options: { upsert: boolean };
      };
      assert.equal(filter.streamId, `${kind}-entry-0`);
      assert.equal(options.upsert, true);
      assert.equal(update.$setOnInsert.kind, kind);
      assert.equal(update.$setOnInsert.workspaceId, 'wsX');
      assert.ok(update.$setOnInsert.at instanceof Date);
    }
  });

  it('tolerates replays — re-dispatching the same entry is harmless', async () => {
    const router = createDefaultRouter();
    const { ctx, upserts, sets } = mockContext('77-0');
    const event: SabsmsEngineEvent = {
      kind: 'messageInbound',
      payload: { workspaceId: 'ws1', conversationId: 'c1' },
      at: 1_750_000_000_000,
    };
    await router.dispatch(event, ctx);
    await router.dispatch(event, ctx); // replay (e.g. crash before XACK)

    // The event-log write is a $setOnInsert upsert on streamId, so the
    // second pass is a no-op insert-wise; the poke SET is idempotent.
    assert.equal(upserts.length, 2);
    for (const u of upserts) {
      assert.deepEqual((u.filter as { streamId: string }).streamId, '77-0');
      assert.ok(
        Object.keys(u.update as Record<string, unknown>).every(
          (k) => k === '$setOnInsert',
        ),
        'replay-safe writes must only use $setOnInsert',
      );
    }
    assert.equal(sets.length, 2);
    assert.equal(sets[0].key, sets[1].key);
  });

  it('contactUnsubscribed logs without touching redis', async () => {
    const router = createDefaultRouter();
    const { ctx, sets, logs } = mockContext();
    await router.dispatch(
      {
        kind: 'contactUnsubscribed',
        payload: { workspaceId: 'ws1', phoneHash: 'h', source: 'keyword' },
        at: 0,
      },
      ctx,
    );
    assert.equal(sets.length, 0);
    assert.ok(logs.some((l) => l.message === 'contactUnsubscribed'));
  });
});
