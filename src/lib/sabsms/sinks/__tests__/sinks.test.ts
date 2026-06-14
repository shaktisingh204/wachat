/**
 * Unit tests for v3.7 Event Streams + Sinks — envelope building, sink
 * matching, and delivery routing/retry classification (injected transport).
 *
 *   npx tsx --test src/lib/sabsms/sinks/__tests__/sinks.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  EVENT_SCHEMA_VERSION,
  buildEventEnvelope,
  isHttpSink,
  matchingSinks,
  type EventEnvelope,
} from '../sinks-core';
import { deliverToSink, fanOut } from '../dispatch';
import type { SabsmsEventSink } from '../../types';

function sink(partial: Partial<SabsmsEventSink>): SabsmsEventSink {
  return {
    workspaceId: 'ws_1',
    kind: 'webhook',
    events: [],
    enabled: true,
    secret: 'shh',
    config: { url: 'https://example.test/hook' },
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  };
}

const ENV: EventEnvelope = {
  v: EVENT_SCHEMA_VERSION,
  id: 'evt_1',
  type: 'message.delivered',
  workspaceId: 'ws_1',
  at: 1_700_000_000_000,
  payload: { messageId: 'm_1' },
};
const NOW = new Date('2026-06-14T12:00:00.000Z');

// ─── core ────────────────────────────────────────────────────────────────

test('buildEventEnvelope stamps the schema version and copies fields', () => {
  const env = buildEventEnvelope({
    id: 'evt_2',
    kind: 'some.custom.event',
    workspaceId: 'ws_9',
    at: 123,
    payload: { a: 1 },
  });
  assert.equal(env.v, EVENT_SCHEMA_VERSION);
  assert.equal(env.id, 'evt_2');
  assert.equal(env.type, 'some.custom.event'); // unknown kind passes through
  assert.equal(env.workspaceId, 'ws_9');
  assert.deepEqual(env.payload, { a: 1 });
});

test('matchingSinks honors enabled, workspace, and event filter', () => {
  const sinks = [
    sink({ events: [] }), // all events
    sink({ events: ['message.delivered'] }), // subscribed
    sink({ events: ['message.failed'] }), // not subscribed
    sink({ enabled: false }), // disabled
    sink({ workspaceId: 'other' }), // other workspace
  ];
  const matched = matchingSinks(ENV, sinks);
  assert.equal(matched.length, 2);
});

test('isHttpSink classifies kinds', () => {
  assert.equal(isHttpSink('webhook'), true);
  assert.equal(isHttpSink('http_batch'), true);
  assert.equal(isHttpSink('segment'), true);
  assert.equal(isHttpSink('kafka'), false);
  assert.equal(isHttpSink('kinesis'), false);
});

// ─── HTTP delivery ───────────────────────────────────────────────────────

test('HTTP 2xx succeeds and signs the body', async () => {
  let seenHeaders: Record<string, string> = {};
  const res = await deliverToSink(sink({}), ENV, 0, {
    now: () => NOW,
    httpPost: async (_url, headers) => {
      seenHeaders = headers;
      return { status: 200 };
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.retryable, false);
  assert.equal(res.nextRetryAt, null);
  assert.ok(seenHeaders['X-Sabsms-Signature'], 'a signed sink must send a signature header');
});

test('HTTP 500 is retryable and schedules the first backoff (30s)', async () => {
  const res = await deliverToSink(sink({}), ENV, 0, {
    now: () => NOW,
    httpPost: async () => ({ status: 503 }),
  });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, true);
  assert.equal(res.nextRetryAt?.getTime(), NOW.getTime() + 30_000);
});

test('HTTP 4xx is terminal (customer misconfig)', async () => {
  const res = await deliverToSink(sink({}), ENV, 0, {
    now: () => NOW,
    httpPost: async () => ({ status: 400 }),
  });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, false);
  assert.equal(res.nextRetryAt, null);
});

test('a network throw is retryable', async () => {
  const res = await deliverToSink(sink({}), ENV, 0, {
    now: () => NOW,
    httpPost: async () => {
      throw new Error('ECONNRESET');
    },
  });
  assert.equal(res.retryable, true);
  assert.equal(res.error, 'ECONNRESET');
});

// ─── streaming delivery ──────────────────────────────────────────────────

test('a kafka sink with no transport is not_configured (terminal)', async () => {
  const res = await deliverToSink(sink({ kind: 'kafka', config: {} }), ENV, 0, { now: () => NOW });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, false);
  assert.match(res.error ?? '', /no transport/);
});

test('a kafka sink with an injected transport delivers', async () => {
  const res = await deliverToSink(sink({ kind: 'kafka', config: { topic: 't' } }), ENV, 0, {
    now: () => NOW,
    transports: { kafka: { publish: async () => ({ ok: true }) } },
  });
  assert.equal(res.ok, true);
});

test('fanOut delivers to every matching sink', async () => {
  const results = await fanOut(
    ENV,
    [sink({}), sink({ kind: 'kafka', config: {} })],
    {
      now: () => NOW,
      httpPost: async () => ({ status: 200 }),
      transports: { kafka: { publish: async () => ({ ok: true }) } },
    },
  );
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.ok));
});
