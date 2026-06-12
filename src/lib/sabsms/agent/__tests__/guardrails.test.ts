/**
 * SabSMS V2.12 — guardrail unit tests (pure + mock-LLM).
 *
 *   NODE_PATH=./src/workers/_stubs npx tsx --test \
 *     src/lib/sabsms/agent/__tests__/guardrails.test.ts
 *
 * Covers: the regex pre-pass decision table, PII scrubbing (mask +
 * restore), classifier fallback behaviour, and the full opt-out
 * guardrail orchestration against the in-memory store (suppression +
 * consent rows, TCPA confirmation enqueue, marketing-ish gating,
 * unclear → possibleOptOut flag, replay tolerance).
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  classifyOptOutIntent,
  hashPhone,
  quietHoursExpectation,
  regexOptOutPrePass,
  scrubPii,
} from '../guardrails';
import {
  OPT_OUT_CONFIRMATION_BODY,
  runOptOutGuardrail,
} from '../handlers';
import { createMemoryAgentStore } from '../store';
import type { SabsmsLlmClient } from '../llm';
import type { EnqueueSendInput } from '../../types';

// ─── regex pre-pass table ──────────────────────────────────────────────────

describe('regexOptOutPrePass', () => {
  const table: Array<[string, 'opt_out' | 'not_opt_out' | 'unclear' | null]> = [
    // Obvious opt-outs — short-circuit, no LLM.
    ["please don't text me anymore", 'opt_out'],
    ['Please do not message me again', 'opt_out'],
    ['stop texting me', 'opt_out'],
    ['UNSUBSCRIBE', 'opt_out'],
    ['remove me from your list', 'opt_out'],
    ['i want to opt out', 'opt_out'],
    ['no more texts please', 'opt_out'],
    ['leave me alone', 'opt_out'],
    ['quit messaging me', 'opt_out'],
    // Obvious non-opt-outs.
    ['stop by the store when you can', 'not_opt_out'],
    ['see you at the bus stop', 'not_opt_out'],
    ["i can't stop laughing at that deal", 'not_opt_out'],
    ['what time do you open tomorrow?', 'not_opt_out'],
    ['yes, I will take two', 'not_opt_out'],
    ['', 'not_opt_out'],
    // Bare negation — ambiguous by definition.
    ["don't", 'unclear'],
    ['no', 'unclear'],
    // Has opt-out-ish vocabulary but inconclusive → null (LLM decides).
    ['I said STOP joking around', null],
    ['enough already with these', null],
  ];

  for (const [input, expected] of table) {
    it(`${JSON.stringify(input)} → ${String(expected)}`, () => {
      assert.equal(regexOptOutPrePass(input), expected);
    });
  }
});

// ─── scrubPii ──────────────────────────────────────────────────────────────

describe('scrubPii', () => {
  it('masks phone numbers', () => {
    const r = scrubPii('call me at +1 (555) 123-4567 ok');
    assert.ok(!r.text.includes('555'));
    assert.ok(r.text.includes('«PII_PHONE_1»'));
  });

  it('masks emails', () => {
    const r = scrubPii('mail bob.smith+x@example.co.uk now');
    assert.ok(!r.text.includes('example.co.uk'));
    assert.ok(r.text.includes('«PII_EMAIL_1»'));
  });

  it('masks 12+ digit sequences', () => {
    const r = scrubPii('card 4111111111111111 declined');
    assert.ok(!r.text.includes('4111111111111111'));
    assert.ok(r.text.includes('«PII_DIGITS_1»'));
  });

  it('leaves short numbers (prices, times) alone', () => {
    const r = scrubPii('open 9-5, order #42 was $12.50');
    assert.equal(r.text, 'open 9-5, order #42 was $12.50');
  });

  it('restore() reverses every mask', () => {
    const original = 'reach me at +15551234567 or a@b.io';
    const r = scrubPii(original);
    assert.notEqual(r.text, original);
    assert.equal(r.restore(r.text), original);
  });
});

// ─── classifyOptOutIntent ──────────────────────────────────────────────────

const llmReturning =
  (text: string, calls?: { count: number }): SabsmsLlmClient =>
  async () => {
    if (calls) calls.count += 1;
    return { ok: true, text };
  };

describe('classifyOptOutIntent', () => {
  it('short-circuits obvious cases without calling the LLM', async () => {
    const calls = { count: 0 };
    const llm = llmReturning('{"intent":"opt_out"}', calls);
    assert.equal(await classifyOptOutIntent('stop texting me', llm), 'opt_out');
    assert.equal(
      await classifyOptOutIntent('stop by the store', llm),
      'not_opt_out',
    );
    assert.equal(calls.count, 0);
  });

  it('uses the LLM for ambiguous bodies and parses the verdict', async () => {
    const calls = { count: 0 };
    assert.equal(
      await classifyOptOutIntent(
        'I said STOP joking around',
        llmReturning('{"intent":"not_opt_out"}', calls),
      ),
      'not_opt_out',
    );
    assert.equal(calls.count, 1);
  });

  it('degrades to unclear on LLM failure or junk output', async () => {
    const failing: SabsmsLlmClient = async () => ({ ok: false, error: 'down' });
    assert.equal(
      await classifyOptOutIntent('I said STOP joking around', failing),
      'unclear',
    );
    assert.equal(
      await classifyOptOutIntent(
        'I said STOP joking around',
        llmReturning('total garbage'),
      ),
      'unclear',
    );
  });
});

// ─── runOptOutGuardrail orchestration ──────────────────────────────────────

const WS = 'ws1';
const CONV = 'conv1';
const PHONE = '+15550001111';

function seededStore(lastOutboundCategory: string) {
  return createMemoryAgentStore({
    conversations: [
      { id: CONV, workspaceId: WS, contactId: PHONE, status: 'open' },
    ],
    messages: [
      {
        id: 'm-out-1',
        workspaceId: WS,
        conversationId: CONV,
        direction: 'outbound',
        body: 'Big sale this weekend!',
        category: lastOutboundCategory,
      },
    ],
  });
}

function captureEnqueue(sent: EnqueueSendInput[]) {
  return async (input: EnqueueSendInput) => {
    sent.push(input);
    return { id: 'sent-1', status: 'queued' as const };
  };
}

describe('runOptOutGuardrail', () => {
  it('suppresses a natural-language opt-out on a marketing thread', async () => {
    const store = seededStore('marketing');
    const sent: EnqueueSendInput[] = [];
    const res = await runOptOutGuardrail(
      { store, llm: llmReturning('{"intent":"opt_out"}'), enqueue: captureEnqueue(sent) },
      {
        workspaceId: WS,
        conversationId: CONV,
        inboundMessageId: 'in-1',
        inboundBody: "please don't text me anymore",
        contactPhone: PHONE,
      },
    );
    assert.equal(res.intent, 'opt_out');
    assert.equal(res.suppressed, true);

    // Suppression row (source from the schema enum, reason = ai_intent).
    assert.equal(store.state.suppressions.length, 1);
    assert.equal(store.state.suppressions[0].source, 'stop');
    assert.equal(store.state.suppressions[0].reason, 'ai_intent');
    assert.equal(store.state.suppressions[0].phoneHash, hashPhone(PHONE));

    // Consent-log opt-out, ai_classified.
    assert.equal(store.state.consentEvents.length, 1);
    assert.equal(store.state.consentEvents[0].kind, 'opt_out_stop');
    assert.equal(store.state.consentEvents[0].captureMethod, 'ai_classified');

    // TCPA confirmation through the engine door, transactional.
    assert.equal(sent.length, 1);
    assert.equal(sent[0].category, 'transactional');
    assert.equal(sent[0].body, OPT_OUT_CONFIRMATION_BODY);
    assert.equal(sent[0].idempotencyKey, 'optout-confirm:in-1');

    // Conversation marked so the agent skips this inbound.
    const conv = store.state.conversations.get(CONV);
    assert.equal(conv?.aiFlags?.guardedInboundId, 'in-1');
  });

  it('skips non-marketing conversations entirely (no LLM call)', async () => {
    const store = seededStore('service');
    const calls = { count: 0 };
    const res = await runOptOutGuardrail(
      { store, llm: llmReturning('{"intent":"opt_out"}', calls) },
      {
        workspaceId: WS,
        conversationId: CONV,
        inboundMessageId: 'in-1',
        inboundBody: "please don't text me anymore",
        contactPhone: PHONE,
      },
    );
    assert.equal(res.intent, 'skipped');
    assert.equal(store.state.suppressions.length, 0);
    assert.equal(calls.count, 0);
  });

  it('flags unclear bodies as possibleOptOut without suppressing', async () => {
    const store = seededStore('marketing');
    const res = await runOptOutGuardrail(
      { store, llm: llmReturning('{"intent":"unclear"}') },
      {
        workspaceId: WS,
        conversationId: CONV,
        inboundMessageId: 'in-2',
        inboundBody: 'I said STOP joking around maybe',
        contactPhone: PHONE,
      },
    );
    assert.equal(res.intent, 'unclear');
    assert.equal(res.suppressed, false);
    assert.equal(store.state.suppressions.length, 0);
    const conv = store.state.conversations.get(CONV);
    assert.equal(conv?.aiFlags?.possibleOptOut, true);
  });

  it('is replay-tolerant: a re-delivered opt-out does not duplicate writes', async () => {
    const store = seededStore('marketing');
    const sent: EnqueueSendInput[] = [];
    const deps = {
      store,
      llm: llmReturning('{"intent":"opt_out"}'),
      enqueue: captureEnqueue(sent),
    };
    const params = {
      workspaceId: WS,
      conversationId: CONV,
      inboundMessageId: 'in-1',
      inboundBody: 'stop texting me',
      contactPhone: PHONE,
    };
    await runOptOutGuardrail(deps, params);
    const second = await runOptOutGuardrail(deps, params);
    assert.equal(second.suppressed, true);
    assert.equal(store.state.suppressions.length, 1);
    assert.equal(store.state.consentEvents.length, 1);
    assert.equal(sent.length, 1);
  });
});

// ─── quiet-hours expectation ───────────────────────────────────────────────

describe('quietHoursExpectation', () => {
  it('service/transactional are exempt; marketing may reschedule', () => {
    assert.equal(quietHoursExpectation('service'), 'exempt');
    assert.equal(quietHoursExpectation('transactional'), 'exempt');
    assert.equal(quietHoursExpectation('marketing'), 'engine_may_reschedule');
  });
});
