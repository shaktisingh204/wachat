/**
 * Unit tests for the PURE agentic helpers (`../ai-agentic`).
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/ai-agentic.test.ts`
 *
 * Covers the two safety-critical pure jobs:
 *  - NL → filter spec validation: accept valid leaves, REJECT unknown field /
 *    unknown operator / value-less misuse / Mongo-operator injection / oversized
 *    specs, and the bare-array + object reply forms.
 *  - Qualification parse/normalise: JSON happy path, verdict clamping, the
 *    0..100 confidence tolerance, and the non-JSON heuristic fallback.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  nlToFilterSpec,
  validateCondition,
  stripCodeFence,
  parseQualification,
  normalizeVerdict,
  clampConfidence,
  buildNlListPrompt,
  MAX_CONDITIONS,
  MAX_IN_MEMBERS,
  MAX_VALUE_LEN,
} from '../ai-agentic';

const FIELDS = new Set(['stage', 'amount', 'tier', 'email', 'name']);

/* -------------------------------------------------------------------------- */
/* validateCondition                                                          */
/* -------------------------------------------------------------------------- */

test('validateCondition accepts a valid scalar condition', () => {
  const c = validateCondition({ field: 'amount', op: 'gt', value: 1000 }, FIELDS);
  assert.deepEqual(c, { field: 'amount', op: 'gt', value: 1000 });
});

test('validateCondition accepts fieldKey/operator aliases', () => {
  const c = validateCondition({ fieldKey: 'stage', operator: 'eq', value: 'open' }, FIELDS);
  assert.deepEqual(c, { field: 'stage', op: 'eq', value: 'open' });
});

test('validateCondition accepts value-less ops with no value', () => {
  const c = validateCondition({ field: 'email', op: 'isEmpty' }, FIELDS);
  assert.deepEqual(c, { field: 'email', op: 'isEmpty' });
});

test('validateCondition wraps a scalar for an array op', () => {
  const c = validateCondition({ field: 'stage', op: 'in', value: 'open' }, FIELDS);
  assert.deepEqual(c, { field: 'stage', op: 'in', value: ['open'] });
});

test('validateCondition keeps a bounded array for in', () => {
  const c = validateCondition({ field: 'stage', op: 'in', value: ['open', 'won'] }, FIELDS);
  assert.deepEqual(c, { field: 'stage', op: 'in', value: ['open', 'won'] });
});

test('validateCondition REJECTS an unknown field', () => {
  assert.equal(validateCondition({ field: 'ssn', op: 'eq', value: 'x' }, FIELDS), null);
});

test('validateCondition REJECTS an unknown operator', () => {
  assert.equal(validateCondition({ field: 'amount', op: '$where', value: '1' }, FIELDS), null);
});

test('validateCondition REJECTS a Mongo-operator object smuggled as value', () => {
  assert.equal(
    validateCondition({ field: 'amount', op: 'eq', value: { $gt: 0 } }, FIELDS),
    null,
  );
});

test('validateCondition REJECTS a missing value for a comparison op', () => {
  assert.equal(validateCondition({ field: 'amount', op: 'gt' }, FIELDS), null);
});

test('validateCondition REJECTS an object array member (injection in `in`)', () => {
  assert.equal(
    validateCondition({ field: 'stage', op: 'in', value: ['open', { $ne: null }] }, FIELDS),
    null,
  );
});

test('validateCondition REJECTS an over-long string value', () => {
  const big = 'a'.repeat(MAX_VALUE_LEN + 1);
  assert.equal(validateCondition({ field: 'name', op: 'contains', value: big }, FIELDS), null);
});

test('validateCondition REJECTS an over-wide in array', () => {
  const many = Array.from({ length: MAX_IN_MEMBERS + 1 }, (_, i) => `v${i}`);
  assert.equal(validateCondition({ field: 'stage', op: 'in', value: many }, FIELDS), null);
});

/* -------------------------------------------------------------------------- */
/* nlToFilterSpec                                                             */
/* -------------------------------------------------------------------------- */

test('nlToFilterSpec accepts the object form and audit fields', () => {
  const res = nlToFilterSpec(
    JSON.stringify({
      conditions: [
        { field: 'stage', op: 'eq', value: 'open' },
        { field: 'createdAt', op: 'gte', value: '2026-05-01' },
      ],
      unresolved: 'nothing',
    }),
    FIELDS,
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.spec.conditions.length, 2);
    assert.equal(res.spec.unresolved, 'nothing');
  }
});

test('nlToFilterSpec accepts the bare-array form', () => {
  const res = nlToFilterSpec('[{"field":"amount","op":"gt","value":5000}]', FIELDS);
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.spec.conditions[0].field, 'amount');
});

test('nlToFilterSpec strips a ```json fence', () => {
  const res = nlToFilterSpec(
    '```json\n{"conditions":[{"field":"name","op":"contains","value":"acme"}]}\n```',
    FIELDS,
  );
  assert.equal(res.ok, true);
});

