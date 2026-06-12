/**
 * Journey builder validator — pure tests (V2.9).
 *
 *   npx tsx --test "src/app/sabsms/drips/[id]/__tests__/validate.test.ts"
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { JourneyStep } from '@/lib/sabsms/journeys/types';

import { validateJourney, type JourneyDraft } from '../validate';

function draft(steps: JourneyStep[], overrides: Partial<JourneyDraft> = {}): JourneyDraft {
  return {
    name: 'My journey',
    trigger: { kind: 'manual' },
    steps,
    exitRules: { onUnsubscribe: true },
    ...overrides,
  };
}

describe('validateJourney', () => {
  it('accepts a clean linear journey', () => {
    const res = validateJourney(
      draft([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 'w1', kind: 'wait', durationMs: 3_600_000 },
        { id: 's2', kind: 'send', templateId: 'tplB' },
      ]),
    );
    assert.deepEqual(res, { ok: true, errors: [], warnings: [] });
  });

  it('requires name, steps, and keyword for keyword triggers', () => {
    const empty = validateJourney(draft([], { name: ' ' }));
    assert.equal(empty.ok, false);
    assert.ok(empty.errors.some((e) => e.includes('name')));
    assert.ok(empty.errors.some((e) => e.includes('at least one step')));

    const kw = validateJourney(
      draft([{ id: 's1', kind: 'send', templateId: 't' }], {
        trigger: { kind: 'inbound_keyword', keyword: '' },
      }),
    );
    assert.ok(kw.errors.some((e) => e.includes('keyword')));
  });

  it('flags missing templates, bad waits, and duplicate ids', () => {
    const res = validateJourney(
      draft([
        { id: 's1', kind: 'send', templateId: '' },
        { id: 's1', kind: 'wait', durationMs: 0 },
      ]),
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.includes('pick a template')));
    assert.ok(res.errors.some((e) => e.includes('duration must be positive')));
    assert.ok(res.errors.some((e) => e.includes('Duplicate step id')));
  });

  it('rejects orphan branch and waitUntil targets', () => {
    const res = validateJourney(
      draft([
        {
          id: 'b1',
          kind: 'branch',
          condition: { field: 'plan', op: 'eq', value: 'pro' },
          trueStepId: 'nope',
          falseStepId: 's1',
        },
        { id: 's1', kind: 'send', templateId: 'tplA' },
        {
          id: 'wu',
          kind: 'waitUntil',
          event: 'replied',
          timeoutMs: 1000,
          onEventStepId: 'ghost',
        },
      ]),
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.includes('missing step "nope"')));
    assert.ok(res.errors.some((e) => e.includes('missing step "ghost"')));
  });

  it('validates A/B variants (template + positive weight)', () => {
    const res = validateJourney(
      draft([
        {
          id: 's1',
          kind: 'send',
          templateId: 'tplA',
          abVariants: [
            { templateId: 'tplA', weight: 1 },
            { templateId: '', weight: 0 },
          ],
        },
      ]),
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.includes('variant 2 needs a template')));
    assert.ok(res.errors.some((e) => e.includes('variant 2 needs a positive weight')));
  });

  it('warns about unreachable steps and unmapped Pinpoint conditions', () => {
    const res = validateJourney(
      draft([
        { id: 's1', kind: 'send', templateId: 'tplA' },
        { id: 'e1', kind: 'exit' },
        { id: 'lost', kind: 'send', templateId: 'tplB' },
        {
          id: 'b1',
          kind: 'branch',
          condition: { field: '__pinpoint_unmapped', op: 'eq', value: 'true' },
          trueStepId: 's1',
          falseStepId: 'e1',
        },
      ]),
    );
    assert.equal(res.ok, true);
    assert.ok(res.warnings.some((w) => w.includes('"lost"')));
    assert.ok(res.warnings.some((w) => w.includes('Pinpoint')));
  });
});
