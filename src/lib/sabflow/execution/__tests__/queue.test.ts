/**
 * ExecutionQueue contract tests — covers the in-memory backend + the
 * factory's selection rule. BullMQ tests live separately (require Redis).
 *
 *   npx tsx --test src/lib/sabflow/execution/__tests__/queue.test.ts
 */
import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';

import {
  getExecutionQueue,
  _resetExecutionQueueForTests,
} from '../queue';

beforeEach(() => {
  _resetExecutionQueueForTests();
  delete process.env.SABFLOW_QUEUE_REDIS_URL;
});

test('factory returns in-memory backend by default', () => {
  const q = getExecutionQueue();
  assert.equal(q.backend, 'in-memory');
});

test('factory caches the singleton across calls', () => {
  const a = getExecutionQueue();
  const b = getExecutionQueue();
  assert.equal(a, b);
});

test('enqueue runs the registered handler with the payload', async () => {
  const q = getExecutionQueue();
  let received: unknown;
  q.registerHandler(async (payload) => {
    received = payload;
  });
  const jobId = await q.enqueue({
    flowId: 'f1',
    session: {
      flowId: 'f1',
      currentGroupId: 'g0',
      currentBlockIndex: 0,
      variables: {},
      history: [],
    },
  });
  assert.ok(jobId.startsWith('mem_'));
  assert.ok(received);
  assert.equal((received as { flowId: string }).flowId, 'f1');
});

test('enqueue without a handler throws a clear error', async () => {
  const q = getExecutionQueue();
  await assert.rejects(
    q.enqueue({
      flowId: 'f1',
      session: {
        flowId: 'f1',
        currentGroupId: 'g0',
        currentBlockIndex: 0,
        variables: {},
        history: [],
      },
    }),
    /no handler registered/,
  );
});

test('registerHandler twice throws (catches accidental double-init)', () => {
  const q = getExecutionQueue();
  q.registerHandler(async () => {});
  assert.throws(() => q.registerHandler(async () => {}), /already registered/);
});

test('handler errors propagate to the caller (in-memory awaits inline)', async () => {
  const q = getExecutionQueue();
  q.registerHandler(async () => {
    throw new Error('boom');
  });
  await assert.rejects(
    q.enqueue({
      flowId: 'f1',
      session: {
        flowId: 'f1',
        currentGroupId: 'g0',
        currentBlockIndex: 0,
        variables: {},
        history: [],
      },
    }),
    /boom/,
  );
});

test('payload carries executionId for trace correlation', async () => {
  const q = getExecutionQueue();
  let captured: unknown;
  q.registerHandler(async (p) => {
    captured = p;
  });
  await q.enqueue({
    flowId: 'f1',
    executionId: 'exec_42',
    session: {
      flowId: 'f1',
      currentGroupId: 'g0',
      currentBlockIndex: 0,
      variables: {},
      history: [],
    },
  });
  assert.equal((captured as { executionId: string }).executionId, 'exec_42');
});
