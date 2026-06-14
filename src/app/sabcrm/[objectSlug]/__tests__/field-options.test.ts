/**
 * Unit tests for the value-set field-option mapping helpers (`../field-options`).
 *
 * Run: npx tsx --test "src/app/sabcrm/[objectSlug]/__tests__/field-options.test.ts"
 *
 * The module is React/CSS/server-only-free by contract, so these run under the
 * plain node test runner via tsx.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { FieldMetadata, FieldOption } from '@/lib/sabcrm/types';
import {
  isPicklistField,
  fieldReferencesValueSet,
  applyResolvedOptions,
  applyResolvedOptionsToFields,
  valueSetFieldKeys,
} from '../field-options';

const inline: FieldOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const resolvedOpts: FieldOption[] = [
  { value: 'x', label: 'Xenon', color: 'blue' },
  { value: 'y', label: 'Yttrium' },
];

function field(partial: Partial<FieldMetadata>): FieldMetadata {
  return { key: 'k', label: 'K', type: 'TEXT', ...partial };
}

/* ---------------------------------------------------- isPicklistField */

test('isPicklistField: SELECT and MULTI_SELECT only', () => {
  assert.equal(isPicklistField(field({ type: 'SELECT' })), true);
  assert.equal(isPicklistField(field({ type: 'MULTI_SELECT' })), true);
  assert.equal(isPicklistField(field({ type: 'TEXT' })), false);
  assert.equal(isPicklistField(field({ type: 'RELATION' })), false);
});

/* ---------------------------------------------- fieldReferencesValueSet */

test('fieldReferencesValueSet: true for SELECT with a non-blank valueSetId', () => {
  assert.equal(
    fieldReferencesValueSet(
      field({ type: 'SELECT', settings: { valueSetId: 'vs1' } }),
    ),
    true,
  );
  assert.equal(
    fieldReferencesValueSet(
      field({ type: 'MULTI_SELECT', settings: { valueSetId: 'vs2' } }),
    ),
    true,
  );
});

test('fieldReferencesValueSet: false when no/blank/non-string valueSetId', () => {
  assert.equal(fieldReferencesValueSet(field({ type: 'SELECT' })), false);
  assert.equal(
    fieldReferencesValueSet(field({ type: 'SELECT', settings: {} })),
    false,
  );
  assert.equal(
    fieldReferencesValueSet(
      field({ type: 'SELECT', settings: { valueSetId: '   ' } }),
    ),
    false,
  );
  assert.equal(
    fieldReferencesValueSet(
      field({ type: 'SELECT', settings: { valueSetId: 42 as unknown as string } }),
    ),
    false,
  );
});

test('fieldReferencesValueSet: false for non-picklist even with valueSetId', () => {
  assert.equal(
    fieldReferencesValueSet(
      field({ type: 'TEXT', settings: { valueSetId: 'vs1' } }),
    ),
    false,
  );
});

/* -------------------------------------------------- applyResolvedOptions */

test('applyResolvedOptions: swaps options for a SELECT with a resolved entry', () => {
  const f = field({ key: 'industry', type: 'SELECT', options: inline });
  const out = applyResolvedOptions(f, { industry: resolvedOpts });
  assert.deepEqual(out.options, resolvedOpts);
  // Original field untouched (no mutation).
  assert.deepEqual(f.options, inline);
});

test('applyResolvedOptions: keeps inline options when no resolved entry', () => {
  const f = field({ key: 'industry', type: 'SELECT', options: inline });
  const out = applyResolvedOptions(f, {});
  assert.equal(out, f); // SAME reference — degrade to inline
  assert.deepEqual(out.options, inline);
});

test('applyResolvedOptions: keeps inline options when resolved list is empty', () => {
  const f = field({ key: 'industry', type: 'SELECT', options: inline });
  const out = applyResolvedOptions(f, { industry: [] });
  assert.equal(out, f);
  assert.deepEqual(out.options, inline);
});

test('applyResolvedOptions: never swaps for a non-picklist field', () => {
  const f = field({ key: 'name', type: 'TEXT', options: inline });
  const out = applyResolvedOptions(f, { name: resolvedOpts });
  assert.equal(out, f);
});

/* ----------------------------------------- applyResolvedOptionsToFields */

test('applyResolvedOptionsToFields: returns same array when nothing changed', () => {
  const fields = [
    field({ key: 'name', type: 'TEXT' }),
    field({ key: 'stage', type: 'SELECT', options: inline }),
  ];
  const out = applyResolvedOptionsToFields(fields, {});
  assert.equal(out, fields); // identity preserved (memo-friendly)
});

test('applyResolvedOptionsToFields: maps only the resolved picklist field', () => {
  const fields = [
    field({ key: 'name', type: 'TEXT' }),
    field({ key: 'stage', type: 'SELECT', options: inline }),
    field({ key: 'tags', type: 'MULTI_SELECT', options: inline }),
  ];
  const out = applyResolvedOptionsToFields(fields, { stage: resolvedOpts });
  assert.notEqual(out, fields);
  assert.equal(out[0], fields[0]); // unchanged ref
  assert.deepEqual(out[1].options, resolvedOpts);
  assert.equal(out[2], fields[2]); // no entry → unchanged ref
});

/* ----------------------------------------------------- valueSetFieldKeys */

test('valueSetFieldKeys: returns only value-set-referencing picklist keys', () => {
  const fields = [
    field({ key: 'name', type: 'TEXT' }),
    field({ key: 'industry', type: 'SELECT', settings: { valueSetId: 'vs1' } }),
    field({ key: 'stage', type: 'SELECT', options: inline }), // inline only
    field({ key: 'tags', type: 'MULTI_SELECT', settings: { valueSetId: 'vs2' } }),
  ];
  assert.deepEqual(valueSetFieldKeys(fields), ['industry', 'tags']);
});

test('valueSetFieldKeys: empty when no field references a value-set', () => {
  const fields = [
    field({ key: 'name', type: 'TEXT' }),
    field({ key: 'stage', type: 'SELECT', options: inline }),
  ];
  assert.deepEqual(valueSetFieldKeys(fields), []);
});
