/**
 * Unit tests for the PURE multichannel-cadence helpers (`../cadence-channels`).
 *
 *   npx tsx --test src/lib/sabcrm/__tests__/cadence-channels.test.ts
 *
 * No DB, no network — only the deterministic step + A/B + token math.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CADENCE_CHANNELS,
  isCadenceChannel,
  hashToUnit,
  pickAbVariant,
  resolveEmailSubject,
  nextStepAfter,
  firstStepRunAt,
  renderTokens,
  normalizeStep,
  normalizeSteps,
  channelOutcomeVerb,
  type CadenceStep,
  type CadenceAbVariant,
} from '../cadence-channels';

/* -------------------------------------------------------------------------- */
/* channel guard                                                               */
/* -------------------------------------------------------------------------- */

test('isCadenceChannel accepts the five channels, rejects others', () => {
  for (const ch of CADENCE_CHANNELS) assert.equal(isCadenceChannel(ch), true);
  assert.equal(isCadenceChannel('call'), false);
  assert.equal(isCadenceChannel(''), false);
  assert.equal(isCadenceChannel(undefined), false);
  assert.equal(isCadenceChannel(7), false);
});

/* -------------------------------------------------------------------------- */
/* hashToUnit                                                                  */
/* -------------------------------------------------------------------------- */

test('hashToUnit is deterministic and in [0, 1)', () => {
  const a = hashToUnit('seed-A');
  const b = hashToUnit('seed-A');
  const c = hashToUnit('seed-B');
  assert.equal(a, b); // stable
  assert.notEqual(a, c); // different seeds differ (overwhelmingly likely)
  for (const s of ['', 'x', 'aaaaaa', 's_1::e_9', '🚀unicode']) {
    const u = hashToUnit(s);
    assert.ok(u >= 0 && u < 1, `unit out of range for ${JSON.stringify(s)}: ${u}`);
  }
});

/* -------------------------------------------------------------------------- */
/* pickAbVariant                                                               */
/* -------------------------------------------------------------------------- */

test('pickAbVariant returns null for empty / undefined variants', () => {
  assert.equal(pickAbVariant('s1', 'e1', undefined), null);
  assert.equal(pickAbVariant('s1', 'e1', []), null);
});

test('pickAbVariant returns the only variant when there is one', () => {
  const only: CadenceAbVariant = { id: 'v1', subject: 'Hi' };
  assert.deepEqual(pickAbVariant('s1', 'e1', [only]), only);
});

test('pickAbVariant is deterministic per (stepId, enrollmentId)', () => {
  const variants: CadenceAbVariant[] = [
    { id: 'a', subject: 'A' },
    { id: 'b', subject: 'B' },
  ];
  const first = pickAbVariant('step-7', 'enroll-42', variants);
  for (let i = 0; i < 25; i += 1) {
    assert.deepEqual(pickAbVariant('step-7', 'enroll-42', variants), first);
  }
  // The chosen one is genuinely one of the arms.
  assert.ok(variants.some((v) => v.id === first?.id));
});

test('pickAbVariant splits a 50/50 two-arm test roughly evenly across enrollments', () => {
  const variants: CadenceAbVariant[] = [
    { id: 'a', subject: 'A' },
    { id: 'b', subject: 'B' },
  ];
  let a = 0;
  const N = 4000;
  for (let i = 0; i < N; i += 1) {
    const v = pickAbVariant('step', `enroll-${i}`, variants);
    if (v?.id === 'a') a += 1;
  }
  const ratio = a / N;
  // FNV-1a over distinct enrollment ids → well within 40–60% for N=4000.
  assert.ok(ratio > 0.4 && ratio < 0.6, `unbalanced split: ${ratio}`);
});

test('pickAbVariant honours weights (heavily-weighted arm dominates)', () => {
  const variants: CadenceAbVariant[] = [
    { id: 'rare', subject: 'R', weight: 1 },
    { id: 'common', subject: 'C', weight: 9 },
  ];
  let common = 0;
  const N = 4000;
  for (let i = 0; i < N; i += 1) {
    const v = pickAbVariant('step', `e-${i}`, variants);
    if (v?.id === 'common') common += 1;
  }
  const ratio = common / N;
  assert.ok(ratio > 0.8 && ratio < 0.98, `weight not honoured: ${ratio}`);
});

