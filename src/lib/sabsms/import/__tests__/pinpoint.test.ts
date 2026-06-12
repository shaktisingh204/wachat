/**
 * Pinpoint journey importer — mapping tests (V2.9).
 *
 *   npx tsx --test src/lib/sabsms/import/__tests__/pinpoint.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parseIso8601DurationMs, parsePinpointJourney, TEMPLATE_REF_PREFIX } from '../pinpoint';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const NOW = () => new Date('2026-06-12T00:00:00Z');

describe('parseIso8601DurationMs', () => {
  it('parses Pinpoint WaitFor durations', () => {
    assert.equal(parseIso8601DurationMs('PT24H'), 24 * 3600 * 1000);
    assert.equal(parseIso8601DurationMs('P3D'), 3 * 24 * 3600 * 1000);
    assert.equal(parseIso8601DurationMs('PT90M'), 90 * 60 * 1000);
    assert.equal(parseIso8601DurationMs('P1DT12H'), 36 * 3600 * 1000);
    assert.equal(parseIso8601DurationMs('P2W'), 14 * 24 * 3600 * 1000);
    assert.equal(parseIso8601DurationMs('PT45S'), 45_000);
  });

  it('rejects garbage', () => {
    assert.equal(parseIso8601DurationMs('24 hours'), null);
    assert.equal(parseIso8601DurationMs('P'), null);
    assert.equal(parseIso8601DurationMs(''), null);
  });
});

describe('welcome-series fixture (clean SMS journey)', () => {
  it('maps SMS → send, Wait → wait, attribute split → branch', () => {
    const { journey, templates, warnings } = parsePinpointJourney(
      fixture('pinpoint-welcome.json'),
      { now: NOW },
    );

    assert.equal(journey.name, 'Welcome Series (SMS)');
    assert.equal(journey.status, 'draft');
    assert.deepEqual(journey.trigger, { kind: 'manual' });
    assert.equal(journey.exitRules.onUnsubscribe, true);

    // BFS order from StartActivity.
    assert.deepEqual(
      journey.steps.map((s) => `${s.id}:${s.kind}`),
      [
        'welcomeSms:send',
        'wait24h:wait',
        'planSplit:branch',
        'proTipsSms:send',
        'upgradeSms:send',
      ],
    );

    const wait = journey.steps[1];
    assert.equal(wait.kind === 'wait' && wait.durationMs, 24 * 3600 * 1000);

    const branch = journey.steps[2];
    assert.ok(branch.kind === 'branch');
    if (branch.kind === 'branch') {
      assert.deepEqual(branch.condition, { field: 'plan', op: 'eq', value: 'pro' });
      assert.equal(branch.trueStepId, 'proTipsSms');
      assert.equal(branch.falseStepId, 'upgradeSms');
    }

    // One template draft per SMS activity, refs line up with the steps.
    assert.equal(templates.length, 3);
    assert.ok(templates.every((t) => t.ref.startsWith(TEMPLATE_REF_PREFIX)));
    assert.equal(templates[0].name, 'Imported — Welcome message');
    assert.match(templates[0].body, /Welcome to Acme/);

    const sendSteps = journey.steps.filter((s) => s.kind === 'send');
    assert.deepEqual(
      sendSteps.map((s) => (s.kind === 'send' ? s.templateId : '')),
      templates.map((t) => t.ref),
    );

    // The inline bodies import verbatim; the body-less pro-tips SMS
    // gets a placeholder + warning.
    const proTips = templates.find((t) => t.name.includes('Pro tips'))!;
    assert.match(proTips.body, /acme-pro-tips-sms/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Pro tips.*does not embed the message body/);
  });
});

describe('win-back fixture (mixed channels + unsupported activities)', () => {
  it('degrades unsupported activities to exits with warnings', () => {
    const { journey, templates, warnings } = parsePinpointJourney(
      fixture('pinpoint-winback.json'),
      { now: NOW },
    );

    const byId = new Map(journey.steps.map((s) => [s.id, s]));

    // Holdout / EMAIL / RandomSplit → exit placeholders.
    assert.equal(byId.get('holdout')?.kind, 'exit');
    assert.equal(byId.get('winbackEmail')?.kind, 'exit');
    assert.equal(byId.get('randomCopyTest')?.kind, 'exit');
    assert.ok(warnings.some((w) => w.includes('Holdout')));
    assert.ok(warnings.some((w) => w.includes('EMAIL')));
    assert.ok(warnings.some((w) => w.includes('RandomSplit')));

    // WaitUntil converted relative to import time, with a warning.
    const wait = byId.get('waitUntilBlackFriday');
    assert.ok(wait?.kind === 'wait');
    if (wait?.kind === 'wait') {
      const expected = Date.parse('2026-11-27T08:00:00Z') - NOW().getTime();
      assert.equal(wait.durationMs, expected);
    }
    assert.ok(warnings.some((w) => w.includes('WaitUntil')));

    // Event-based split can't map onto run vars → placeholder condition.
    const split = byId.get('engagementSplit');
    assert.ok(split?.kind === 'branch');
    if (split?.kind === 'branch') {
      assert.equal(split.condition.field, '__pinpoint_unmapped');
      assert.equal(split.trueStepId, 'discountSms');
      assert.equal(split.falseStepId, 'randomCopyTest');
    }
    assert.ok(warnings.some((w) => w.includes('event conditions')));

    // SMS activities still import as sends with their bodies.
    assert.equal(byId.get('discountSms')?.kind, 'send');
    assert.equal(byId.get('copyA')?.kind, 'send');
    assert.equal(byId.get('copyB')?.kind, 'send');
    assert.equal(templates.length, 3);
    assert.match(templates.find((t) => t.name.includes('Discount'))!.body, /25% off/);

    // The disconnected PUSH activity is skipped + reported.
    assert.equal(byId.has('orphanedPush'), false);
    assert.ok(warnings.some((w) => w.includes('unreachable')));

    // Every branch target resolves to a real step (builder validation
    // relies on this).
    const ids = new Set(journey.steps.map((s) => s.id));
    for (const step of journey.steps) {
      if (step.kind === 'branch') {
        assert.ok(ids.has(step.trueStepId), `missing ${step.trueStepId}`);
        assert.ok(ids.has(step.falseStepId), `missing ${step.falseStepId}`);
      }
    }
  });
});

describe('structural validation', () => {
  it('rejects non-JSON and non-journey payloads', () => {
    assert.throws(() => parsePinpointJourney('not json'), /Not valid JSON/);
    assert.throws(() => parsePinpointJourney({ foo: 1 }), /no Activities/);
    assert.throws(() => parsePinpointJourney([1, 2]), /journey export object/);
  });

  it('falls back to declaration order when StartActivity is missing', () => {
    const { journey, warnings } = parsePinpointJourney({
      Name: 'No start',
      Activities: {
        a: { SMS: { MessageConfig: { Body: 'Hi' }, NextActivity: null } },
      },
    });
    assert.equal(journey.steps.length, 1);
    assert.ok(warnings.some((w) => w.includes('StartActivity')));
  });
});