test('nlToFilterSpec DROPS unsafe leaves but keeps valid ones', () => {
  const res = nlToFilterSpec(
    JSON.stringify({
      conditions: [
        { field: 'ssn', op: 'eq', value: 'x' }, // unknown field — dropped
        { field: 'amount', op: 'gt', value: 1000 }, // valid — kept
      ],
    }),
    FIELDS,
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.spec.conditions.length, 1);
    assert.equal(res.spec.conditions[0].field, 'amount');
  }
});

test('nlToFilterSpec FAILS when nothing valid remains', () => {
  const res = nlToFilterSpec(
    JSON.stringify({ conditions: [{ field: 'ssn', op: '$where', value: '1' }] }),
    FIELDS,
  );
  assert.equal(res.ok, false);
});

test('nlToFilterSpec FAILS on non-JSON', () => {
  const res = nlToFilterSpec('I think you want open deals.', FIELDS);
  assert.equal(res.ok, false);
});

test('nlToFilterSpec FAILS when there is no conditions array', () => {
  const res = nlToFilterSpec(JSON.stringify({ foo: 'bar' }), FIELDS);
  assert.equal(res.ok, false);
});

test('nlToFilterSpec trims an over-long conditions array to the cap', () => {
  const many = Array.from({ length: MAX_CONDITIONS + 5 }, () => ({
    field: 'amount',
    op: 'gt',
    value: 1,
  }));
  const res = nlToFilterSpec(JSON.stringify({ conditions: many }), FIELDS);
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.spec.conditions.length, MAX_CONDITIONS);
});

/* -------------------------------------------------------------------------- */
/* stripCodeFence                                                             */
/* -------------------------------------------------------------------------- */

test('stripCodeFence leaves plain text alone', () => {
  assert.equal(stripCodeFence('{"a":1}'), '{"a":1}');
});

test('stripCodeFence removes a language-tagged fence', () => {
  assert.equal(stripCodeFence('```json\n{"a":1}\n```'), '{"a":1}');
});

/* -------------------------------------------------------------------------- */
/* normalizeVerdict / clampConfidence                                        */
/* -------------------------------------------------------------------------- */

test('normalizeVerdict maps the closed set + synonyms', () => {
  assert.equal(normalizeVerdict('qualified'), 'qualified');
  assert.equal(normalizeVerdict('Needs Review'), 'needs_review');
  assert.equal(normalizeVerdict('disqualified'), 'unqualified');
  assert.equal(normalizeVerdict('hot'), 'qualified');
  assert.equal(normalizeVerdict('something else'), 'unknown');
  assert.equal(normalizeVerdict(42), 'unknown');
});

test('clampConfidence clamps to [0,1] and tolerates a 0..100 scale', () => {
  assert.equal(clampConfidence(0.5), 0.5);
  assert.equal(clampConfidence(-1), 0);
  assert.equal(clampConfidence(2), 1);
  assert.equal(clampConfidence(80), 0.8); // 0..100 scale
  assert.equal(clampConfidence('0.25'), 0.25);
  assert.equal(clampConfidence('nope'), 0);
});

/* -------------------------------------------------------------------------- */
/* parseQualification                                                         */
/* -------------------------------------------------------------------------- */

test('parseQualification parses a clean JSON verdict', () => {
  const r = parseQualification(
    '{"verdict":"qualified","confidence":0.9,"reason":"Enterprise tier, $50k budget."}',
  );
  assert.equal(r.verdict, 'qualified');
  assert.equal(r.confidence, 0.9);
  assert.match(r.reason, /Enterprise/);
});

test('parseQualification accepts a fenced reply and rationale alias', () => {
  const r = parseQualification(
    '```json\n{"verdict":"needs_review","confidence":50,"rationale":"Missing budget."}\n```',
  );
  assert.equal(r.verdict, 'needs_review');
  assert.equal(r.confidence, 0.5);
  assert.equal(r.reason, 'Missing budget.');
});

test('parseQualification falls back to a heuristic for non-JSON prose', () => {
  const r = parseQualification('This lead looks qualified given the strong intent.');
  assert.equal(r.verdict, 'qualified');
  assert.equal(r.confidence, 0);
  assert.match(r.reason, /qualified/);
});

test('parseQualification bounds an over-long reason', () => {
  const long = 'x'.repeat(2000);
  const r = parseQualification(JSON.stringify({ verdict: 'qualified', confidence: 1, reason: long }));
  assert.ok(r.reason.length <= 600);
});

/* -------------------------------------------------------------------------- */
/* buildNlListPrompt                                                          */
/* -------------------------------------------------------------------------- */

test('buildNlListPrompt embeds the catalogue, the date anchor and the request', () => {
  const prompt = buildNlListPrompt(
    [
      { key: 'stage', label: 'Stage', type: 'SELECT', options: [{ value: 'open', label: 'Open' }] },
      { key: 'amount', label: 'Amount', type: 'NUMBER' },
    ],
    'open deals over 10k',
    '2026-06-13',
  );
  assert.match(prompt, /stage \| Stage \| SELECT \| options: open:Open/);
  assert.match(prompt, /amount \| Amount \| NUMBER/);
  assert.match(prompt, /Today's date: 2026-06-13/);
  assert.match(prompt, /Request: open deals over 10k/);
});
