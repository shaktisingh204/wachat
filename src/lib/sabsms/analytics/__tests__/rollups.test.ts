/**
 * SabSMS analytics rollups — pure-logic + stub-db tests (V2.10).
 *
 *   npx tsx --test src/lib/sabsms/analytics/__tests__/rollups.test.ts
 *
 * Covers the Mongo-free surface of `../rollups.ts`:
 *
 *   - `incrementsForEvent` — the event-kind → counter mapping;
 *   - `dimsKey` — stability under property-order permutations and
 *     empty-value dropping (the unique-index key MUST be deterministic);
 *   - `bumpStats` — bounded dim-combo fan-out + `$inc` doc shape against
 *     a recorded stub db (in-memory pattern from journeys __tests__);
 *   - read-path helpers (`kpisFromRows`, `seriesFromRows`, `groupRowsByDim`).
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { SabsmsEngineEvent } from '../../events/consumer';
import {
  bumpStats,
  dimCombos,
  dimsKey,
  groupRowsByDim,
  incrementsForEvent,
  kpisFromRows,
  normalizeCounters,
  seriesFromRows,
  sumCounters,
  utcDateKey,
  zeroCounters,
  SABSMS_STATS_DAILY_COLLECTION,
  type SabsmsStatsRow,
  type StatsDbLike,
} from '../rollups';

const WS = 'ws1';
const MSG_ID = '0123456789abcdef01234567';
const AT = Date.UTC(2026, 5, 10, 14, 30); // 2026-06-10T14:30Z

function event(kind: string, payload: Record<string, unknown> = {}): SabsmsEngineEvent {
  return { kind, payload: { workspaceId: WS, ...payload }, at: AT };
}

// ─── Stub db (recorded updateOne calls + canned message lookups) ──────────

interface RecordedUpdate {
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
}

function stubDb(messageDoc: Record<string, unknown> | null = null) {
  const updates: RecordedUpdate[] = [];
  const db: StatsDbLike = {
    collection(name: string) {
      return {
        async updateOne(filter: unknown, update: unknown) {
          updates.push({
            collection: name,
            filter: filter as Record<string, unknown>,
            update: update as Record<string, unknown>,
          });
          return {};
        },
        async findOne() {
          return name === 'sabsms_messages' ? messageDoc : null;
        },
      };
    },
  };
  return { db, updates };
}

// ─── incrementsForEvent ────────────────────────────────────────────────────

describe('incrementsForEvent — kind → counter mapping', () => {
  it('maps every counted kind to exactly its counter', () => {
    assert.deepEqual(incrementsForEvent(event('messageQueued')), { queued: 1 });
    assert.deepEqual(incrementsForEvent(event('messageDelivered')), { delivered: 1 });
    assert.deepEqual(incrementsForEvent(event('messageFailed')), { failed: 1 });
    assert.deepEqual(incrementsForEvent(event('messageInbound')), { inbound: 1 });
    assert.deepEqual(incrementsForEvent(event('contactUnsubscribed')), { optOuts: 1 });
    assert.deepEqual(incrementsForEvent(event('linkClicked')), { clicks: 1 });
  });

  it('messageSent carries the segment count (floor, min 1)', () => {
    assert.deepEqual(incrementsForEvent(event('messageSent', { segments: 3 })), {
      sent: 1,
      segments: 3,
    });
    assert.deepEqual(incrementsForEvent(event('messageSent', { segments: 2.9 })), {
      sent: 1,
      segments: 2,
    });
    // Missing / zero / garbage segments default to 1.
    assert.deepEqual(incrementsForEvent(event('messageSent')), { sent: 1, segments: 1 });
    assert.deepEqual(incrementsForEvent(event('messageSent', { segments: 0 })), {
      sent: 1,
      segments: 1,
    });
    assert.deepEqual(incrementsForEvent(event('messageSent', { segments: 'x' })), {
      sent: 1,
      segments: 1,
    });
  });

  it('ignores lifecycle/compliance/unknown kinds (graceful null)', () => {
    for (const kind of [
      'campaignCompleted',
      'complianceBlocked',
      'complianceRescheduled',
      'routeFailover',
      'otpSent',
      'fraudBlocked',
      'someFutureKind',
    ]) {
      assert.equal(incrementsForEvent(event(kind)), null, kind);
    }
  });
});

// ─── dimsKey stability ─────────────────────────────────────────────────────

describe('dimsKey — deterministic unique-index key', () => {
  it('is `{}` for the total row', () => {
    assert.equal(dimsKey({}), '{}');
  });

  it('is invariant under property insertion order', () => {
    const a = dimsKey({ provider: 'twilio', campaignId: 'c1' });
    const b = dimsKey({ campaignId: 'c1', provider: 'twilio' });
    assert.equal(a, b);
  });

  it('drops empty/undefined values so sparse dims collapse', () => {
    assert.equal(dimsKey({ provider: '' }), '{}');
    assert.equal(dimsKey({ provider: undefined }), '{}');
    assert.equal(
      dimsKey({ provider: 'twilio', campaignId: undefined }),
      dimsKey({ provider: 'twilio' }),
    );
  });

  it('sorts keys lexicographically', () => {
    assert.equal(
      dimsKey({ provider: 'p', campaignId: 'c', country: 'IN' }),
      '{"campaignId":"c","country":"IN","provider":"p"}',
    );
  });
});

describe('utcDateKey', () => {
  it('buckets on the UTC day', () => {
    assert.equal(utcDateKey(AT), '2026-06-10');
    assert.equal(utcDateKey(Date.UTC(2026, 5, 10, 23, 59, 59)), '2026-06-10');
    assert.equal(utcDateKey(Date.UTC(2026, 5, 11, 0, 0, 0)), '2026-06-11');
  });
});

// ─── bumpStats fan-out ─────────────────────────────────────────────────────

describe('bumpStats — bounded dim-combo fan-out', () => {
  it('messageSent fans out to total + provider + campaign', async () => {
    const { db, updates } = stubDb({ provider: 'twilio', campaignId: 'c1' });
    const res = await bumpStats(
      db,
      event('messageSent', { messageId: MSG_ID, segments: 2 }),
    );
    assert.equal(res.bumped, 3);
    assert.equal(updates.length, 3);
    const keys = updates.map((u) => u.filter.dimsKey).sort();
    assert.deepEqual(keys, ['{"campaignId":"c1"}', '{"provider":"twilio"}', '{}']);
    for (const u of updates) {
      assert.equal(u.collection, SABSMS_STATS_DAILY_COLLECTION);
      assert.equal(u.filter.workspaceId, WS);
      assert.equal(u.filter.date, '2026-06-10');
      assert.deepEqual(u.update.$inc, { 'counters.sent': 1, 'counters.segments': 2 });
    }
  });

  it('payload provider wins without a message lookup hit', async () => {
    const { db, updates } = stubDb(null);
    const res = await bumpStats(
      db,
      event('messageSent', { messageId: MSG_ID, provider: 'gupshup' }),
    );
    assert.equal(res.bumped, 2); // total + provider (no campaign known)
    const keys = updates.map((u) => u.filter.dimsKey).sort();
    assert.deepEqual(keys, ['{"provider":"gupshup"}', '{}']);
  });

  it('linkClicked attributes the campaign straight off the payload', async () => {
    const { db, updates } = stubDb(null);
    const res = await bumpStats(db, event('linkClicked', { campaignId: 'c9' }));
    assert.equal(res.bumped, 2);
    const keys = updates.map((u) => u.filter.dimsKey).sort();
    assert.deepEqual(keys, ['{"campaignId":"c9"}', '{}']);
    assert.deepEqual(updates[0].update.$inc, { 'counters.clicks': 1 });
  });

  it('ignored kinds and missing workspaceId are graceful no-ops', async () => {
    const { db, updates } = stubDb(null);
    assert.deepEqual(await bumpStats(db, event('routeFailover')), { bumped: 0 });
    assert.deepEqual(
      await bumpStats(db, { kind: 'messageSent', payload: {}, at: AT }),
      { bumped: 0 },
    );
    assert.equal(updates.length, 0);
  });

  it('dimCombos never fans beyond the three bounded granularities', () => {
    assert.deepEqual(
      dimCombos({ provider: 'p', campaignId: 'c', country: 'IN', channel: 'sms' }),
      [{}, { provider: 'p' }, { campaignId: 'c' }],
    );
  });
});

// ─── Read-path helpers ─────────────────────────────────────────────────────

function row(date: string, partial: Partial<ReturnType<typeof zeroCounters>>, dims = {}): SabsmsStatsRow {
  return { date, dims, counters: { ...zeroCounters(), ...partial } };
}

describe('read-path helpers', () => {
  it('normalizeCounters fills sparse live docs with zeros', () => {
    const c = normalizeCounters({ sent: 2 });
    assert.equal(c.sent, 2);
    assert.equal(c.delivered, 0);
    assert.equal(c.creditsSpent, 0);
  });

  it('kpisFromRows derives delivery rate + CTR at 1dp', () => {
    const kpi = kpisFromRows([
      row('2026-06-09', { sent: 8, delivered: 6, clicks: 1 }),
      row('2026-06-10', { sent: 4, delivered: 3, clicks: 2 }),
    ]);
    assert.equal(kpi.sent, 12);
    assert.equal(kpi.delivered, 9);
    assert.equal(kpi.deliveryRatePct, 75);
    assert.equal(kpi.ctrPct, 33.3);
    // Zero denominators never NaN.
    const empty = kpisFromRows([]);
    assert.equal(empty.deliveryRatePct, 0);
    assert.equal(empty.ctrPct, 0);
  });

  it('sumCounters + groupRowsByDim collapse per-bucket', () => {
    const rows = [
      row('2026-06-09', { sent: 2 }, { provider: 'a' }),
      row('2026-06-10', { sent: 3 }, { provider: 'a' }),
      row('2026-06-10', { sent: 1 }, { provider: 'b' }),
    ];
    assert.equal(sumCounters(rows).sent, 6);
    const grouped = groupRowsByDim(rows, 'provider');
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].bucket, 'a');
    assert.equal(grouped[0].counters.sent, 5);
  });

  it('seriesFromRows densifies missing days with zeros', () => {
    const series = seriesFromRows(
      [row('2026-06-10', { sent: 5 })],
      '2026-06-09',
      '2026-06-11',
    );
    assert.deepEqual(
      series.map((p) => [p.date, p.sent]),
      [
        ['2026-06-09', 0],
        ['2026-06-10', 5],
        ['2026-06-11', 0],
      ],
    );
    // Bad ranges produce an empty series, never a spin.
    assert.deepEqual(seriesFromRows([], 'garbage', '2026-06-11'), []);
  });
});
