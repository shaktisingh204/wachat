/**
 * SabSMS rollup reconciliation — drift math tests (V2.10).
 *
 *   npx tsx --test src/lib/sabsms/analytics/__tests__/reconcile.test.ts
 *
 * Pure fold + diff, then `reconcileDay` end-to-end against a stub db
 * with canned raw arrays (in-memory pattern from journeys __tests__):
 * over-counted live rollups must be detected and REPLACED with the
 * recomputed truth, stale dim-combos removed, clean days untouched.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { dimsKey } from '../rollups';
import {
  diffDayStats,
  foldRawIntoDay,
  reconcileDay,
  type RawDayInput,
  type ReconcileDbLike,
} from '../reconcile';

const WS = 'ws1';
const DATE = '2026-06-10';
const IN_DAY = new Date(`${DATE}T10:00:00.000Z`);
const NEXT_DAY = new Date(`${DATE}T10:00:00.000Z`);
NEXT_DAY.setUTCDate(NEXT_DAY.getUTCDate() + 1);

function raw(partial: Partial<RawDayInput> = {}): RawDayInput {
  return { messages: [], clicks: [], optOuts: [], ...partial };
}

// ─── foldRawIntoDay ────────────────────────────────────────────────────────

describe('foldRawIntoDay — raw → expected rollups', () => {
  it('counts each lifecycle stamp on its own day', () => {
    const out = foldRawIntoDay(
      DATE,
      raw({
        messages: [
          {
            direction: 'outbound',
            provider: 'twilio',
            campaignId: 'c1',
            to: '+15550001111',
            segmentsCount: 2,
            cost: 0.0123,
            queuedAt: IN_DAY,
            sentAt: IN_DAY,
            deliveredAt: NEXT_DAY, // delivered tomorrow — NOT this day's counter
          },
        ],
      }),
    );
    const total = out.byKey.get('{}');
    assert.ok(total);
    assert.equal(total.counters.queued, 1);
    assert.equal(total.counters.sent, 1);
    assert.equal(total.counters.segments, 2);
    assert.equal(total.counters.delivered, 0);
    // Pricing enrichment: cost (currency units) → cents, credits > 0.
    assert.equal(total.counters.costCents, 1); // round(0.0123 * 100)
    assert.ok(total.counters.creditsSpent > 0);
    // Bounded fan-out: total + provider + campaign.
    assert.deepEqual(
      [...out.byKey.keys()].sort(),
      ['{"campaignId":"c1"}', '{"provider":"twilio"}', '{}'],
    );
  });

  it('counts inbound, clicks, and opt-outs', () => {
    const out = foldRawIntoDay(
      DATE,
      raw({
        messages: [{ direction: 'inbound', createdAt: IN_DAY }],
        clicks: [{ campaignId: 'c1', clickedAt: IN_DAY }, { clickedAt: NEXT_DAY }],
        optOuts: [
          { kind: 'opt_out_stop', createdAt: IN_DAY },
          { kind: 'opt_in', createdAt: IN_DAY }, // not an opt-out kind
        ],
      }),
    );
    const total = out.byKey.get('{}');
    assert.ok(total);
    assert.equal(total.counters.inbound, 1);
    assert.equal(total.counters.clicks, 1); // tomorrow's click excluded
    assert.equal(total.counters.optOuts, 1);
    assert.equal(out.byKey.get(dimsKey({ campaignId: 'c1' }))?.counters.clicks, 1);
  });

  it('rejects malformed date keys loudly', () => {
    assert.throws(() => foldRawIntoDay('garbage', raw()), /invalid date/);
  });
});

// ─── diffDayStats ──────────────────────────────────────────────────────────

describe('diffDayStats — drift detection', () => {
  it('reports no drift when stored matches expected', () => {
    const expected = foldRawIntoDay(
      DATE,
      raw({ messages: [{ direction: 'inbound', createdAt: IN_DAY }] }),
    );
    const drift = diffDayStats(expected, [
      { dimsKey: '{}', counters: { inbound: 1 } },
    ]);
    assert.deepEqual(drift, []);
  });

  it('flags over-counts (replayed $inc) and stale combos', () => {
    const expected = foldRawIntoDay(
      DATE,
      raw({ messages: [{ direction: 'inbound', createdAt: IN_DAY }] }),
    );
    const drift = diffDayStats(expected, [
      { dimsKey: '{}', counters: { inbound: 3 } }, // replays over-counted
      { dimsKey: '{"provider":"ghost"}', counters: { sent: 1 } }, // stale
    ]);
    assert.deepEqual(
      drift.map((d) => [d.dimsKey, d.field, d.expected, d.actual]).sort(),
      [
        ['{"provider":"ghost"}', 'sent', 0, 1],
        ['{}', 'inbound', 1, 3],
      ],
    );
  });
});

// ─── reconcileDay (stub db) ────────────────────────────────────────────────

interface StubState {
  messages: unknown[];
  clicks: unknown[];
  optOuts: unknown[];
  rollups: Array<Record<string, unknown>>;
  deletes: unknown[];
  upserts: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }>;
}

function stubReconcileDb(state: StubState): ReconcileDbLike {
  return {
    collection(name: string) {
      const rows =
        name === 'sabsms_messages'
          ? state.messages
          : name === 'sabsms_link_clicks'
            ? state.clicks
            : name === 'sabsms_consent_log'
              ? state.optOuts
              : state.rollups;
      return {
        find: () => ({ toArray: async () => rows }),
        deleteMany: async (filter: unknown) => {
          state.deletes.push(filter);
          return {};
        },
        updateOne: async (filter: unknown, update: unknown) => {
          state.upserts.push({
            filter: filter as Record<string, unknown>,
            update: update as Record<string, unknown>,
          });
          return {};
        },
      };
    },
  };
}

describe('reconcileDay', () => {
  it('no drift → reports clean and writes nothing', async () => {
    const state: StubState = {
      messages: [{ direction: 'inbound', createdAt: IN_DAY }],
      clicks: [],
      optOuts: [],
      rollups: [{ dimsKey: '{}', counters: { inbound: 1 } }],
      deletes: [],
      upserts: [],
    };
    const res = await reconcileDay(stubReconcileDb(state), WS, DATE);
    assert.equal(res.drift.length, 0);
    assert.equal(res.replaced, 0);
    assert.equal(res.removed, 0);
    assert.equal(state.upserts.length, 0);
    assert.equal(state.deletes.length, 0);
  });

  it('drift → replaces the day with the recomputed truth + drops stale combos', async () => {
    const state: StubState = {
      messages: [{ direction: 'inbound', createdAt: IN_DAY }],
      clicks: [],
      optOuts: [],
      rollups: [
        { dimsKey: '{}', counters: { inbound: 5 } }, // over-counted
        { dimsKey: '{"provider":"ghost"}', counters: { sent: 2 } }, // stale
      ],
      deletes: [],
      upserts: [],
    };
    const res = await reconcileDay(stubReconcileDb(state), WS, DATE);
    assert.ok(res.drift.length > 0);
    assert.equal(res.replaced, 1); // the `{}` combo rewritten
    assert.equal(res.removed, 1); // the ghost combo deleted
    assert.equal(state.deletes.length, 1);
    assert.equal(state.upserts.length, 1);
    const written = state.upserts[0];
    assert.equal(written.filter.dimsKey, '{}');
    const set = written.update.$set as Record<string, unknown>;
    assert.equal((set.counters as Record<string, number>).inbound, 1);
  });
});