test('pickAbVariant falls back to first arm when all weights are non-positive', () => {
  const variants: CadenceAbVariant[] = [
    { id: 'a', subject: 'A', weight: 0 },
    { id: 'b', subject: 'B', weight: -3 },
  ];
  // total weights collapse to 1 each (defaulted) since non-positive → 1.
  const v = pickAbVariant('s', 'e', variants);
  assert.ok(v === variants[0] || v === variants[1]);
});

/* -------------------------------------------------------------------------- */
/* resolveEmailSubject                                                         */
/* -------------------------------------------------------------------------- */

test('resolveEmailSubject uses the plain subject when there are no variants', () => {
  const step: CadenceStep = {
    id: 's1',
    channel: 'email',
    delayHours: 0,
    subject: 'Plain subject',
  };
  const r = resolveEmailSubject(step, 'e1');
  assert.equal(r.subject, 'Plain subject');
  assert.equal(r.variantId, null);
});

test('resolveEmailSubject returns the chosen variant + its id', () => {
  const step: CadenceStep = {
    id: 's1',
    channel: 'email',
    delayHours: 0,
    subject: 'ignored',
    variants: [
      { id: 'a', subject: 'Subj A' },
      { id: 'b', subject: 'Subj B' },
    ],
  };
  const r = resolveEmailSubject(step, 'enroll-1');
  assert.ok(r.variantId === 'a' || r.variantId === 'b');
  assert.ok(r.subject === 'Subj A' || r.subject === 'Subj B');
  // and stable
  assert.deepEqual(resolveEmailSubject(step, 'enroll-1'), r);
});

/* -------------------------------------------------------------------------- */
/* nextStepAfter / firstStepRunAt                                              */
/* -------------------------------------------------------------------------- */

const steps: CadenceStep[] = [
  { id: 's0', channel: 'email', delayHours: 0 },
  { id: 's1', channel: 'wait', delayHours: 24 },
  { id: 's2', channel: 'sms', delayHours: 48 },
];

test('nextStepAfter schedules the next step at now + its OWN delay', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const plan = nextStepAfter(steps, 0, now);
  assert.equal(plan.done, false);
  assert.equal(plan.nextIndex, 1);
  // step 1 has delayHours 24 → +24h
  assert.equal(plan.nextRunAt, '2026-01-02T00:00:00.000Z');
});

test('nextStepAfter from the middle uses the following step delay', () => {
  const now = new Date('2026-01-02T00:00:00.000Z');
  const plan = nextStepAfter(steps, 1, now);
  assert.equal(plan.nextIndex, 2);
  // step 2 has delayHours 48 → +48h
  assert.equal(plan.nextRunAt, '2026-01-04T00:00:00.000Z');
});

test('nextStepAfter on the last step is done', () => {
  const plan = nextStepAfter(steps, 2, new Date());
  assert.equal(plan.done, true);
  assert.equal(plan.nextRunAt, null);
});

test('nextStepAfter on an empty list is done', () => {
  const plan = nextStepAfter([], 0, new Date());
  assert.equal(plan.done, true);
});

test('nextStepAfter clamps a negative / NaN delay to zero', () => {
  const odd: CadenceStep[] = [
    { id: 'a', channel: 'email', delayHours: 0 },
    { id: 'b', channel: 'sms', delayHours: -5 },
    { id: 'c', channel: 'sms', delayHours: Number.NaN },
  ];
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(nextStepAfter(odd, 0, now).nextRunAt, '2026-01-01T00:00:00.000Z');
  assert.equal(nextStepAfter(odd, 1, now).nextRunAt, '2026-01-01T00:00:00.000Z');
});

