/**
 * V2.13 — outbound-webhook pure core tests (HMAC vector, backoff
 * schedule, event filtering, URL validation).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/webhooks-out-core.test.ts
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  buildEventBody,
  eventMatchesFilter,
  mintWebhookSecret,
  nextAttemptAt,
  PUBLIC_EVENT_NAMES,
  publicEventName,
  SIGNATURE_HEADER,
  signatureHeaders,
  signWebhookBody,
  SUBSCRIBABLE_EVENTS,
  TIMESTAMP_HEADER,
  validateWebhookUrl,
  WEBHOOK_BACKOFF_MS,
  WEBHOOK_MAX_ATTEMPTS,
} from '../webhooks-out/core';

describe('HMAC signature', () => {
  it('matches the hand-computed fixture vector', () => {
    const secret = 'whsec_test_fixture_secret';
    const body = buildEventBody({
      id: 'dlv_1',
      kind: 'message.delivered',
      payload: { messageId: 'm1' },
      at: 1780000000000,
    });
    assert.equal(
      body,
      '{"id":"dlv_1","kind":"message.delivered","payload":{"messageId":"m1"},"at":1780000000000}',
    );
    // Computed independently with `crypto.createHmac('sha256', secret)`.
    assert.equal(
      signWebhookBody(secret, body),
      'ce4114f46f6f3e6dc1b23381c648420457fe40f2fcfd176be1f18d18664009ac',
    );
  });

  it('signatureHeaders carries the hex signature + epoch-ms timestamp', () => {
    const headers = signatureHeaders('s', '{}', 1780000000000);
    assert.match(headers[SIGNATURE_HEADER], /^[0-9a-f]{64}$/);
    assert.equal(headers[TIMESTAMP_HEADER], '1780000000000');
  });

  it('different secrets produce different signatures over the same body', () => {
    assert.notEqual(signWebhookBody('a', '{}'), signWebhookBody('b', '{}'));
  });
});

describe('backoff schedule', () => {
  const t0 = new Date('2026-06-12T00:00:00.000Z');

  it('is exactly [30s, 5m, 1h, 6h]', () => {
    assert.deepEqual([...WEBHOOK_BACKOFF_MS], [30_000, 300_000, 3_600_000, 21_600_000]);
    assert.equal(WEBHOOK_MAX_ATTEMPTS, 5);
  });

  it('maps attempt counts to the right wake times', () => {
    assert.equal(nextAttemptAt(1, t0)?.toISOString(), '2026-06-12T00:00:30.000Z');
    assert.equal(nextAttemptAt(2, t0)?.toISOString(), '2026-06-12T00:05:00.000Z');
    assert.equal(nextAttemptAt(3, t0)?.toISOString(), '2026-06-12T01:00:00.000Z');
    assert.equal(nextAttemptAt(4, t0)?.toISOString(), '2026-06-12T06:00:00.000Z');
  });

  it('goes terminal after the 5th attempt', () => {
    assert.equal(nextAttemptAt(5, t0), null);
    assert.equal(nextAttemptAt(99, t0), null);
  });
});

describe('event naming + filtering', () => {
  it('maps engine kinds to dotted public names', () => {
    assert.equal(publicEventName('messageDelivered'), 'message.delivered');
    assert.equal(publicEventName('contactUnsubscribed'), 'contact.unsubscribed');
    assert.equal(publicEventName('linkClicked'), 'link.clicked');
    assert.equal(publicEventName('somethingNew'), null);
  });

  it('subscribable list excludes ping but ping always matches filters', () => {
    assert.ok(!SUBSCRIBABLE_EVENTS.includes('ping'));
    assert.ok(SUBSCRIBABLE_EVENTS.includes('message.delivered'));
    assert.equal(eventMatchesFilter('ping', ['message.failed']), true);
  });

  it('empty filter = everything; non-empty filter is exact', () => {
    assert.equal(eventMatchesFilter('message.delivered', []), true);
    assert.equal(eventMatchesFilter('message.delivered', undefined), true);
    assert.equal(eventMatchesFilter('message.delivered', ['message.delivered']), true);
    assert.equal(eventMatchesFilter('message.failed', ['message.delivered']), false);
  });

  it('every engine kind in the map has a dotted name', () => {
    for (const [kind, name] of Object.entries(PUBLIC_EVENT_NAMES)) {
      assert.ok(name.length > 0, `${kind} maps to an empty name`);
    }
  });
});

describe('validateWebhookUrl', () => {
  it('requires https on a public host', () => {
    assert.equal(validateWebhookUrl('https://api.example.com/hooks').ok, true);
    assert.equal(validateWebhookUrl('http://api.example.com/hooks').ok, false);
    assert.equal(validateWebhookUrl('https://localhost/hooks').ok, false);
    assert.equal(validateWebhookUrl('not a url').ok, false);
  });
});

describe('mintWebhookSecret', () => {
  it('mints whsec_ + 32 base62', () => {
    const s = mintWebhookSecret();
    assert.match(s, /^whsec_[A-Za-z0-9]{32}$/);
  });
});
