/**
 * SabSMS journeys — executor state-machine tests (V2.9).
 *
 *   npx tsx --test src/lib/sabsms/journeys/__tests__/executor.test.ts
 *
 * Pure `node:test` over the in-memory store with an injectable clock and
 * a stubbed enqueue — no Redis, no Mongo, no engine.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { EnqueueSendInput, EnqueueSendResult } from '../../types';
import { tickJourneys } from '../executor';
import { hashPhone, onContactUnsubscribed, onMessageInbound, startJourneyRun } from '../triggers';
import { emptyJourneyStats, type JourneyStep, type SabsmsJourney } from '../types';
import { createMemoryJourneyStore, type MemoryJourneyStore } from './memory-store';

const WS = 'ws1';
const PHONE = '+15550001111';

// ─── Harness ──────────────────────────────────────────────────────────────

function makeClock(startIso = '2026-06-12T00:00:00Z') {
  let t = new Date(startIso).getTime();
  return {
    now: () => new Date(t),
    advance(ms: number) {
      t += ms;
    },
  };
}

function makeEnqueue() {
  const calls: EnqueueSendInput[] = [];
  let n = 0;
  const enqueue = async (input: EnqueueSendInput): Promise<EnqueueSendResult> => {
    calls.push(input);
    n += 1;
    return { id: `msg-${n}`, status: 'queued', segments: 1 };
  };
  return { calls, enqueue };
}

function journeyDoc(steps: JourneyStep[], overrides: Partial<SabsmsJourney> = {}): Omit<SabsmsJourney, '_id'> {
  return {
    workspaceId: WS,
    name: 'Test journey',
    status: 'active',
    trigger: { kind: 'manual' },
    steps,
    exitRules: { onUnsubscribe: true },
    stats: emptyJourneyStats(),
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  };
}

let store: MemoryJourneyStore;

beforeEach(() => {
  store = createMemoryJourneyStore();
  store.templates.set('tplA', 'Hello {{name|there}} — welcome!');
  store.templates.set('tplB', 'Still around? Reply YES.');
  store.templates.set('tplYes', 'Great, talk soon!');
  store.templates.set('tplNo', 'We will stop here.');
});

// ─── Happy path ───────────────────────────────────────────────────────────

describe('executor — linear send/wait/send', () => {
  it('runs send → wait → send to completion across wakeups', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(
      journeyDoc([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 'w1', kind: 'wait', durationMs: 3_600_000 },
        { id: 's2', kind: 'send', templateId: 'tplB' },
      ]),
    );

    const started = await startJourneyRun(
      store,
      journeyId,
      { phone: PHONE, vars: { name: 'Asha' } },
      { now: clock.now },
    );
    assert.equal(started.started, true);
    const runId = (started as { runId: string }).runId;

    // Tick 1: sends s1, parks at the wait.
    let res = await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal(res.claimed, 1);
    assert.equal(q.calls.length, 1);
    assert.equal(q.calls[0].to, PHONE);
    assert.equal(q.calls[0].body, 'Hello Asha — welcome!');
    assert.equal(q.calls[0].category, 'marketing');
    assert.ok(q.calls[0].tags?.includes(`journey:${journeyId}`));

    let run = (await store.getRun(runId))!;
    assert.equal(run.status, 'waiting');
    assert.equal(run.currentStepId, 's2');
    assert.ok(run.wakeAt && run.wakeAt.getTime() === clock.now().getTime() + 3_600_000);

    // Not due yet — nothing claims.
    res = await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal(res.claimed, 0);

    // Due → s2 sends and the run completes.
    clock.advance(3_600_000 + 1);
    res = await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal(res.claimed, 1);
    assert.equal(q.calls.length, 2);
    assert.equal(q.calls[1].body, 'Still around? Reply YES.');

    run = (await store.getRun(runId))!;
    assert.equal(run.status, 'completed');

    const journey = (await store.getJourney(journeyId))!;
    assert.equal(journey.stats.started, 1);
    assert.equal(journey.stats.sends, 2);
    assert.equal(journey.stats.completed, 1);
  });
});

// ─── waitUntil ────────────────────────────────────────────────────────────

function waitUntilJourney(): JourneyStep[] {
  return [
    { id: 's1', kind: 'send', templateId: 'tplA' },
    {
      id: 'wu',
      kind: 'waitUntil',
      event: 'replied',
      timeoutMs: 24 * 3_600_000,
      onEventStepId: 'sYes',
      onTimeoutStepId: 'sNo',
    },
    { id: 'sYes', kind: 'send', templateId: 'tplYes' },
    { id: 'e1', kind: 'exit' },
    { id: 'sNo', kind: 'send', templateId: 'tplNo' },
  ];
}

describe('executor — waitUntil', () => {
  it('wakes on the replied event and takes the onEvent branch', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(journeyDoc(waitUntilJourney()));
    const started = await startJourneyRun(store, journeyId, { phone: PHONE }, { now: clock.now });
    const runId = (started as { runId: string }).runId;

    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    let run = (await store.getRun(runId))!;
    assert.equal(run.status, 'waiting');
    assert.equal(run.currentStepId, 'wu');
    assert.equal(run.waitingFor?.event, 'replied');

    // Inbound reply wakes the run onto sYes.
    clock.advance(3_600_000);
    const inbound = await onMessageInbound(
      store,
      { workspaceId: WS, from: PHONE, body: 'yes please' },
      { now: clock.now },
    );
    assert.equal(inbound.woken, 1);
    run = (await store.getRun(runId))!;
    assert.equal(run.status, 'active');
    assert.equal(run.currentStepId, 'sYes');
    assert.ok(run.repliedAt);

    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    run = (await store.getRun(runId))!;
    assert.equal(run.status, 'exited'); // sYes → e1 exit
    assert.equal(q.calls.length, 2);
    assert.equal(q.calls[1].body, 'Great, talk soon!');
    assert.ok(run.history.some((h) => h.result === 'event:replied'));
  });

  it('falls to the onTimeout branch when no event arrives', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(journeyDoc(waitUntilJourney()));
    const started = await startJourneyRun(store, journeyId, { phone: PHONE }, { now: clock.now });
    const runId = (started as { runId: string }).runId;

    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });

    clock.advance(24 * 3_600_000 + 1);
    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });

    const run = (await store.getRun(runId))!;
    assert.equal(run.status, 'completed'); // sNo is the last step
    assert.equal(q.calls.length, 2);
    assert.equal(q.calls[1].body, 'We will stop here.');
    assert.ok(run.history.some((h) => h.result === 'timeout:replied'));
  });
});

// ─── Branch ───────────────────────────────────────────────────────────────

describe('executor — branch', () => {
  function branchSteps(): JourneyStep[] {
    return [
      {
        id: 'b1',
        kind: 'branch',
        condition: { field: 'plan', op: 'eq', value: 'pro' },
        trueStepId: 'sPro',
        falseStepId: 'sBasic',
      },
      { id: 'sPro', kind: 'send', templateId: 'tplYes' },
      { id: 'e1', kind: 'exit' },
      { id: 'sBasic', kind: 'send', templateId: 'tplNo' },
    ];
  }

  it('takes the true edge when the var matches', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(journeyDoc(branchSteps()));
    const started = await startJourneyRun(
      store,
      journeyId,
      { phone: PHONE, vars: { plan: 'pro' } },
      { now: clock.now },
    );
    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });

    const run = (await store.getRun((started as { runId: string }).runId))!;
    assert.equal(q.calls.length, 1);
    assert.equal(q.calls[0].body, 'Great, talk soon!');
    assert.equal(run.status, 'exited');
    assert.ok(run.history.some((h) => h.result === 'branch:true'));
  });

  it('takes the false edge otherwise', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(journeyDoc(branchSteps()));
    const started = await startJourneyRun(
      store,
      journeyId,
      { phone: PHONE, vars: { plan: 'free' } },
      { now: clock.now },
    );
    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });

    const run = (await store.getRun((started as { runId: string }).runId))!;
    assert.equal(q.calls[0].body, 'We will stop here.');
    assert.equal(run.status, 'completed');
    assert.ok(run.history.some((h) => h.result === 'branch:false'));
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────

describe('executor — idempotent re-execution', () => {
  it('a reclaimed run never re-sends an already-executed step', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(
      journeyDoc([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 's2', kind: 'send', templateId: 'tplB' },
      ]),
    );
    const started = await startJourneyRun(store, journeyId, { phone: PHONE }, { now: clock.now });
    const runId = (started as { runId: string }).runId;

    // Simulate a crash AFTER the s1 enqueue (idempotency key persisted)
    // but BEFORE the advance: status stuck in `processing`.
    const raw = store.runs.get(runId)!;
    raw.status = 'processing';
    raw.processingAt = clock.now();
    raw.idempotency = { lastExecutedStepKey: `${runId}:s1` };

    // Not stale yet — nothing claims.
    let res = await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal(res.claimed, 0);

    // Past the stale window the run is reclaimed; s1's side effect is
    // skipped, s2 sends, the run completes — exactly ONE enqueue.
    clock.advance(6 * 60_000);
    res = await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal(res.claimed, 1);
    assert.equal(q.calls.length, 1);
    assert.equal(q.calls[0].body, 'Still around? Reply YES.');

    const run = (await store.getRun(runId))!;
    assert.equal(run.status, 'completed');
  });
});

// ─── Send-failure classification (V2.9 retry) ──────────────────────────────

describe('executor — send failure classification', () => {
  it('keeps template_missing terminal (run fails, no retry)', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'missingTpl' }]),
    );
    const started = await startJourneyRun(store, journeyId, { phone: PHONE }, { now: clock.now });
    const runId = (started as { runId: string }).runId;

    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    const run = (await store.getRun(runId))!;
    assert.equal(run.status, 'failed');
    assert.equal(q.calls.length, 0);
    assert.ok(run.history.some((h) => h.result.startsWith('error:template_missing')));
  });

  it('re-parks the run on a transient enqueue exception, then recovers', async () => {
    const clock = makeClock();
    let throwOnce = true;
    const calls: EnqueueSendInput[] = [];
    const enqueue = async (input: EnqueueSendInput): Promise<EnqueueSendResult> => {
      if (throwOnce) {
        throwOnce = false;
        throw new Error('engine unreachable');
      }
      calls.push(input);
      return { id: 'msg-1', status: 'queued', segments: 1 };
    };
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }]),
    );
    const started = await startJourneyRun(
      store,
      journeyId,
      { phone: PHONE, vars: { name: 'Asha' } },
      { now: clock.now },
    );
    const runId = (started as { runId: string }).runId;

    // Tick 1: enqueue throws → run re-parks (waiting), NOT failed.
    let res = await tickJourneys({ store, now: clock.now, enqueue });
    assert.equal(res.failed, 0);
    let run = (await store.getRun(runId))!;
    assert.equal(run.status, 'waiting');
    assert.equal(run.retryCount, 1);
    assert.equal(calls.length, 0);
    assert.ok(run.history.some((h) => h.result.startsWith('retry:1:error:enqueue')));
    assert.ok(run.wakeAt && run.wakeAt.getTime() > clock.now().getTime());

    // Tick 2 (due): enqueue succeeds → run completes, retryCount cleared.
    clock.advance(2 * 60_000);
    res = await tickJourneys({ store, now: clock.now, enqueue });
    run = (await store.getRun(runId))!;
    assert.equal(run.status, 'completed');
    assert.equal(run.retryCount, 0);
    assert.equal(calls.length, 1);
  });

  it('finally fails after exhausting the retry cap', async () => {
    const clock = makeClock();
    const enqueue = async (): Promise<EnqueueSendResult> => {
      throw new Error('engine still down');
    };
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }]),
    );
    const started = await startJourneyRun(
      store,
      journeyId,
      { phone: PHONE, vars: { name: 'Asha' } },
      { now: clock.now },
    );
    const runId = (started as { runId: string }).runId;

    // Drive enough due-ticks to exceed MAX_SEND_RETRIES (5).
    for (let i = 0; i < 8; i++) {
      await tickJourneys({ store, now: clock.now, enqueue });
      clock.advance(60 * 60_000); // jump past any backoff window
    }
    const run = (await store.getRun(runId))!;
    assert.equal(run.status, 'failed');
    assert.ok((run.retryCount ?? 0) >= 5);
  });
});

// ─── Exit rules ───────────────────────────────────────────────────────────

describe('exit rules', () => {
  it('contactUnsubscribed exits every live run for the phone hash', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(
      journeyDoc([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 'w1', kind: 'wait', durationMs: 86_400_000 },
        { id: 's2', kind: 'send', templateId: 'tplB' },
      ]),
    );
    const started = await startJourneyRun(store, journeyId, { phone: PHONE }, { now: clock.now });
    const runId = (started as { runId: string }).runId;
    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal((await store.getRun(runId))!.status, 'waiting');

    const res = await onContactUnsubscribed(
      store,
      { workspaceId: WS, phoneHash: hashPhone(PHONE) },
      { now: clock.now },
    );
    assert.equal(res.exited, 1);

    const run = (await store.getRun(runId))!;
    assert.equal(run.status, 'exited');
    assert.ok(run.history.some((h) => h.result === 'exit:unsubscribed'));

    // The parked wake never resurrects an exited run.
    clock.advance(86_400_000 + 1);
    const tick = await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });
    assert.equal(tick.claimed, 0);
    assert.equal(q.calls.length, 1);
  });

  it('exitRules.onReply exits the run on any inbound', async () => {
    const clock = makeClock();
    const q = makeEnqueue();
    const journeyId = store.addJourney(
      journeyDoc(
        [
          { id: 's1', kind: 'send', templateId: 'tplA' },
          { id: 'w1', kind: 'wait', durationMs: 86_400_000 },
          { id: 's2', kind: 'send', templateId: 'tplB' },
        ],
        { exitRules: { onUnsubscribe: true, onReply: true } },
      ),
    );
    const started = await startJourneyRun(store, journeyId, { phone: PHONE }, { now: clock.now });
    await tickJourneys({ store, now: clock.now, enqueue: q.enqueue });

    const inbound = await onMessageInbound(
      store,
      { workspaceId: WS, from: PHONE, body: 'thanks!' },
      { now: clock.now },
    );
    assert.equal(inbound.exited, 1);
    assert.equal((await store.getRun((started as { runId: string }).runId))!.status, 'exited');
  });
});

// ─── Enrolment gates ──────────────────────────────────────────────────────

describe('startJourneyRun gates', () => {
  it('refuses suppressed phones', async () => {
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }]),
    );
    store.suppressedHashes.add(hashPhone(PHONE));
    const res = await startJourneyRun(store, journeyId, { phone: PHONE });
    assert.deepEqual(res, { started: false, reason: 'suppressed' });
  });

  it('dedupes to one live run per (journey, phone)', async () => {
    const journeyId = store.addJourney(
      journeyDoc([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 'w1', kind: 'wait', durationMs: 1000 },
        { id: 's2', kind: 'send', templateId: 'tplB' },
      ]),
    );
    const first = await startJourneyRun(store, journeyId, { phone: PHONE });
    assert.equal(first.started, true);
    const second = await startJourneyRun(store, journeyId, { phone: PHONE });
    assert.deepEqual(second, { started: false, reason: 'duplicate' });
  });

  it('refuses paused/draft journeys (unless allowDraft)', async () => {
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }], { status: 'paused' }),
    );
    const res = await startJourneyRun(store, journeyId, { phone: PHONE });
    assert.deepEqual(res, { started: false, reason: 'not_active' });
  });
});

// ─── Keyword trigger ──────────────────────────────────────────────────────

describe('inbound_keyword trigger', () => {
  it('starts a run when the first token matches the keyword', async () => {
    const clock = makeClock();
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }], {
        trigger: { kind: 'inbound_keyword', keyword: 'JOIN' },
      }),
    );

    const miss = await onMessageInbound(
      store,
      { workspaceId: WS, from: PHONE, body: 'hello there' },
      { now: clock.now },
    );
    assert.equal(miss.started, 0);

    const hit = await onMessageInbound(
      store,
      { workspaceId: WS, from: PHONE, body: 'join now' },
      { now: clock.now },
    );
    assert.equal(hit.started, 1);

    const journey = (await store.getJourney(journeyId))!;
    assert.equal(journey.stats.started, 1);
  });
});
