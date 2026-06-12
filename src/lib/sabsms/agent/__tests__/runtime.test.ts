/**
 * SabSMS V2.12 — agent runtime unit tests (mock LLM + memory store).
 *
 *   NODE_PATH=./src/workers/_stubs npx tsx --test \
 *     src/lib/sabsms/agent/__tests__/runtime.test.ts
 *
 * Covers: disabled/turn-count/handoff/suppression guards, credit
 * metering fail-closed, suggest-vs-auto routing, the bounded tool loop,
 * audit rows for every turn, and replay tolerance.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { matchesHandoffKeyword, runAgentTurn } from '../runtime';
import { createMemoryAgentStore, type MemoryAgentStoreSeed } from '../store';
import { searchKnowledge, chunkKnowledge } from '../tools';
import type { SabsmsLlmClient } from '../llm';
import type { EnqueueSendInput } from '../../types';

const WS = 'ws1';
const CONV = 'conv1';
const PHONE = '+15550001111';
const IN_MSG = 'in-1';

function seed(overrides: Partial<MemoryAgentStoreSeed> = {}): MemoryAgentStoreSeed {
  return {
    config: {
      workspaceId: WS,
      enabled: true,
      mode: 'auto',
      persona: 'You are the Acme assistant.',
      knowledge: 'Acme opens 9am-5pm Mon-Fri.\n\nReturns accepted within 30 days.',
    },
    conversations: [
      { id: CONV, workspaceId: WS, contactId: PHONE, status: 'open' },
    ],
    messages: [
      {
        id: IN_MSG,
        workspaceId: WS,
        conversationId: CONV,
        direction: 'inbound',
        body: 'what are your hours?',
        from: PHONE,
        to: '+15559990000',
      },
    ],
    credits: { [WS]: 10 },
    ...overrides,
  };
}

const replyLlm =
  (body: string): SabsmsLlmClient =>
  async () => ({ ok: true, text: JSON.stringify({ action: 'reply', body }) });

function captureEnqueue(sent: EnqueueSendInput[]) {
  return async (input: EnqueueSendInput) => {
    sent.push(input);
    return { id: 'reply-1', status: 'queued' as const };
  };
}

const params = {
  workspaceId: WS,
  conversationId: CONV,
  inboundMessageId: IN_MSG,
  inboundBody: 'what are your hours?',
  contactPhone: PHONE,
};

describe('matchesHandoffKeyword', () => {
  it('matches whole words case-insensitively', () => {
    assert.equal(matchesHandoffKeyword('I want a HUMAN now', ['human']), true);
    assert.equal(matchesHandoffKeyword('talk to an agent?', ['agent']), true);
    // Substrings must not match.
    assert.equal(matchesHandoffKeyword('urgently', ['agent']), false);
    assert.equal(matchesHandoffKeyword('humanity is great', ['human']), false);
  });
});

describe('knowledge search', () => {
  it('chunks on blank lines and ranks by term overlap', () => {
    const kb = 'Acme opens 9am-5pm.\n\nReturns accepted within 30 days.';
    assert.equal(chunkKnowledge(kb).length, 2);
    const hits = searchKnowledge(kb, 'how do returns work?');
    assert.ok(hits.length >= 1);
    assert.ok(hits[0].chunk.includes('Returns'));
  });
});

describe('runAgentTurn guards', () => {
  it('disabled workspace → skipped, no audit row, no LLM', async () => {
    const store = createMemoryAgentStore(
      seed({ config: { workspaceId: WS, enabled: false } }),
    );
    let llmCalls = 0;
    const res = await runAgentTurn(
      {
        store,
        llm: async () => {
          llmCalls += 1;
          return { ok: true, text: '' };
        },
      },
      params,
    );
    assert.equal(res.outcome, 'skipped');
    assert.equal(store.state.turns.length, 0);
    assert.equal(llmCalls, 0);
  });

  it('guardrail-consumed inbound → guarded, audited', async () => {
    const s = seed();
    s.conversations![0].aiFlags = { guardedInboundId: IN_MSG };
    const store = createMemoryAgentStore(s);
    const res = await runAgentTurn({ store, llm: replyLlm('x') }, params);
    assert.equal(res.outcome, 'guarded');
    assert.equal(res.reason, 'optout_guardrail');
    assert.equal(store.state.turns.length, 1);
    assert.equal(store.state.turns[0].outcome, 'guarded');
  });

  it('handed-off conversation → guarded', async () => {
    const s = seed();
    s.conversations![0].aiFlags = { handoff: true };
    const store = createMemoryAgentStore(s);
    const res = await runAgentTurn({ store, llm: replyLlm('x') }, params);
    assert.equal(res.outcome, 'guarded');
    assert.equal(res.reason, 'handed_off');
  });

  it('suppressed sender → guarded', async () => {
    const store = createMemoryAgentStore(
      seed({ suppressedPhones: [{ workspaceId: WS, phone: PHONE }] }),
    );
    const res = await runAgentTurn({ store, llm: replyLlm('x') }, params);
    assert.equal(res.outcome, 'guarded');
    assert.equal(res.reason, 'suppressed');
  });

  it('max turns reached → guarded', async () => {
    const store = createMemoryAgentStore(seed());
    for (let i = 0; i < 6; i++) {
      store.state.turns.push({
        turnId: `t${i}`,
        workspaceId: WS,
        conversationId: CONV,
        inboundMessageId: `old-${i}`,
        toolCalls: [],
        mode: 'auto',
        outcome: 'replied',
        at: new Date(),
      });
    }
    const res = await runAgentTurn({ store, llm: replyLlm('x') }, params);
    assert.equal(res.outcome, 'guarded');
    assert.equal(res.reason, 'max_turns');
  });

  it('handoff keyword → handoff without an LLM call', async () => {
    const store = createMemoryAgentStore(seed());
    let llmCalls = 0;
    const res = await runAgentTurn(
      {
        store,
        llm: async () => {
          llmCalls += 1;
          return { ok: true, text: '' };
        },
      },
      { ...params, inboundBody: 'let me talk to a representative please' },
    );
    assert.equal(res.outcome, 'handoff');
    assert.equal(llmCalls, 0);
    const conv = store.state.conversations.get(CONV);
    assert.equal(conv?.aiFlags?.handoff, true);
    assert.equal(store.state.turns[0].outcome, 'handoff');
  });

  it('replay: duplicate inbound is skipped before any work', async () => {
    const store = createMemoryAgentStore(seed());
    const sent: EnqueueSendInput[] = [];
    await runAgentTurn(
      { store, llm: replyLlm('We open 9-5.'), enqueue: captureEnqueue(sent) },
      params,
    );
    const second = await runAgentTurn(
      { store, llm: replyLlm('We open 9-5.'), enqueue: captureEnqueue(sent) },
      params,
    );
    assert.equal(second.outcome, 'skipped');
    assert.equal(second.reason, 'duplicate_inbound');
    assert.equal(sent.length, 1);
    assert.equal(store.state.turns.length, 1);
  });
});

describe('credit metering', () => {
  it('fail-closed: insufficient credits → guarded, NO LLM call', async () => {
    const store = createMemoryAgentStore(seed({ credits: { [WS]: 0 } }));
    let llmCalls = 0;
    const res = await runAgentTurn(
      {
        store,
        llm: async () => {
          llmCalls += 1;
          return { ok: true, text: '' };
        },
      },
      params,
    );
    assert.equal(res.outcome, 'guarded');
    assert.equal(res.reason, 'insufficient_credits');
    assert.equal(llmCalls, 0);
    assert.equal(store.state.ledger.length, 0);
  });

  it('auto turn debits exactly 1 credit with the synthetic messageId', async () => {
    const store = createMemoryAgentStore(seed({ credits: { [WS]: 3 } }));
    const sent: EnqueueSendInput[] = [];
    const res = await runAgentTurn(
      { store, llm: replyLlm('We open 9-5.'), enqueue: captureEnqueue(sent) },
      params,
    );
    assert.equal(res.outcome, 'replied');
    assert.equal(store.state.credits.get(WS), 2);
    assert.equal(store.state.ledger.length, 1);
    assert.equal(store.state.ledger[0].messageId, `agent:${res.turnId}`);
    assert.equal(store.state.ledger[0].delta, -1);
  });

  it('suggest mode never charges', async () => {
    const store = createMemoryAgentStore(
      seed({ config: { workspaceId: WS, enabled: true, mode: 'suggest' }, credits: { [WS]: 0 } }),
    );
    const res = await runAgentTurn({ store, llm: replyLlm('We open 9-5.') }, params);
    assert.equal(res.outcome, 'suggested');
    assert.equal(store.state.ledger.length, 0);
  });
});

describe('suggest vs auto routing', () => {
  it('suggest mode writes aiSuggestion and never enqueues', async () => {
    const store = createMemoryAgentStore(
      seed({ config: { workspaceId: WS, enabled: true, mode: 'suggest' } }),
    );
    const sent: EnqueueSendInput[] = [];
    const res = await runAgentTurn(
      { store, llm: replyLlm('We open 9am-5pm Mon-Fri.'), enqueue: captureEnqueue(sent) },
      params,
    );
    assert.equal(res.outcome, 'suggested');
    assert.equal(sent.length, 0);
    const conv = store.state.conversations.get(CONV);
    assert.equal(conv?.aiSuggestion?.body, 'We open 9am-5pm Mon-Fri.');
    assert.equal(conv?.aiSuggestion?.inboundMessageId, IN_MSG);
    assert.equal(store.state.turns[0].outcome, 'suggested');
  });

  it('auto mode replies through enqueueSend (service, ai-agent tag, idempotent)', async () => {
    const store = createMemoryAgentStore(seed());
    const sent: EnqueueSendInput[] = [];
    const res = await runAgentTurn(
      { store, llm: replyLlm('We open 9am-5pm Mon-Fri.'), enqueue: captureEnqueue(sent) },
      params,
    );
    assert.equal(res.outcome, 'replied');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].category, 'service');
    assert.deepEqual(sent[0].tags, ['ai-agent']);
    assert.equal(sent[0].to, PHONE);
    assert.equal(sent[0].from, '+15559990000'); // inbound doc's `to`
    assert.equal(sent[0].idempotencyKey, `agent:${IN_MSG}`);
    assert.equal(store.state.turns[0].outcome, 'replied');
    assert.equal(store.state.turns[0].replyMessageId, 'reply-1');
  });

  it('enqueue failure → outcome error, audited', async () => {
    const store = createMemoryAgentStore(seed());
    const res = await runAgentTurn(
      {
        store,
        llm: replyLlm('hi'),
        enqueue: async () => {
          throw new Error('engine down');
        },
      },
      params,
    );
    assert.equal(res.outcome, 'error');
    assert.equal(store.state.turns[0].outcome, 'error');
  });
});

describe('tool loop', () => {
  it('runs a tool then replies, bounded and audited', async () => {
    const store = createMemoryAgentStore(
      seed({
        contacts: [
          { workspaceId: WS, id: 'c1', name: 'Pat', phone: PHONE, tags: ['vip'] },
        ],
      }),
    );
    const sent: EnqueueSendInput[] = [];
    let call = 0;
    const llm: SabsmsLlmClient = async () => {
      call += 1;
      if (call === 1) {
        return {
          ok: true,
          text: JSON.stringify({ action: 'tool', tool: 'lookupContact', args: {} }),
        };
      }
      return {
        ok: true,
        text: JSON.stringify({ action: 'reply', body: 'Hi Pat! We open 9-5.' }),
      };
    };
    const res = await runAgentTurn({ store, llm, enqueue: captureEnqueue(sent) }, params);
    assert.equal(res.outcome, 'replied');
    assert.equal(store.state.turns[0].toolCalls.length, 1);
    assert.equal(store.state.turns[0].toolCalls[0].tool, 'lookupContact');
    assert.ok(store.state.turns[0].toolCalls[0].result.includes('Pat'));
  });

  it('handoffToHuman tool call terminates the turn as handoff', async () => {
    const store = createMemoryAgentStore(seed());
    const llm: SabsmsLlmClient = async () => ({
      ok: true,
      text: JSON.stringify({ action: 'tool', tool: 'handoffToHuman', args: {} }),
    });
    const res = await runAgentTurn({ store, llm }, params);
    assert.equal(res.outcome, 'handoff');
    assert.equal(store.state.conversations.get(CONV)?.aiFlags?.handoff, true);
  });

  it('tool-iteration budget is enforced (endless tool calls → error)', async () => {
    const store = createMemoryAgentStore(seed());
    let calls = 0;
    const llm: SabsmsLlmClient = async () => {
      calls += 1;
      return {
        ok: true,
        text: JSON.stringify({
          action: 'tool',
          tool: 'searchKnowledge',
          args: { query: 'hours' },
        }),
      };
    };
    const res = await runAgentTurn({ store, llm }, params);
    assert.equal(res.outcome, 'error');
    assert.ok(calls <= 4); // initial + MAX_TOOL_ITERATIONS
  });

  it('disallowed tools are refused but the loop continues', async () => {
    const store = createMemoryAgentStore(
      seed({
        config: {
          workspaceId: WS,
          enabled: true,
          mode: 'auto',
          allowedTools: ['searchKnowledge'],
        },
      }),
    );
    const sent: EnqueueSendInput[] = [];
    let call = 0;
    const llm: SabsmsLlmClient = async () => {
      call += 1;
      if (call === 1) {
        return {
          ok: true,
          text: JSON.stringify({ action: 'tool', tool: 'lookupContact', args: {} }),
        };
      }
      return { ok: true, text: JSON.stringify({ action: 'reply', body: 'ok' }) };
    };
    const res = await runAgentTurn({ store, llm, enqueue: captureEnqueue(sent) }, params);
    assert.equal(res.outcome, 'replied');
    assert.equal(store.state.turns[0].toolCalls[0].result, 'not_available');
  });
});
