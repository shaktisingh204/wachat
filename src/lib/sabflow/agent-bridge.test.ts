/**
 * Unit tests for the SabFlow → Agent bridge.
 *
 * Run with Node's built-in `node:test` + `tsx`:
 *
 *   npx tsx --test src/lib/sabflow/agent-bridge.test.ts
 *
 * The tests inject a fake `agentRunner` and `persistTranscript` so they don't
 * touch Mongo or the real `@/lib/agents` module.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  pickBranchLabel,
  resolveAgentInput,
  runAgentInFlow,
  type AgentRunSummary,
  type AgentRunner,
  type PersistedTranscript,
  type TranscriptPersister,
} from './agent-bridge';

/* ── Fixtures ────────────────────────────────────────────────────────────── */

function makeRunner(overrides: Partial<AgentRunSummary> = {}): {
  runner: AgentRunner;
  calls: Array<{ agentId: string; input: string; options: unknown }>;
} {
  const calls: Array<{ agentId: string; input: string; options: unknown }> = [];
  const runner: AgentRunner = async (agentId, input, options) => {
    calls.push({ agentId, input, options });
    return {
      runId: 'run-1',
      agentId,
      startedAt: 1,
      finishedAt: 2,
      input,
      output: 'agent answer',
      transcript: [
        { role: 'system', content: 'sys', ts: 1 },
        { role: 'user', content: input, ts: 1 },
        { role: 'model', content: 'agent answer', ts: 2 },
      ],
      toolCalls: 0,
      turns: 1,
      costCents: 3,
      ...overrides,
    };
  };
  return { runner, calls };
}

function makePersister(): {
  persist: TranscriptPersister;
  records: PersistedTranscript[];
} {
  const records: PersistedTranscript[] = [];
  const persist: TranscriptPersister = async (rec) => {
    records.push(rec);
  };
  return { persist, records };
}

/* ── resolveAgentInput ───────────────────────────────────────────────────── */

test('resolveAgentInput substitutes {{var}} tokens against the variable map', () => {
  const out = resolveAgentInput(
    'Hello {{name}}, your code is {{code}}.',
    { name: 'Alex', code: '42' },
  );
  assert.equal(out, 'Hello Alex, your code is 42.');
});

test('resolveAgentInput returns "" when template is empty', () => {
  assert.equal(resolveAgentInput(undefined, {}), '');
  assert.equal(resolveAgentInput('', { x: 'y' }), '');
});

/* ── pickBranchLabel ─────────────────────────────────────────────────────── */

test('pickBranchLabel returns the exact-match label when the agent answers cleanly', () => {
  assert.equal(pickBranchLabel('billing', ['support', 'billing', 'sales']), 'billing');
  assert.equal(pickBranchLabel('  Billing\n', ['support', 'billing']), 'billing');
});

test('pickBranchLabel falls back to substring match (longest first)', () => {
  assert.equal(
    pickBranchLabel('Looks like a high-priority ticket.', ['high', 'high-priority', 'low']),
    'high-priority',
  );
});

test('pickBranchLabel returns undefined when no label matches', () => {
  assert.equal(pickBranchLabel('hmm', ['a', 'b']), undefined);
  assert.equal(pickBranchLabel('', ['a']), undefined);
});

/* ── runAgentInFlow happy path ───────────────────────────────────────────── */

test('runAgentInFlow resolves input, calls the runner, persists, and returns output', async () => {
  const { runner, calls } = makeRunner();
  const { persist, records } = makePersister();

  const result = await runAgentInFlow(
    {
      agentId: 'sales-sdr',
      inputTemplate: 'Reach out to {{name}}',
      outputVariable: 'agent_reply',
      timeoutMs: 5000,
      maxCostCents: 100,
    },
    {
      variables: { name: 'Jamie' },
      tenantId: 't1',
      userId: 'u1',
      agentRunner: runner,
      persistTranscript: persist,
      flowId: 'flow-1',
      runId: 'flowrun-1',
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].agentId, 'sales-sdr');
  assert.equal(calls[0].input, 'Reach out to Jamie');
  assert.deepEqual((calls[0].options as { tenantId?: string }).tenantId, 't1');

  assert.equal(result.output, 'agent answer');
  assert.equal(result.cost, 3);
  assert.equal(result.error, undefined);
  assert.equal(result.transcript.length, 3);

  assert.equal(records.length, 1);
  assert.equal(records[0].flowId, 'flow-1');
  assert.equal(records[0].agentRunId, 'run-1');
});

/* ── runAgentInFlow error / cost-cap behaviour ───────────────────────────── */

test('runAgentInFlow flags an error when reported cost exceeds maxCostCents', async () => {
  const { runner } = makeRunner({ costCents: 200 });
  const { persist, records } = makePersister();

  const result = await runAgentInFlow(
    {
      agentId: 'sales-sdr',
      inputTemplate: 'do something',
      maxCostCents: 50,
    },
    {
      variables: {},
      agentRunner: runner,
      persistTranscript: persist,
    },
  );

  assert.equal(result.cost, 200);
  assert.match(result.error ?? '', /exceeded max 50/);
  // Persistence still runs even on cost-cap errors.
  assert.equal(records.length, 1);
  assert.match(records[0].error ?? '', /exceeded/);
});

test('runAgentInFlow throws when agentId is missing', async () => {
  await assert.rejects(
    () =>
      runAgentInFlow(
        { inputTemplate: 'hi' },
        { variables: {}, agentRunner: makeRunner().runner },
      ),
    /agentId is required/,
  );
});

/* ── Branch mode ─────────────────────────────────────────────────────────── */

test('runAgentInFlow returns the picked branch label in branchMode', async () => {
  const { runner } = makeRunner({ output: 'sales' });
  const { persist } = makePersister();

  const result = await runAgentInFlow(
    {
      agentId: 'classifier',
      inputTemplate: 'classify this',
      branchMode: true,
      branchLabels: ['support', 'billing', 'sales'],
    },
    { variables: {}, agentRunner: runner, persistTranscript: persist },
  );

  assert.equal(result.branchLabel, 'sales');
  assert.equal(result.output, 'sales');
});

test('runAgentInFlow captures runner exceptions instead of throwing', async () => {
  const failingRunner: AgentRunner = async () => {
    throw new Error('boom');
  };
  const { persist, records } = makePersister();

  const result = await runAgentInFlow(
    { agentId: 'sales-sdr', inputTemplate: 'hi' },
    { variables: {}, agentRunner: failingRunner, persistTranscript: persist },
  );

  assert.equal(result.output, '');
  assert.equal(result.error, 'boom');
  assert.equal(records.length, 1);
});
