/**
 * Unit tests for the data-quality PURE scorer (`../data-quality-score`).
 *   npx tsx --test src/lib/sabcrm/__tests__/data-quality-score.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FieldMetadata } from '../types';
import type { ValidationRule } from '../validation';
import {
  isValueEmpty,
  completenessFields,
  scoreCompleteness,
  scoreValidity,
  scoreFreshness,
  scoreRecord,
  summarizeObjectHealth,
  issueSeverity,
  FRESHNESS_HALF_LIFE_DAYS,
  FRESHNESS_STALE_DAYS,
  type DataQualityIssue,
} from '../data-quality-score';

const NOW = Date.parse('2026-06-13T00:00:00.000Z');

function field(
  key: string,
  extra: Partial<FieldMetadata> = {},
): FieldMetadata {
  return { key, label: key, type: 'TEXT', ...extra };
}

function rule(
  id: string,
  cond: ValidationRule['condition'],
  extra: Partial<ValidationRule> = {},
): ValidationRule {
  return { id, condition: cond, severity: 'warn', message: `${id} failed`, ...extra };
}

describe('isValueEmpty', () => {
  it('treats blank, null, empty array/object as empty', () => {
    assert.equal(isValueEmpty(undefined), true);
    assert.equal(isValueEmpty(null), true);
    assert.equal(isValueEmpty('   '), true);
    assert.equal(isValueEmpty([]), true);
    assert.equal(isValueEmpty({}), true);
    assert.equal(isValueEmpty(Number.NaN), true);
    assert.equal(isValueEmpty({ first: '', last: '' }), true);
  });
  it('treats present values as non-empty', () => {
    assert.equal(isValueEmpty('x'), false);
    assert.equal(isValueEmpty(0), false);
    assert.equal(isValueEmpty(false), false);
    assert.equal(isValueEmpty(['a']), false);
    assert.equal(isValueEmpty({ first: 'A' }), false);
  });
});

describe('completenessFields', () => {
  it('drops __meta, system, AI, and score/scoreTier fields', () => {
    const defs: FieldMetadata[] = [
      field('name'),
      field('email'),
      field('__internal'),
      field('createdBy', { system: true }),
      field('summary', { type: 'AI' }),
      field('score', { type: 'NUMBER' }),
      field('scoreTier', { type: 'SELECT' }),
    ];
    const keys = completenessFields(defs).map((f) => f.key);
    assert.deepEqual(keys, ['name', 'email']);
  });
});

describe('scoreCompleteness', () => {
  it('is 100 with no gradable fields', () => {
    assert.equal(scoreCompleteness({}, [], []), 100);
  });
  it('weights required fields double and records issues', () => {
    const fields = [field('name', { required: true }), field('email')];
    const issues: DataQualityIssue[] = [];
    // name (req, weight 2) empty, email (weight 1) present -> earned 1 / total 3
    const pct = scoreCompleteness({ email: 'a@b.com' }, fields, issues);
    assert.equal(pct, 33);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'missing-required');
    assert.equal(issues[0].ref, 'name');
  });
  it('is 100 when every field is filled', () => {
    const fields = [field('name'), field('email')];
    assert.equal(
      scoreCompleteness({ name: 'A', email: 'a@b.com' }, fields, []),
      100,
    );
  });
});

describe('scoreValidity', () => {
  it('is 100 when no rules apply', () => {
    assert.equal(scoreValidity({}, [], []), 100);
    assert.equal(scoreValidity({}, undefined, []), 100);
  });
  it('drops score for a fired rule, weighting block double', () => {
    // violation condition: amount <= 0  -> fires for amount 0
    const rules = [
      rule('r-amount', { field: 'amount', op: 'lte', value: 0 }, { severity: 'block' }),
      rule('r-email', { field: 'email', op: 'isEmpty' }, { severity: 'warn' }),
    ];
    const issues: DataQualityIssue[] = [];
    // amount=0 fires (block, w2); email present -> ok (warn, w1). earned 1/3
    const pct = scoreValidity({ amount: 0, email: 'a@b.com' }, rules, issues);
    assert.equal(pct, 33);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'invalid-block');
  });
  it('skips disabled rules', () => {
    const rules = [
      rule('r1', { field: 'x', op: 'isEmpty' }, { enabled: false }),
    ];
    assert.equal(scoreValidity({}, rules, []), 100);
  });
});

describe('scoreFreshness', () => {
  it('returns 50 for missing/unparseable updatedAt', () => {
    assert.equal(scoreFreshness(null, NOW, []), 50);
    assert.equal(scoreFreshness('', NOW, []), 50);
    assert.equal(scoreFreshness('not-a-date', NOW, []), 50);
  });
  it('is ~100 when just updated', () => {
    assert.equal(scoreFreshness(new Date(NOW).toISOString(), NOW, []), 100);
  });
  it('halves at the half-life', () => {
    const at = new Date(NOW - FRESHNESS_HALF_LIFE_DAYS * 86_400_000).toISOString();
    assert.equal(scoreFreshness(at, NOW, []), 50);
  });
  it('is 0 + stale issue past the stale horizon', () => {
    const issues: DataQualityIssue[] = [];
    const at = new Date(NOW - (FRESHNESS_STALE_DAYS + 10) * 86_400_000).toISOString();
    assert.equal(scoreFreshness(at, NOW, issues), 0);
    assert.equal(issues[0].kind, 'stale');
  });
});

describe('scoreRecord', () => {
  it('combines axes and drops validity when no rules', () => {
    const fields = [field('name'), field('email')];
    const r = scoreRecord(
      { data: { name: 'A', email: 'a@b.com' }, updatedAt: new Date(NOW).toISOString() },
      fields,
      [],
      NOW,
    );
    // completeness 100, freshness 100, validity dropped -> overall 100
    assert.equal(r.completeness, 100);
    assert.equal(r.freshness, 100);
    assert.equal(r.validity, 100); // axis value still reported (just not weighted)
    assert.equal(r.overall, 100);
    assert.equal(r.issues.length, 0);
  });
  it('includes validity in the mean when rules exist', () => {
    const fields = [field('name')];
    const rules = [rule('r1', { field: 'name', op: 'isEmpty' }, { severity: 'block' })];
    const r = scoreRecord(
      { data: {}, updatedAt: new Date(NOW).toISOString() },
      fields,
      rules,
      NOW,
    );
    // completeness 0 (name empty), validity 0 (rule fires), freshness 100.
    // weights .4/.4/.2 all apply -> overall = (0*.4 + 0*.4 + 100*.2)/1 = 20
    assert.equal(r.completeness, 0);
    assert.equal(r.validity, 0);
    assert.equal(r.freshness, 100);
    assert.equal(r.overall, 20);
    // issues sorted worst-first: invalid-block before missing
    assert.ok(r.issues.length >= 2);
    assert.equal(r.issues[0].kind, 'invalid-block');
  });
  it('never throws on a malformed record', () => {
    const r = scoreRecord({} as never, [], [], NOW);
    assert.equal(r.overall >= 0 && r.overall <= 100, true);
  });
});

describe('issueSeverity', () => {
  it('orders block > missing-required > warn > stale > missing', () => {
    assert.ok(issueSeverity('invalid-block') > issueSeverity('missing-required'));
    assert.ok(issueSeverity('missing-required') > issueSeverity('invalid-warn'));
    assert.ok(issueSeverity('invalid-warn') > issueSeverity('stale'));
    assert.ok(issueSeverity('stale') > issueSeverity('missing'));
  });
});

describe('summarizeObjectHealth', () => {
  it('averages axes and surfaces the worst records first', () => {
    const mk = (id: string, overall: number) => ({
      id,
      label: `rec ${id}`,
      score: {
        completeness: overall,
        validity: overall,
        freshness: overall,
        overall,
        issues: [],
      },
    });
    const summary = summarizeObjectHealth(
      'companies',
      [mk('a', 90), mk('b', 10), mk('c', 50)],
      2,
    );
    assert.equal(summary.count, 3);
    assert.equal(summary.avgOverall, 50);
    assert.equal(summary.avgCompleteness, 50);
    assert.equal(summary.worst.length, 2);
    assert.equal(summary.worst[0].id, 'b'); // lowest first
    assert.equal(summary.worst[1].id, 'c');
  });
  it('handles an empty batch', () => {
    const s = summarizeObjectHealth('companies', [], 5);
    assert.equal(s.count, 0);
    assert.equal(s.avgOverall, 0);
    assert.deepEqual(s.worst, []);
  });
});
