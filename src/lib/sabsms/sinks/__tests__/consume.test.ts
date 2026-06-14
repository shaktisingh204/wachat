/**
 * Unit tests for v3.7 sink consumption — envelope → match → fan out →
 * persist delivery rows. All IO injected.
 *
 *   npx tsx --test src/lib/sabsms/sinks/__tests__/consume.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { deliverEventToSinks } from '../consume';
import type { EventEnvelope } from '../sinks-core';
import type { SinkDeliveryResult } from '../dispatch';
import type { SabsmsEventSink, SabsmsSinkDelivery } from '../../types';

function sink(partial: Partial<SabsmsEventSink>): SabsmsEventSink {
  return {
    workspaceId: 'ws_1',
    kind: 'webhook',
    events: [],
    enabled: true,
    config: { url: 'https://x.test/h' },
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  };
}

const RAW = {
  id: 'evt_1',
  kind: 'message.delivered',
  workspaceId: 'ws_1',
  at: 1_700_000_000_000,
  payload: { messageId: 'm_1' },
};

test('no matching sinks → nothing delivered or persisted', async () => {
  const persisted: SabsmsSinkDelivery[] = [];
  const res = await deliverEventToSinks(RAW, {
    loadSinks: async () => [],
    persistDelivery: async (r) => void persisted.push(r),
  });
  assert.deepEqual(res, { matched: 0, delivered: 0, failed: 0 });
  assert.equal(persisted.length, 0);
});

test('fans out to matching sinks and persists one row each', async () => {
  const persisted: SabsmsSinkDelivery[] = [];
  const sinks = [sink({ events: [] }), sink({ events: ['message.delivered'] })];
  const res = await deliverEventToSinks(RAW, {
    loadSinks: async () => sinks,
    fanOut: async (_env: EventEnvelope, matched): Promise<SinkDeliveryResult[]> =>
      matched.map(() => ({ kind: 'webhook', ok: true, retryable: false, nextRetryAt: null })),
    persistDelivery: async (r) => void persisted.push(r),
  });
  assert.deepEqual(res, { matched: 2, delivered: 2, failed: 0 });
  assert.equal(persisted.length, 2);
  assert.equal(persisted[0].status, 'delivered');
  assert.equal(persisted[0].eventType, 'message.delivered');
});

test('a retryable failure persists as pending with a retry time', async () => {
  const persisted: SabsmsSinkDelivery[] = [];
  const retryAt = new Date('2026-06-14T12:00:30.000Z');
  const res = await deliverEventToSinks(RAW, {
    loadSinks: async () => [sink({})],
    fanOut: async (): Promise<SinkDeliveryResult[]> => [
      { kind: 'webhook', ok: false, retryable: true, error: 'http 503', nextRetryAt: retryAt },
    ],
    persistDelivery: async (r) => void persisted.push(r),
  });
  assert.deepEqual(res, { matched: 1, delivered: 0, failed: 1 });
  assert.equal(persisted[0].status, 'pending');
  assert.equal(persisted[0].nextRetryAt?.getTime(), retryAt.getTime());
  assert.equal(persisted[0].lastError, 'http 503');
});

test('a terminal failure persists as failed', async () => {
  const persisted: SabsmsSinkDelivery[] = [];
  const res = await deliverEventToSinks(RAW, {
    loadSinks: async () => [sink({})],
    fanOut: async (): Promise<SinkDeliveryResult[]> => [
      { kind: 'webhook', ok: false, retryable: false, error: 'http 400', nextRetryAt: null },
    ],
    persistDelivery: async (r) => void persisted.push(r),
  });
  assert.deepEqual(res, { matched: 1, delivered: 0, failed: 1 });
  assert.equal(persisted[0].status, 'failed');
});
