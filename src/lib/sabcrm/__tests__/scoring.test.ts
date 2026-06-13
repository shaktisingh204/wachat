/**
 * Unit tests for the rule-based scoring PURE helpers (`../scoring`).
 *
 * Runs with Node's built-in `node:test` + `tsx` (no extra deps):
 *   npx tsx --test src/lib/sabcrm/__tests__/scoring.test.ts
 *
 * The impure half (`scoring.server.ts` — Mongo, field provisioning) carries
 * `'server-only'` and is deliberately NOT imported here (gate-security.test.ts
 * precedent).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evalCondition,
  computeScore,
  resolveTier,
  scoringSourceFields,
  type ScoringRule,
  type ScoreTier,
} from '../scoring';

function rule(
  field: string,
  op: ScoringRule['condition']['op'],
  value: unknown,
  points: number,
): ScoringRule {
  return { id: `${field}-${op}`, condition: { field, op, value }, points };
}

describe('evalCondition', () => {
  const data = {
    stage: 'won',
    amount: 5000,
    email: 'a@b.com',
    employees: 0,
    title: '',
    tags: ['vip', 'enterprise'],
  };

  it('eq / neq (string + numeric coercion)', () => {
    assert.equal(evalCondition(data, { field: 'stage', op: 'eq', value: 'won' }), true);
    assert.equal(evalCondition(data, { field: 'stage', op: 'eq', value: 'WON' }), true); // case-insensitive
    assert.equal(evalCondition(data, { field: 'amount', op: 'eq', value: '5000' }), true); // numeric coercion
    assert.equal(evalCondition(data, { field: 'stage', op: 'neq', value: 'lost' }), true);
  });

  it('numeric comparisons', () => {
    assert.equal(evalCondition(data, { field: 'amount', op: 'gt', value: 1000 }), true);
    assert.equal(evalCondition(data, { field: 'amount', op: 'gte', value: 5000 }), true);
    assert.equal(evalCondition(data, { field: 'amount', op: 'lt', value: 1000 }), false);
    assert.equal(evalCondition(data, { field: 'amount', op: 'lte', value: 5000 }), true);
    // non-numeric value → no match (never throws)
    assert.equal(evalCondition(data, { field: 'amount', op: 'gt', value: 'abc' }), false);
  });

  it('contains / notContains (case-insensitive substring)', () => {
    assert.equal(evalCondition(data, { field: 'email', op: 'contains', value: '@b.com' }), true);
    assert.equal(evalCondition(data, { field: 'email', op: 'contains', value: 'NOPE' }), false);
    assert.equal(evalCondition(data, { field: 'email', op: 'notContains', value: 'x' }), true);
  });

  it('in / notIn against arrays', () => {
    assert.equal(evalCondition(data, { field: 'stage', op: 'in', value: ['won', 'lost'] }), true);
    assert.equal(evalCondition(data, { field: 'stage', op: 'notIn', value: ['lost'] }), true);
  });

  it('isEmpty / isNotEmpty (missing, "", 0, [])', () => {
    assert.equal(evalCondition(data, { field: 'title', op: 'isEmpty' }), true); // empty string
    assert.equal(evalCondition(data, { field: 'missing', op: 'isEmpty' }), true); // absent
    assert.equal(evalCondition(data, { field: 'employees', op: 'isEmpty' }), false); // 0 is NOT empty
    assert.equal(evalCondition(data, { field: 'tags', op: 'isNotEmpty' }), true);
  });

  it('returns false for a blank field key', () => {
    assert.equal(evalCondition(data, { field: '', op: 'eq', value: 'x' }), false);
  });
});

describe('resolveTier', () => {
  const tiers: ScoreTier[] = [
    { min: 0, label: 'Cold' },
    { min: 30, label: 'Warm' },
    { min: 60, label: 'Hot' },
  ];
  it('picks the highest tier the score reaches', () => {
    assert.equal(resolveTier(tiers, 0)?.label, 'Cold');
    assert.equal(resolveTier(tiers, 45)?.label, 'Warm');
    assert.equal(resolveTier(tiers, 100)?.label, 'Hot');
  });
  it('returns null below the lowest min and for no tiers', () => {
    assert.equal(resolveTier(tiers, -5), null);
    assert.equal(resolveTier([], 50), null);
  });
});

describe('computeScore', () => {
  const rules: ScoringRule[] = [
    rule('stage', 'eq', 'won', 50),
    rule('amount', 'gte', 1000, 30),
    rule('country', 'eq', 'US', 20), // won't match (absent)
    rule('email', 'isEmpty', undefined, -100),
  ];
  const tiers: ScoreTier[] = [
    { min: 0, label: 'Cold' },
    { min: 60, label: 'Hot' },
  ];

  it('sums matching rule points and resolves the tier', () => {
    const res = computeScore({ rules, tiers }, { stage: 'won', amount: 5000, email: 'a@b.com' });
    assert.equal(res.score, 80); // 50 + 30
    assert.equal(res.tier?.label, 'Hot');
    assert.deepEqual(res.matched.sort(), ['amount-gte', 'stage-eq']);
  });

  it('applies negative points and can drop below the lowest tier', () => {
    const res = computeScore({ rules, tiers }, { stage: 'lost', amount: 10, email: '' });
    assert.equal(res.score, -100); // only the isEmpty rule fires
    assert.equal(res.tier, null);
  });

  it('ignores non-finite points safely', () => {
    const res = computeScore(
      { rules: [{ id: 'x', condition: { field: 'a', op: 'eq', value: 1 }, points: NaN }], tiers: [] },
      { a: 1 },
    );
    assert.equal(res.score, 0);
  });
});

describe('scoringSourceFields', () => {
  it('collects the distinct field keys referenced by the rules', () => {
    const fields = scoringSourceFields({
      rules: [rule('stage', 'eq', 'won', 1), rule('amount', 'gt', 1, 1), rule('stage', 'neq', 'x', 1)],
    });
    assert.deepEqual(fields.sort(), ['amount', 'stage']);
  });
});
