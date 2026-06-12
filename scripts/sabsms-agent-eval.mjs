#!/usr/bin/env node
/**
 * SabSMS V2.12 — AI-agent eval harness (golden set, gates the PR).
 *
 * Runs the 50 scripted conversations in
 * `scripts/fixtures/sabsms-agent-eval.json` through the REAL pipeline
 * code (guardrail orchestration + agent runtime from
 * `src/lib/sabsms/agent/`) against the in-memory store and a
 * DETERMINISTIC mock gateway (canned responses scripted per fixture).
 * What's under test is OUR pipeline logic — routing to suppression vs
 * agent vs handoff, audit rows, credit metering, marker preservation —
 * not the model.
 *
 * Usage:
 *
 *   NODE_PATH=./src/workers/_stubs node_modules/.bin/tsx \
 *     scripts/sabsms-agent-eval.mjs [--live] [--verbose]
 *
 * (plain `node scripts/sabsms-agent-eval.mjs` also works — it re-execs
 * itself under tsx so the .ts imports resolve.)
 *
 *   --live     ALSO hit the real LLM gateway (AI_GATEWAY_API_KEY /
 *              ANTHROPIC_API_KEY / OPENAI_API_KEY) with relaxed,
 *              routing-class assertions. Skipped by default.
 *   --verbose  Per-fixture detail for passes too.
 *
 * Exit code 1 if ANY mock-pipeline expectation fails.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Self re-exec under tsx when invoked with plain node ───────────────────
// (Node ≥22 type-strips single .ts files but cannot resolve the repo's
// extensionless relative imports, so detection-by-probe is unreliable —
// always re-exec unless the guard env is set.)
const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.SABSMS_EVAL_TSX) {
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(
    join(__dirname, '../node_modules/.bin/tsx'),
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SABSMS_EVAL_TSX: '1',
        NODE_PATH: join(__dirname, '../src/workers/_stubs'),
      },
    },
  );
  process.exit(res.status ?? 1);
}

// Dynamic imports AFTER the re-exec guard (static .ts imports would be
// hoisted and fail to link under plain node). Default-import +
// destructure — tsx CommonJS interop (see the events worker).
const unwrap = (m) => m.default ?? m;
const storeModule = unwrap(await import('../src/lib/sabsms/agent/store.ts'));
const runtimeModule = unwrap(await import('../src/lib/sabsms/agent/runtime.ts'));
const handlersModule = unwrap(await import('../src/lib/sabsms/agent/handlers.ts'));
const markersModule = unwrap(await import('../src/lib/sabsms/agent/markers.ts'));
const llmModule = unwrap(await import('../src/lib/sabsms/agent/llm.ts'));

const { createMemoryAgentStore } = storeModule;
const { runAgentTurn } = runtimeModule;
const { runOptOutGuardrail, OPT_OUT_CONFIRMATION_BODY } = handlersModule;
const { markersPreserved } = markersModule;
const { defaultSabsmsLlmClient } = llmModule;

const LIVE = process.argv.includes('--live');
const VERBOSE = process.argv.includes('--verbose');

const fixtureFile = join(__dirname, 'fixtures/sabsms-agent-eval.json');
const spec = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const KB = spec.knowledge;
const REFUSAL = spec.refusal;

const WS = 'ws-eval';
const CONV = 'conv-eval';
const PHONE = '+15550001111';
const OUR_NUMBER = '+15559990000';
const IN_MSG = 'inbound-eval';

// ── Mock gateway: pops the fixture's scripted responses in order ──────────
function mockLlmFor(fixture, counters) {
  const queue = [...(fixture.responses ?? [])];
  return async () => {
    counters.llmCalls += 1;
    const next = queue.shift();
    if (!next) {
      return { ok: false, error: `mock exhausted for fixture ${fixture.id}` };
    }
    if (next.type === 'classifier') {
      return { ok: true, text: JSON.stringify({ intent: next.intent }) };
    }
    if (next.type === 'tool') {
      return {
        ok: true,
        text: JSON.stringify({ action: 'tool', tool: next.tool, args: next.args ?? {} }),
      };
    }
    const body = next.body === '__REFUSAL__' ? REFUSAL : next.body;
    return { ok: true, text: JSON.stringify({ action: 'reply', body }) };
  };
}

// ── One fixture through guardrail → agent (the consumer's exact order) ────
async function runFixture(fixture, llm) {
  const store = createMemoryAgentStore({
    config: {
      workspaceId: WS,
      enabled: true,
      mode: 'auto',
      persona: 'You are the assistant for Acme Outdoor Gear. Only discuss Acme topics.',
      knowledge: KB,
    },
    conversations: [{ id: CONV, workspaceId: WS, contactId: PHONE, status: 'open' }],
    messages: [
      {
        id: 'seed-out',
        workspaceId: WS,
        conversationId: CONV,
        direction: 'outbound',
        body: 'Hello from Acme!',
        category: fixture.conversationCategory,
        from: OUR_NUMBER,
        to: PHONE,
      },
      {
        id: IN_MSG,
        workspaceId: WS,
        conversationId: CONV,
        direction: 'inbound',
        body: fixture.inbound,
        from: PHONE,
        to: OUR_NUMBER,
      },
    ],
    contacts: [{ workspaceId: WS, id: 'c1', name: 'Pat', phone: PHONE, tags: ['vip'] }],
    credits: { [WS]: 100 },
  });

  const sent = [];
  const enqueue = async (input) => {
    sent.push(input);
    return { id: `out-${sent.length}`, status: 'queued' };
  };

  const params = {
    workspaceId: WS,
    conversationId: CONV,
    inboundMessageId: IN_MSG,
    inboundBody: fixture.inbound,
    contactPhone: PHONE,
  };

  // Same order the consumer registration enforces: guardrail, then agent.
  const guardrail = await runOptOutGuardrail({ store, llm, enqueue }, params);
  const agent = await runAgentTurn({ store, llm, enqueue }, params);

  return { store, sent, guardrail, agent };
}

// ── Expectation checks (mock mode = strict) ────────────────────────────────
function checkFixture(fixture, run, counters) {
  const errors = [];
  const { store, sent, agent } = run;
  const exp = fixture.expect;
  const conv = store.state.conversations.get(CONV);
  const turns = store.state.turns;

  const expectEq = (label, actual, wanted) => {
    if (actual !== wanted) {
      errors.push(`${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
    }
  };

  if (exp.noLlm) expectEq('llmCalls', counters.llmCalls, 0);

  switch (exp.pipeline) {
    case 'suppressed': {
      expectEq('suppression rows', store.state.suppressions.length, 1);
      if (store.state.suppressions[0]) {
        expectEq('suppression source', store.state.suppressions[0].source, 'stop');
        expectEq('suppression reason', store.state.suppressions[0].reason, 'ai_intent');
      }
      expectEq('consent rows', store.state.consentEvents.length, 1);
      if (store.state.consentEvents[0]) {
        expectEq('consent kind', store.state.consentEvents[0].kind, 'opt_out_stop');
        expectEq('consent method', store.state.consentEvents[0].captureMethod, 'ai_classified');
      }
      const confirms = sent.filter((s) => s.category === 'transactional');
      expectEq('TCPA confirmations', confirms.length, 1);
      if (confirms[0]) expectEq('confirmation body', confirms[0].body, OPT_OUT_CONFIRMATION_BODY);
      // THE acceptance criterion: the agent never replies to an opt-out.
      expectEq('agent outcome', agent.outcome, 'guarded');
      expectEq('agent reason', agent.reason, 'optout_guardrail');
      expectEq('agent replies sent', sent.filter((s) => (s.tags ?? []).includes('ai-agent')).length, 0);
      expectEq('audit rows', turns.length, 1);
      if (turns[0]) expectEq('audit outcome', turns[0].outcome, 'guarded');
      break;
    }
    case 'replied': {
      expectEq('suppression rows', store.state.suppressions.length, 0);
      expectEq('agent outcome', agent.outcome, 'replied');
      const replies = sent.filter((s) => (s.tags ?? []).includes('ai-agent'));
      expectEq('agent replies sent', replies.length, 1);
      if (replies[0]) {
        expectEq('reply category', replies[0].category, 'service');
        expectEq('reply idempotency', replies[0].idempotencyKey, `agent:${IN_MSG}`);
        if (exp.replyBody) {
          const wanted = exp.replyBody === '__REFUSAL__' ? REFUSAL : exp.replyBody;
          expectEq('reply body', replies[0].body, wanted);
        }
      }
      // Metering: exactly one 1-credit debit for the auto turn.
      expectEq('ledger debits', store.state.ledger.length, 1);
      if (store.state.ledger[0]) {
        expectEq('ledger delta', store.state.ledger[0].delta, -1);
        expectEq('ledger messageId', store.state.ledger[0].messageId, `agent:${agent.turnId}`);
      }
      const replyTurn = turns.find((t) => t.outcome === 'replied');
      if (!replyTurn) errors.push('audit: no replied turn row');
      else if (typeof exp.toolCalls === 'number') {
        expectEq('tool calls audited', replyTurn.toolCalls.length, exp.toolCalls);
      }
      break;
    }
    case 'handoff': {
      expectEq('agent outcome', agent.outcome, 'handoff');
      expectEq('aiFlags.handoff', conv?.aiFlags?.handoff, true);
      expectEq('agent replies sent', sent.filter((s) => (s.tags ?? []).includes('ai-agent')).length, 0);
      const handoffTurn = turns.find((t) => t.outcome === 'handoff');
      if (!handoffTurn) errors.push('audit: no handoff turn row');
      break;
    }
    case 'flagged_replied': {
      expectEq('aiFlags.possibleOptOut', conv?.aiFlags?.possibleOptOut, true);
      expectEq('suppression rows', store.state.suppressions.length, 0);
      expectEq('agent outcome', agent.outcome, 'replied');
      break;
    }
    default:
      errors.push(`unknown expectation pipeline ${exp.pipeline}`);
  }
  return errors;
}

// Relaxed routing-class checks for --live (the model is non-deterministic).
function checkFixtureLive(fixture, run) {
  const errors = [];
  const { store, agent } = run;
  switch (fixture.expect.pipeline) {
    case 'suppressed':
      if (store.state.suppressions.length !== 1) {
        errors.push(`live: expected suppression, got ${store.state.suppressions.length}`);
      }
      if (agent.outcome !== 'guarded') {
        errors.push(`live: agent outcome ${agent.outcome} (wanted guarded)`);
      }
      break;
    case 'handoff':
      if (agent.outcome !== 'handoff') {
        errors.push(`live: agent outcome ${agent.outcome} (wanted handoff)`);
      }
      break;
    case 'replied':
    case 'flagged_replied':
      if (!['replied', 'handoff'].includes(agent.outcome)) {
        errors.push(`live: agent outcome ${agent.outcome} (wanted replied|handoff)`);
      }
      if (store.state.suppressions.length !== 0) {
        errors.push('live: unexpected suppression');
      }
      break;
  }
  return errors;
}

// ── Run ────────────────────────────────────────────────────────────────────
const byCategory = new Map();
let failures = 0;

console.log(`SabSMS V2.12 agent eval — ${spec.fixtures.length} conversations (mock gateway)`);
console.log('─'.repeat(72));

for (const fixture of spec.fixtures) {
  const counters = { llmCalls: 0 };
  const run = await runFixture(fixture, mockLlmFor(fixture, counters));
  const errors = checkFixture(fixture, run, counters);

  const bucket = byCategory.get(fixture.category) ?? { pass: 0, fail: 0 };
  if (errors.length === 0) {
    bucket.pass += 1;
    if (VERBOSE) console.log(`  PASS ${fixture.id}`);
  } else {
    bucket.fail += 1;
    failures += 1;
    console.log(`  FAIL ${fixture.id} (${JSON.stringify(fixture.inbound)})`);
    for (const e of errors) console.log(`       - ${e}`);
  }
  byCategory.set(fixture.category, bucket);
}

// Marker-preservation checks (composer DLT-safe mode validator).
const markerBucket = { pass: 0, fail: 0 };
for (const check of spec.markerChecks) {
  const got = markersPreserved(check.original, check.rewritten);
  if (got === check.expectPreserved) {
    markerBucket.pass += 1;
    if (VERBOSE) console.log(`  PASS ${check.id}`);
  } else {
    markerBucket.fail += 1;
    failures += 1;
    console.log(`  FAIL ${check.id}: markersPreserved=${got}, expected ${check.expectPreserved}`);
  }
}
byCategory.set('dlt_markers', markerBucket);

console.log('─'.repeat(72));
console.log('Scorecard (mock pipeline):');
let totalPass = 0;
let totalFail = 0;
for (const [category, b] of byCategory) {
  totalPass += b.pass;
  totalFail += b.fail;
  const total = b.pass + b.fail;
  console.log(
    `  ${category.padEnd(14)} ${String(b.pass).padStart(3)}/${total}` +
      (b.fail > 0 ? `   (${b.fail} FAILED)` : ''),
  );
}
console.log(`  ${'TOTAL'.padEnd(14)} ${String(totalPass).padStart(3)}/${totalPass + totalFail}`);

// ── Optional live pass ─────────────────────────────────────────────────────
if (LIVE) {
  const hasKey = Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY,
  );
  if (!hasKey) {
    console.log('\n--live requested but no gateway key configured — skipping live pass.');
  } else {
    console.log('\nLive gateway pass (relaxed routing-class assertions)…');
    let livePass = 0;
    let liveFail = 0;
    for (const fixture of spec.fixtures) {
      const run = await runFixture(fixture, defaultSabsmsLlmClient);
      const errors = checkFixtureLive(fixture, run);
      if (errors.length === 0) livePass += 1;
      else {
        liveFail += 1;
        console.log(`  LIVE-FAIL ${fixture.id}`);
        for (const e of errors) console.log(`       - ${e}`);
      }
    }
    console.log(`Live scorecard: ${livePass}/${livePass + liveFail} (informational — does not gate)`);
  }
} else {
  console.log('\n(live gateway pass skipped — run with --live to include it)');
}

if (failures > 0) {
  console.error(`\n${failures} pipeline expectation(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll pipeline expectations passed.');
