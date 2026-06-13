/**
 * SabSMS V2.12 — agent-turn credit refund wiring (Wave B de-mock).
 *
 *   NODE_PATH=./src/workers/_stubs npx tsx --test \
 *     src/app/sabsms/inbox/__tests__/refund.test.ts
 *
 * Proves the runtime gives an auto-turn credit BACK on every post-charge
 * error path, and never refunds a turn that delivered (replied) or one
 * guarded BEFORE the charge. The charge stays pre-LLM (fail-closed); the
 * refund is the injectable `refundTurnCredit` seam — production defaults
 * it to a worker-safe release through `credits/core.ts` (the same ledger
 * `chargeAgentTurnCredit` debits through), so store.ts is never touched.
 *
 * NOTE: lives under the inbox owner dir (not agent/__tests__) so the
 * Wave B cluster can ship + run it without writing outside its lane; it
 * imports the runtime under test by relative path.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { runAgentTurn } from "../../../../lib/sabsms/agent/runtime";
import {
  createMemoryAgentStore,
  type MemoryAgentStoreSeed,
} from "../../../../lib/sabsms/agent/store";
import type { SabsmsLlmClient } from "../../../../lib/sabsms/agent/llm";
import type { EnqueueSendInput } from "../../../../lib/sabsms/types";

const WS = "ws1";
const CONV = "conv1";
const PHONE = "+15550001111";
const IN_MSG = "in-1";

function seed(overrides: Partial<MemoryAgentStoreSeed> = {}): MemoryAgentStoreSeed {
  return {
    config: {
      workspaceId: WS,
      enabled: true,
      mode: "auto",
      persona: "You are the Acme assistant.",
    },
    conversations: [{ id: CONV, workspaceId: WS, contactId: PHONE, status: "open" }],
    messages: [
      {
        id: IN_MSG,
        workspaceId: WS,
        conversationId: CONV,
        direction: "inbound",
        body: "what are your hours?",
        from: PHONE,
        to: "+15559990000",
      },
    ],
    credits: { [WS]: 5 },
    ...overrides,
  };
}

const params = {
  workspaceId: WS,
  conversationId: CONV,
  inboundMessageId: IN_MSG,
  inboundBody: "what are your hours?",
  contactPhone: PHONE,
};

const replyLlm =
  (body: string): SabsmsLlmClient =>
  async () => ({ ok: true, text: JSON.stringify({ action: "reply", body }) });

const errLlm: SabsmsLlmClient = async () => ({ ok: false, error: "provider down" });

function spyRefund() {
  const calls: Array<{ workspaceId: string; turnId: string }> = [];
  const refundTurnCredit = async (workspaceId: string, turnId: string) => {
    calls.push({ workspaceId, turnId });
  };
  return { calls, refundTurnCredit };
}

describe("agent-turn credit refund (Wave B)", () => {
  it("refunds the auto-turn credit when the LLM errors after the charge", async () => {
    const store = createMemoryAgentStore(seed());
    const { calls, refundTurnCredit } = spyRefund();

    const res = await runAgentTurn({ store, llm: errLlm, refundTurnCredit }, params);

    assert.equal(res.outcome, "error");
    // The credit was charged pre-LLM (fail-closed) …
    assert.equal(store.state.credits.get(WS), 4);
    // … and given back exactly once on the LLM-error path.
    assert.equal(calls.length, 1);
    assert.equal(calls[0].workspaceId, WS);
    assert.equal(calls[0].turnId, res.turnId);
  });

  it("refunds when the engine short-circuits as suppressed (no reply delivered)", async () => {
    const store = createMemoryAgentStore(seed());
    const { calls, refundTurnCredit } = spyRefund();
    const sent: EnqueueSendInput[] = [];
    const enqueue = async (input: EnqueueSendInput) => {
      sent.push(input);
      // Engine-disabled / suppressed short-circuit: no message written.
      return { id: "", status: "suppressed" as const };
    };

    const res = await runAgentTurn(
      { store, llm: replyLlm("We open 9-5."), enqueue, refundTurnCredit },
      params,
    );

    assert.equal(res.outcome, "guarded");
    assert.equal(res.reason, "engine_suppressed");
    assert.equal(calls.length, 1);
  });

  it("refunds when enqueue throws after the charge", async () => {
    const store = createMemoryAgentStore(seed());
    const { calls, refundTurnCredit } = spyRefund();
    const enqueue = async () => {
      throw new Error("engine down");
    };

    const res = await runAgentTurn(
      { store, llm: replyLlm("hi"), enqueue, refundTurnCredit },
      params,
    );

    assert.equal(res.outcome, "error");
    assert.equal(calls.length, 1);
  });

  it("never refunds a turn that actually replied", async () => {
    const store = createMemoryAgentStore(seed());
    const { calls, refundTurnCredit } = spyRefund();
    const enqueue = async () => ({ id: "reply-1", status: "queued" as const });

    const res = await runAgentTurn(
      { store, llm: replyLlm("We open 9-5."), enqueue, refundTurnCredit },
      params,
    );

    assert.equal(res.outcome, "replied");
    assert.equal(store.state.credits.get(WS), 4); // 1 credit kept
    assert.equal(calls.length, 0);
  });

  it("never refunds a turn guarded BEFORE the charge (no charge taken)", async () => {
    // Suppressed sender is guarded before the auto charge — nothing to refund.
    const store = createMemoryAgentStore(
      seed({ suppressedPhones: [{ workspaceId: WS, phone: PHONE }] }),
    );
    const { calls, refundTurnCredit } = spyRefund();

    const res = await runAgentTurn(
      { store, llm: replyLlm("x"), refundTurnCredit },
      params,
    );

    assert.equal(res.outcome, "guarded");
    assert.equal(res.reason, "suppressed");
    assert.equal(store.state.credits.get(WS), 5); // untouched
    assert.equal(calls.length, 0);
  });

  it("never refunds in suggest mode (suggest mode never charges)", async () => {
    const store = createMemoryAgentStore(
      seed({ config: { workspaceId: WS, enabled: true, mode: "suggest" } }),
    );
    const { calls, refundTurnCredit } = spyRefund();

    const res = await runAgentTurn(
      { store, llm: replyLlm("We open 9-5."), refundTurnCredit },
      params,
    );

    assert.equal(res.outcome, "suggested");
    assert.equal(calls.length, 0);
  });
});
