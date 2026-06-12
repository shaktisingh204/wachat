/**
 * SabSMS journeys — event orchestration tests (V2.9).
 *
 *   npx tsx --test src/lib/sabsms/journeys/__tests__/events.test.ts
 *
 * Covers the consumer-facing orchestration not exercised by
 * `executor.test.ts`: linkClicked wakes (contactId + messageId→phone
 * resolution), campaignCompleted enrolment, and goal attribution.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tickJourneys } from '../executor';
import { onCampaignCompleted, onLinkClicked, startJourneyRun } from '../triggers';
import { emptyJourneyStats, type JourneyStep, type SabsmsJourney } from '../types';
import { createMemoryJourneyStore } from './memory-store';

const WS = 'ws1';
const PHONE = '+15550002222';

function journeyDoc(
  steps: JourneyStep[],
  overrides: Partial<SabsmsJourney> = {},
): Omit<SabsmsJourney, '_id'> {
  return {
    workspaceId: WS,
    name: 'Events journey',
    status: 'active',
    trigger: { kind: 'manual' },
    steps,
    exitRules: { onUnsubscribe: true },
    stats: emptyJourneyStats(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const stubEnqueue = async () => ({ id: 'msg-1', status: 'queued' as const });

describe('linkClicked', () => {
  it('wakes waitUntil(clicked) runs via messageId → phone resolution', async () => {
    const store = createMemoryJourneyStore();
    store.templates.set('tplA', 'See https://example.com/offer');
    store.templates.set('tplYes', 'Thanks for clicking!');
    const journeyId = store.addJourney(
      journeyDoc([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 'wu', kind: 'waitUntil', event: 'clicked', timeoutMs: 86_400_000 },
        { id: 'sYes', kind: 'send', templateId: 'tplYes' },
      ]),
    );
    const started = await startJourneyRun(store, journeyId, { phone: PHONE });
    const runId = (started as { runId: string }).runId;
    await tickJourneys({ store, enqueue: stubEnqueue });
    assert.equal((await store.getRun(runId))!.status, 'waiting');

    // The shortener's pseudo-event carries the messageId the send minted.
    store.messagePhones.set('507f1f77bcf86cd799439011', PHONE);
    const res = await onLinkClicked(store, {
      workspaceId: WS,
      slug: 'abc1234',
      messageId: '507f1f77bcf86cd799439011',
    });
    assert.equal(res.woken, 1);

    const run = (await store.getRun(runId))!;
    assert.equal(run.status, 'active');
    assert.equal(run.currentStepId, 'sYes');
    assert.ok(run.clickedAt);
    assert.ok(run.history.some((h) => h.result === 'event:clicked'));
  });

  it('falls back to contactId attribution and records the goal', async () => {
    const store = createMemoryJourneyStore();
    store.templates.set('tplA', 'Hello!');
    const journeyId = store.addJourney(
      journeyDoc(
        [
          { id: 's1', kind: 'send', templateId: 'tplA' },
          { id: 'wu', kind: 'waitUntil', event: 'clicked', timeoutMs: 86_400_000 },
        ],
        { goal: { event: 'clicked', windowMs: 7 * 86_400_000 } },
      ),
    );
    const started = await startJourneyRun(store, journeyId, {
      phone: PHONE,
      contactId: 'contact-9',
    });
    const runId = (started as { runId: string }).runId;
    await tickJourneys({ store, enqueue: stubEnqueue });

    const res = await onLinkClicked(store, {
      workspaceId: WS,
      slug: 'zzz',
      contactId: 'contact-9',
    });
    assert.equal(res.woken, 1);

    const run = (await store.getRun(runId))!;
    assert.ok(run.goalMetAt);
    const journey = (await store.getJourney(journeyId))!;
    assert.equal(journey.stats.goals, 1);
    assert.equal(journey.stats.clicks, 1);
  });

  it('no-ops without resolvable attribution', async () => {
    const store = createMemoryJourneyStore();
    const res = await onLinkClicked(store, { workspaceId: WS, slug: 'nope' });
    assert.deepEqual(res, { woken: 0 });
  });
});

describe('campaignCompleted', () => {
  it('enrols the campaign recipients into matching journeys', async () => {
    const store = createMemoryJourneyStore();
    store.templates.set('tplA', 'Follow-up!');
    const journeyId = store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }], {
        trigger: { kind: 'campaign_completed', campaignId: 'camp-1' },
      }),
    );
    // A second journey scoped to a DIFFERENT campaign must not enrol.
    store.addJourney(
      journeyDoc([{ id: 's1', kind: 'send', templateId: 'tplA' }], {
        trigger: { kind: 'campaign_completed', campaignId: 'camp-OTHER' },
      }),
    );
    store.campaignRecipients.set('camp-1', [
      { phone: '+15550000001' },
      { phone: '+15550000002', contactId: 'c2' },
    ]);

    const res = await onCampaignCompleted(store, { workspaceId: WS, campaignId: 'camp-1' });
    assert.equal(res.started, 2);
    assert.equal((await store.getJourney(journeyId))!.stats.started, 2);

    // Replay tolerance: the dedupe makes a second delivery a no-op.
    const replay = await onCampaignCompleted(store, { workspaceId: WS, campaignId: 'camp-1' });
    assert.equal(replay.started, 0);
  });
});
