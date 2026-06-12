/**
 * SabSMS journeys — A/B assignment + winner promotion tests (V2.9).
 *
 *   npx tsx --test src/lib/sabsms/journeys/__tests__/ab.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeWinner, maybePromoteWinner, pickVariant, type VariantStats } from '../ab';
import { tickJourneys } from '../executor';
import { startJourneyRun } from '../triggers';
import { emptyJourneyStats, type SabsmsJourney } from '../types';
import { createMemoryJourneyStore } from './memory-store';

const VARIANTS = [
  { templateId: 'tplA', weight: 1 },
  { templateId: 'tplB', weight: 1 },
];

describe('pickVariant — deterministic assignment', () => {
  it('always returns the same arm for the same (runId, stepId)', () => {
    for (let i = 0; i < 50; i++) {
      const first = pickVariant(`run-${i}`, 's1', VARIANTS);
      for (let j = 0; j < 5; j++) {
        assert.deepEqual(pickVariant(`run-${i}`, 's1', VARIANTS), first);
      }
    }
  });

  it('splits roughly by weight across many runs', () => {
    let a = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) {
      const arm = pickVariant(`run-${i}`, 'step-x', VARIANTS);
      if (arm?.templateId === 'tplA') a += 1;
    }
    // 50/50 split with generous tolerance (deterministic, not random).
    assert.ok(a > total * 0.4 && a < total * 0.6, `tplA got ${a}/${total}`);
  });

  it('respects skewed weights', () => {
    const skewed = [
      { templateId: 'tplA', weight: 9 },
      { templateId: 'tplB', weight: 1 },
    ];
    let b = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) {
      if (pickVariant(`r${i}`, 's', skewed)?.templateId === 'tplB') b += 1;
    }
    assert.ok(b > total * 0.05 && b < total * 0.16, `tplB got ${b}/${total}`);
  });

  it('ignores zero-weight arms and handles empty lists', () => {
    assert.equal(pickVariant('r', 's', []), undefined);
    assert.equal(pickVariant('r', 's', undefined), undefined);
    const onlyB = [
      { templateId: 'tplA', weight: 0 },
      { templateId: 'tplB', weight: 1 },
    ];
    assert.equal(pickVariant('r', 's', onlyB)?.templateId, 'tplB');
  });
});

describe('computeWinner — promotion math', () => {
  const stats = (a: Partial<VariantStats>, b: Partial<VariantStats>): VariantStats[] => [
    { templateId: 'tplA', sent: 0, delivered: 0, replied: 0, clicked: 0, ...a },
    { templateId: 'tplB', sent: 0, delivered: 0, replied: 0, clicked: 0, ...b },
  ];

  it('returns null below the sample threshold', () => {
    assert.equal(
      computeWinner(VARIANTS, stats({ sent: 199, replied: 50 }, { sent: 500, replied: 10 }), 200),
      null,
    );
  });

  it('picks the higher reply rate once both arms are sampled', () => {
    const w = computeWinner(
      VARIANTS,
      stats({ sent: 400, replied: 20 }, { sent: 400, replied: 60 }),
      200,
    );
    assert.equal(w?.templateId, 'tplB');
    assert.equal(w?.metric, 'reply');
    assert.equal(w?.rate, 60 / 400);
    assert.equal(w?.samples, 800);
  });

  it('falls back to click rate when nobody replied', () => {
    const w = computeWinner(
      VARIANTS,
      stats({ sent: 300, clicked: 30 }, { sent: 300, clicked: 12 }),
      200,
    );
    assert.equal(w?.templateId, 'tplA');
    assert.equal(w?.metric, 'click');
    assert.equal(w?.rate, 0.1);
  });

  it('returns null with zero signal, and breaks ties to the first arm', () => {
    assert.equal(computeWinner(VARIANTS, stats({ sent: 300 }, { sent: 300 }), 200), null);
    const tie = computeWinner(
      VARIANTS,
      stats({ sent: 300, replied: 30 }, { sent: 300, replied: 30 }),
      200,
    );
    assert.equal(tie?.templateId, 'tplA');
  });
});

describe('maybePromoteWinner — store integration', () => {
  function abJourney(store: ReturnType<typeof createMemoryJourneyStore>): string {
    return store.addJourney({
      workspaceId: 'ws1',
      name: 'AB journey',
      status: 'active',
      trigger: { kind: 'manual' },
      steps: [{ id: 's1', kind: 'send', templateId: 'tplA', abVariants: VARIANTS }],
      exitRules: { onUnsubscribe: true },
      stats: emptyJourneyStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it('promotes the winner, rewrites the step, and is idempotent', async () => {
    const store = createMemoryJourneyStore();
    const journeyId = abJourney(store);
    store.variantStats.set(`${journeyId}:s1`, [
      { templateId: 'tplA', sent: 250, delivered: 240, replied: 10, clicked: 5 },
      { templateId: 'tplB', sent: 250, delivered: 245, replied: 40, clicked: 8 },
    ]);

    const journey = (await store.getJourney(journeyId))!;
    const res = await maybePromoteWinner(store, journey, 's1');
    assert.equal(res.promoted, true);
    assert.equal((res as { winner: { templateId: string } }).winner.templateId, 'tplB');

    const after = (await store.getJourney(journeyId))!;
    const step = after.steps[0];
    assert.equal(step.kind === 'send' && step.templateId, 'tplB');
    assert.equal(step.kind === 'send' && step.abVariants, undefined);
    assert.equal(after.ab?.winners?.s1?.templateId, 'tplB');
    assert.equal(after.ab?.winners?.s1?.metric, 'reply');

    const again = await maybePromoteWinner(store, after, 's1');
    assert.deepEqual(again, { promoted: false, reason: 'no_ab' });
  });

  it('holds below the threshold and yields under force', async () => {
    const store = createMemoryJourneyStore();
    const journeyId = abJourney(store);
    store.variantStats.set(`${journeyId}:s1`, [
      { templateId: 'tplA', sent: 50, delivered: 50, replied: 2, clicked: 0 },
      { templateId: 'tplB', sent: 50, delivered: 50, replied: 9, clicked: 0 },
    ]);

    const journey = (await store.getJourney(journeyId))!;
    const held = await maybePromoteWinner(store, journey, 's1');
    assert.deepEqual(held, { promoted: false, reason: 'insufficient_sample' });

    const forced = await maybePromoteWinner(store, journey, 's1', { force: true });
    assert.equal(forced.promoted, true);
    assert.equal((forced as { winner: { templateId: string } }).winner.templateId, 'tplB');
  });

  it('respects a custom journey-level sampleThreshold via the tick sweep', async () => {
    const store = createMemoryJourneyStore();
    const journeyId = store.addJourney({
      workspaceId: 'ws1',
      name: 'AB low threshold',
      status: 'active',
      trigger: { kind: 'manual' },
      steps: [{ id: 's1', kind: 'send', templateId: 'tplA', abVariants: VARIANTS }],
      exitRules: { onUnsubscribe: true },
      ab: { sampleThreshold: 10 },
      stats: emptyJourneyStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    store.variantStats.set(`${journeyId}:s1`, [
      { templateId: 'tplA', sent: 12, delivered: 12, replied: 1, clicked: 0 },
      { templateId: 'tplB', sent: 12, delivered: 12, replied: 6, clicked: 0 },
    ]);

    const res = await tickJourneys({ store, enqueue: async () => ({ id: 'x', status: 'queued' }) });
    assert.equal(res.promotedWinners, 1);
    const after = (await store.getJourney(journeyId))!;
    assert.equal(after.ab?.winners?.s1?.templateId, 'tplB');
  });
});

describe('executor + A/B — variant recorded deterministically', () => {
  it('stamps the picked variant into history and message tags', async () => {
    const store = createMemoryJourneyStore();
    store.templates.set('tplA', 'Copy A');
    store.templates.set('tplB', 'Copy B');
    const journeyId = store.addJourney({
      workspaceId: 'ws1',
      name: 'AB send',
      status: 'active',
      trigger: { kind: 'manual' },
      steps: [{ id: 's1', kind: 'send', templateId: 'tplA', abVariants: VARIANTS }],
      exitRules: { onUnsubscribe: true },
      stats: emptyJourneyStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const calls: Array<{ body: string; tags?: string[] }> = [];
    const started = await startJourneyRun(store, journeyId, { phone: '+15550009999' });
    const runId = (started as { runId: string }).runId;
    await tickJourneys({
      store,
      enqueue: async (input) => {
        calls.push({ body: input.body, tags: input.tags });
        return { id: 'm1', status: 'queued' };
      },
    });

    const expected = pickVariant(runId, 's1', VARIANTS)!;
    const run = (await store.getRun(runId))!;
    const sent = run.history.find((h) => h.result === 'sent')!;
    assert.equal(sent.variantTemplateId, expected.templateId);
    assert.equal(calls[0].body, expected.templateId === 'tplA' ? 'Copy A' : 'Copy B');
    assert.ok(calls[0].tags?.includes(`journeyVariant:${expected.templateId}`));

    // The deterministic pick is part of the idempotency story: a replay
    // of the same run/step could only ever choose the same arm.
    assert.deepEqual(pickVariant(runId, 's1', VARIANTS), expected);
  });
});
