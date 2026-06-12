/**
 * SabSMS identity graph + smart send — pure-math tests (V2.10).
 *
 *   npx tsx --test src/lib/sabsms/identity/__tests__/smart-send.test.ts
 *
 * Covers the histogram statistics (`bestSendHourUtc`, `smartSendDelayMs`,
 * `medianBestHourUtc`, `nextOccurrenceUtcMs`) plus the `touchIdentity`
 * event application against a recorded stub db (in-memory pattern from
 * journeys __tests__).
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { SabsmsEngineEvent } from '../../events/consumer';
import {
  e164Last4,
  emptyHistogram,
  phoneHashFor,
  touchIdentity,
  utcHourOf,
  SABSMS_IDENTITIES_COLLECTION,
  type IdentityDbLike,
} from '../graph';
import {
  bestSendHourUtc,
  medianBestHourUtc,
  nextOccurrenceUtcMs,
  smartSendDelayMs,
  MIN_HISTOGRAM_SIGNAL,
} from '../smart-send';

const WS = 'ws1';
const PHONE = '+15550002222';

function histo(buckets: Record<number, number>): { sendTimeHistogram: number[] } {
  const h = emptyHistogram();
  for (const [hour, v] of Object.entries(buckets)) h[Number(hour)] = v;
  return { sendTimeHistogram: h };
}

// ─── bestSendHourUtc ───────────────────────────────────────────────────────

describe('bestSendHourUtc — argmax with a signal floor', () => {
  it('returns the argmax hour once signal clears the bar', () => {
    assert.equal(bestSendHourUtc(histo({ 9: 2, 14: 4, 20: 1 })), 14); // total 7 ≥ 5
  });

  it(`returns null below ${MIN_HISTOGRAM_SIGNAL} total signal`, () => {
    assert.equal(bestSendHourUtc(histo({ 14: 4 })), null); // total 4 < 5
    assert.equal(bestSendHourUtc(histo({})), null);
    assert.equal(bestSendHourUtc(null), null);
    assert.equal(bestSendHourUtc(undefined), null);
  });

  it('resolves ties to the earliest hour (deterministic)', () => {
    assert.equal(bestSendHourUtc(histo({ 8: 3, 18: 3 })), 8);
  });

  it('rejects malformed histograms and clamps negatives', () => {
    assert.equal(bestSendHourUtc({ sendTimeHistogram: [1, 2, 3] }), null); // wrong length
    // Negative buckets count as 0 → total below floor.
    assert.equal(bestSendHourUtc(histo({ 3: -10, 5: 4 })), null);
  });
});

// ─── nextOccurrenceUtcMs + smartSendDelayMs ────────────────────────────────

describe('smartSendDelayMs — delay math', () => {
  const noonUtc = new Date('2026-06-10T12:00:00.000Z');

  it('next occurrence is later today when the hour is ahead', () => {
    const at = nextOccurrenceUtcMs(15, noonUtc);
    assert.equal(new Date(at).toISOString(), '2026-06-10T15:00:00.000Z');
  });

  it('next occurrence rolls to tomorrow when the hour has passed', () => {
    const at = nextOccurrenceUtcMs(9, noonUtc);
    assert.equal(new Date(at).toISOString(), '2026-06-11T09:00:00.000Z');
  });

  it('zero delay without trustworthy signal', () => {
    assert.equal(smartSendDelayMs(histo({ 20: 4 }), noonUtc), 0);
    assert.equal(smartSendDelayMs(null, noonUtc), 0);
  });

  it('zero delay when now is within ±1h of the best hour', () => {
    assert.equal(smartSendDelayMs(histo({ 12: 6 }), noonUtc), 0);
    assert.equal(smartSendDelayMs(histo({ 11: 6 }), noonUtc), 0);
    assert.equal(smartSendDelayMs(histo({ 13: 6 }), noonUtc), 0);
  });

  it('delays to the next top-of-best-hour otherwise', () => {
    // Best hour 20 UTC, now 12 UTC → 8h.
    assert.equal(smartSendDelayMs(histo({ 20: 6 }), noonUtc), 8 * 60 * 60 * 1000);
    // Best hour 9 UTC (passed) → tomorrow 09:00 = 21h.
    assert.equal(smartSendDelayMs(histo({ 9: 6 }), noonUtc), 21 * 60 * 60 * 1000);
  });

  it('tolerance is circular across midnight', () => {
    const lateNight = new Date('2026-06-10T23:30:00.000Z');
    // Best hour 0 and now 23 → circular distance 1 → send now.
    assert.equal(smartSendDelayMs(histo({ 0: 6 }), lateNight), 0);
  });
});

describe('medianBestHourUtc — workspace median', () => {
  it('takes the median over identities with signal only', () => {
    assert.equal(
      medianBestHourUtc([
        histo({ 9: 6 }),
        histo({ 14: 6 }),
        histo({ 20: 6 }),
        histo({ 3: 2 }), // below floor — ignored
        null,
      ]),
      14,
    );
  });

  it('even count takes the lower-middle (stable)', () => {
    assert.equal(medianBestHourUtc([histo({ 9: 6 }), histo({ 20: 6 })]), 9);
  });

  it('null when no identity clears the bar', () => {
    assert.equal(medianBestHourUtc([histo({ 9: 1 }), null, undefined]), null);
  });
});

// ─── phone hashing conventions ─────────────────────────────────────────────

describe('phoneHashFor — shared suppression-list convention', () => {
  it('sha256 lowercase hex of trimmed, lowercased E.164', () => {
    const h = phoneHashFor(PHONE);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(phoneHashFor(`  ${PHONE}  `), h);
  });

  it('e164Last4 strips formatting', () => {
    assert.equal(e164Last4('+1 (555) 000-2222'), '2222');
  });

  it('utcHourOf buckets on the UTC hour', () => {
    assert.equal(utcHourOf(Date.UTC(2026, 5, 10, 14, 59)), 14);
  });
});

// ─── touchIdentity (stub db) ───────────────────────────────────────────────

interface RecordedOp {
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
}

function stubIdentityDb(messageDoc: Record<string, unknown> | null = null) {
  const ops: RecordedOp[] = [];
  const db: IdentityDbLike = {
    collection(name: string) {
      return {
        async updateOne(filter: unknown, update: unknown) {
          ops.push({
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
  return { db, ops };
}

const AT = Date.UTC(2026, 5, 10, 14, 30);
const MSG_ID = '0123456789abcdef01234567';

function event(kind: string, payload: Record<string, unknown> = {}): SabsmsEngineEvent {
  return { kind, payload: { workspaceId: WS, ...payload }, at: AT };
}

describe('touchIdentity — event application', () => {
  it('messageInbound bumps inbound30d + the UTC-hour histogram bucket', async () => {
    const { db, ops } = stubIdentityDb();
    const res = await touchIdentity(db, event('messageInbound', { from: PHONE }));
    assert.equal(res.touched, true);
    // Two-step upsert: base doc first, then the touch.
    const identityOps = ops.filter((o) => o.collection === SABSMS_IDENTITIES_COLLECTION);
    assert.equal(identityOps.length, 2);
    assert.equal(identityOps[0].filter.phoneHash, phoneHashFor(PHONE));
    const touch = identityOps[1].update;
    assert.deepEqual(touch.$inc, {
      'engagement.inbound30d': 1,
      'sendTimeHistogram.14': 1, // 14:30 UTC
    });
  });

  it('linkClicked resolves the phone via the message doc when absent', async () => {
    const { db, ops } = stubIdentityDb({ to: PHONE, contactId: 'ct1' });
    const res = await touchIdentity(db, event('linkClicked', { messageId: MSG_ID }));
    assert.equal(res.touched, true);
    const touch = ops.filter((o) => o.collection === SABSMS_IDENTITIES_COLLECTION)[1];
    assert.equal(touch.filter.phoneHash, phoneHashFor(PHONE));
    assert.deepEqual(touch.update.$addToSet, { contactIds: 'ct1' });
    assert.deepEqual(touch.update.$inc, {
      'engagement.clicks30d': 1,
      'sendTimeHistogram.14': 1,
    });
  });

  it('messageDelivered bumps delivered30d but NOT the histogram', async () => {
    const { db, ops } = stubIdentityDb({ to: PHONE });
    const res = await touchIdentity(db, event('messageDelivered', { messageId: MSG_ID }));
    assert.equal(res.touched, true);
    const touch = ops.filter((o) => o.collection === SABSMS_IDENTITIES_COLLECTION)[1];
    assert.deepEqual(touch.update.$inc, { 'engagement.delivered30d': 1 });
  });

  it('contactUnsubscribed flips consent to opted_out via the payload hash', async () => {
    const { db, ops } = stubIdentityDb();
    const hash = phoneHashFor(PHONE);
    const res = await touchIdentity(db, event('contactUnsubscribed', { phoneHash: hash }));
    assert.equal(res.touched, true);
    const touch = ops.filter((o) => o.collection === SABSMS_IDENTITIES_COLLECTION)[1];
    assert.equal(touch.filter.phoneHash, hash);
    const set = touch.update.$set as Record<string, { state?: string }>;
    assert.equal(set.consent.state, 'opted_out');
  });

  it('unresolvable / irrelevant events are graceful no-ops', async () => {
    const { db, ops } = stubIdentityDb(null);
    assert.equal((await touchIdentity(db, event('messageInbound', {}))).touched, false);
    assert.equal(
      (await touchIdentity(db, event('messageDelivered', { messageId: MSG_ID }))).touched,
      false, // message lookup misses
    );
    assert.equal((await touchIdentity(db, event('otpSent'))).touched, false);
    assert.equal((await touchIdentity(db, event('routeFailover'))).touched, false);
    // Only message-lookup findOnes happened; no identity writes.
    assert.equal(ops.filter((o) => o.collection === SABSMS_IDENTITIES_COLLECTION).length, 0);
  });
});
