/**
 * NL filter validation walk — unit tests for `nlFilterFromModelJson`
 * (intelligence.md Part B, work item 20).
 *
 * Run: npx tsx --test "src/app/sabcrm/[objectSlug]/__tests__/nl-filter.test.ts"
 *
 * The adapter module is React/CSS/server-only-free by contract, so these run
 * under the plain node test runner via tsx.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nlFilterFromModelJson,
  type NlCatalogueField,
} from '../record-surface-adapter';

const FIELDS: NlCatalogueField[] = [
  { key: 'name', type: 'TEXT' },
  { key: 'employees', type: 'NUMBER' },
  { key: 'createdAt', type: 'DATE_TIME' },
  {
    key: 'stage',
    type: 'SELECT',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed_won', label: 'Closed won' },
    ],
  },
];

test('valid minified JSON parses into a pruned FilterGroup', () => {
  const raw =
    '{"op":"and","conditions":[{"fieldKey":"createdAt","op":"gte","value":"2026-05-01"},{"fieldKey":"createdAt","op":"lte","value":"2026-05-31"}]}';
  const out = nlFilterFromModelJson(raw, FIELDS);
  assert.ok(out);
  assert.equal(out.group.op, 'and');
  assert.deepEqual(out.group.conditions, [
    { fieldKey: 'createdAt', op: 'gte', value: '2026-05-01' },
    { fieldKey: 'createdAt', op: 'lte', value: '2026-05-31' },
  ]);
  assert.equal(out.unresolved, undefined);
});

test('```json fenced replies are stripped before parsing', () => {
  const raw =
    '```json\n{"op":"or","conditions":[{"fieldKey":"name","op":"contains","value":"acme"}]}\n```';
  const out = nlFilterFromModelJson(raw, FIELDS);
  assert.ok(out);
  assert.equal(out.group.op, 'or');
  assert.deepEqual(out.group.conditions, [
    { fieldKey: 'name', op: 'contains', value: 'acme' },
  ]);
});

test('prose around the JSON falls back to the embedded object', () => {
  const raw =
    'Here is the filter you asked for: {"op":"and","conditions":[{"fieldKey":"name","op":"eq","value":"Acme"}]} — hope that helps!';
  const out = nlFilterFromModelJson(raw, FIELDS);
  assert.ok(out);
  assert.deepEqual(out.group.conditions, [
    { fieldKey: 'name', op: 'eq', value: 'Acme' },
  ]);
});

test('unknown field keys are dropped; all-invalid trees return null', () => {
  const mixed =
    '{"op":"and","conditions":[{"fieldKey":"bogus","op":"eq","value":"x"},{"fieldKey":"name","op":"eq","value":"Acme"}]}';
  const out = nlFilterFromModelJson(mixed, FIELDS);
  assert.ok(out);
  assert.deepEqual(out.group.conditions, [
    { fieldKey: 'name', op: 'eq', value: 'Acme' },
  ]);

  const allBad =
    '{"op":"and","conditions":[{"fieldKey":"bogus","op":"eq","value":"x"}]}';
  assert.equal(nlFilterFromModelJson(allBad, FIELDS), null);
});

test('SELECT labels map onto option values case-insensitively; non-options fail closed', () => {
  const byLabel =
    '{"op":"and","conditions":[{"fieldKey":"stage","op":"eq","value":"closed WON"}]}';
  const out = nlFilterFromModelJson(byLabel, FIELDS);
  assert.ok(out);
  assert.deepEqual(out.group.conditions, [
    { fieldKey: 'stage', op: 'eq', value: 'closed_won' },
  ]);

  const byValue =
    '{"op":"and","conditions":[{"fieldKey":"stage","op":"eq","value":"OPEN"}]}';
  const out2 = nlFilterFromModelJson(byValue, FIELDS);
  assert.ok(out2);
  assert.deepEqual(out2.group.conditions, [
    { fieldKey: 'stage', op: 'eq', value: 'open' },
  ]);

  const nonOption =
    '{"op":"and","conditions":[{"fieldKey":"stage","op":"eq","value":"galactic"}]}';
  assert.equal(nlFilterFromModelJson(nonOption, FIELDS), null);
});

test('operators normalise via normalizeOp (neq → ne, junk → eq); `field` alias accepted', () => {
  const raw =
    '{"op":"and","conditions":[{"field":"name","op":"neq","value":"Acme"},{"fieldKey":"employees","op":"wat","value":"10"}]}';
  const out = nlFilterFromModelJson(raw, FIELDS);
  assert.ok(out);
  assert.deepEqual(out.group.conditions, [
    { fieldKey: 'name', op: 'ne', value: 'Acme' },
    { fieldKey: 'employees', op: 'eq', value: '10' },
  ]);
});

test('unary ops keep no value; binary ops without a value are pruned', () => {
  const raw =
    '{"op":"and","conditions":[{"fieldKey":"stage","op":"isEmpty"},{"fieldKey":"name","op":"eq"}]}';
  const out = nlFilterFromModelJson(raw, FIELDS);
  assert.ok(out);
  assert.deepEqual(out.group.conditions, [{ fieldKey: 'stage', op: 'isEmpty' }]);
});

test('nested groups survive to depth 3; deeper sub-groups are dropped', () => {
  const nested = {
    op: 'and',
    conditions: [
      {
        op: 'or',
        conditions: [
          { fieldKey: 'name', op: 'contains', value: 'a' },
          {
            op: 'and',
            conditions: [
              { fieldKey: 'employees', op: 'gt', value: '10' },
              {
                op: 'or',
                conditions: [{ fieldKey: 'name', op: 'eq', value: 'deep' }],
              },
            ],
          },
        ],
      },
    ],
  };
  const out = nlFilterFromModelJson(JSON.stringify(nested), FIELDS);
  assert.ok(out);
  // depth 1 (or) → depth 2 (and) → depth 3 (or) all survive
  const level1 = out.group.conditions[0] as { op: string; conditions: unknown[] };
  assert.equal(level1.op, 'or');
  assert.equal(level1.conditions.length, 2);

  const tooDeep = {
    op: 'and', // depth 0 (root)
    conditions: [
      {
        op: 'and', // depth 1
        conditions: [
          {
            op: 'and', // depth 2
            conditions: [
              {
                op: 'and', // depth 3 — deepest legal group
                conditions: [
                  {
                    op: 'and', // depth 4 — beyond maxDepth, must be dropped
                    conditions: [{ fieldKey: 'name', op: 'eq', value: 'x' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(nlFilterFromModelJson(JSON.stringify(tooDeep), FIELDS), null);
});

test('top-level unresolved note rides along (trimmed)', () => {
  const raw =
    '{"op":"and","conditions":[{"fieldKey":"name","op":"eq","value":"Acme"}],"unresolved":"  could not express “near Berlin”  "}';
  const out = nlFilterFromModelJson(raw, FIELDS);
  assert.ok(out);
  assert.equal(out.unresolved, 'could not express “near Berlin”');
});

test('non-JSON / non-object replies return null', () => {
  assert.equal(nlFilterFromModelJson('UNKNOWN', FIELDS), null);
  assert.equal(nlFilterFromModelJson('[]', FIELDS), null);
  assert.equal(nlFilterFromModelJson('"just a string"', FIELDS), null);
  assert.equal(nlFilterFromModelJson('', FIELDS), null);
});