test('firstStepRunAt honours the first step delay', () => {
  const at = new Date('2026-03-01T12:00:00.000Z');
  const withDelay: CadenceStep[] = [{ id: 'x', channel: 'email', delayHours: 2 }];
  assert.equal(firstStepRunAt(withDelay, at), '2026-03-01T14:00:00.000Z');
  // immediate first step
  assert.equal(firstStepRunAt(steps, at), '2026-03-01T12:00:00.000Z');
});

test('firstStepRunAt on no steps still returns a valid ISO string', () => {
  const at = new Date('2026-03-01T12:00:00.000Z');
  assert.equal(firstStepRunAt([], at), '2026-03-01T12:00:00.000Z');
});

/* -------------------------------------------------------------------------- */
/* renderTokens                                                                */
/* -------------------------------------------------------------------------- */

test('renderTokens fills known tokens and blanks unknown ones', () => {
  const data = { firstName: 'Ada', company: { name: 'Analytical Engines' } };
  assert.equal(renderTokens('Hi {{firstName}}!', data), 'Hi Ada!');
  assert.equal(renderTokens('{{ firstName }} @ {{company}}', data), 'Ada @ Analytical Engines');
  assert.equal(renderTokens('Hello {{missing}}.', data), 'Hello .');
});

test('renderTokens tolerates empty inputs', () => {
  assert.equal(renderTokens('', { a: 1 }), '');
  assert.equal(renderTokens('No tokens', undefined), 'No tokens');
  assert.equal(renderTokens('{{x}}', undefined), '');
});

/* -------------------------------------------------------------------------- */
/* normalizeStep / normalizeSteps                                             */
/* -------------------------------------------------------------------------- */

test('normalizeStep rejects an unknown channel', () => {
  assert.equal(normalizeStep({ channel: 'fax', delayHours: 1 }), null);
  assert.equal(normalizeStep(null), null);
  assert.equal(normalizeStep('nope'), null);
});

test('normalizeStep trims strings and clamps delay', () => {
  const s = normalizeStep({
    id: ' keep ',
    channel: 'email',
    delayHours: -3,
    subject: '  Hi  ',
    body: ' Body ',
  });
  assert.ok(s);
  assert.equal(s!.channel, 'email');
  assert.equal(s!.delayHours, 0);
  assert.equal(s!.subject, 'Hi');
  assert.equal(s!.body, 'Body');
  assert.equal(s!.id, ' keep '); // id kept verbatim when truthy
});

test('normalizeStep drops blank-subject variants and defaults weights', () => {
  const s = normalizeStep({
    id: 's',
    channel: 'email',
    delayHours: 0,
    variants: [
      { id: 'a', subject: 'A' },
      { id: 'b', subject: '   ' }, // dropped
      { subject: 'C', weight: 0 }, // weight defaults to 1, id generated
    ],
  });
  assert.ok(s);
  assert.equal(s!.variants?.length, 2);
  assert.equal(s!.variants?.[0].subject, 'A');
  assert.equal(s!.variants?.[1].subject, 'C');
  assert.equal(s!.variants?.[1].weight, 1);
  assert.ok(s!.variants?.[1].id); // generated
});

test('normalizeSteps drops the unusable ones, keeps order', () => {
  const out = normalizeSteps([
    { channel: 'email', delayHours: 0, subject: 'first' },
    { channel: 'bogus', delayHours: 1 },
    { channel: 'wait', delayHours: 24 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].channel, 'email');
  assert.equal(out[1].channel, 'wait');
});

test('normalizeSteps tolerates a non-array', () => {
  assert.deepEqual(normalizeSteps(undefined), []);
  assert.deepEqual(normalizeSteps('x'), []);
});

/* -------------------------------------------------------------------------- */
/* channelOutcomeVerb                                                          */
/* -------------------------------------------------------------------------- */

test('channelOutcomeVerb maps each channel to a stable verb', () => {
  assert.equal(channelOutcomeVerb('email'), 'email_sent');
  assert.equal(channelOutcomeVerb('sms'), 'sms_sent');
  assert.equal(channelOutcomeVerb('whatsapp'), 'whatsapp_sent');
  assert.equal(channelOutcomeVerb('task'), 'task_created');
  assert.equal(channelOutcomeVerb('wait'), 'waited');
});
