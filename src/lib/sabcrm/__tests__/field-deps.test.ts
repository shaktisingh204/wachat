/**
 * Unit tests for the PURE field-dependency logic (`../field-deps`).
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/field-deps.test.ts`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allowedOptions,
  allowedOptionsOrNull,
  isComboValid,
  type DependencyRule,
} from '../field-deps';

const MAP: Record<string, string[]> = {
  US: ['CA', 'NY', 'TX'],
  IN: ['MH', 'KA', 'DL'],
  // explicit empty list → unrestricted
  CA_COUNTRY: [],
};

test('allowedOptions returns the mapped list for a known controlling value', () => {
  assert.deepEqual(allowedOptions('US', MAP), ['CA', 'NY', 'TX']);
  assert.deepEqual(allowedOptions('IN', MAP), ['MH', 'KA', 'DL']);
});

test('allowedOptions returns [] (no restriction) for un-mapped / empty controlling values', () => {
  assert.deepEqual(allowedOptions('FR', MAP), []); // not in map
  assert.deepEqual(allowedOptions('', MAP), []); // empty
  assert.deepEqual(allowedOptions(null, MAP), []);
  assert.deepEqual(allowedOptions(undefined, MAP), []);
  assert.deepEqual(allowedOptions('CA_COUNTRY', MAP), []); // explicit empty list
});

test('allowedOptions tolerates an absent map', () => {
  assert.deepEqual(allowedOptions('US', undefined), []);
  assert.deepEqual(allowedOptions('US', null), []);
});

test('allowedOptionsOrNull distinguishes "all" (null) from "exactly these"', () => {
  assert.equal(allowedOptionsOrNull('FR', MAP), null);
  assert.equal(allowedOptionsOrNull('', MAP), null);
  assert.deepEqual(allowedOptionsOrNull('US', MAP), ['CA', 'NY', 'TX']);
});

test('allowedOptions de-dupes and drops empties, preserving authored order', () => {
  const m = { X: ['a', 'a', '', 'b', 'a', 'c'] };
  assert.deepEqual(allowedOptions('X', m), ['a', 'b', 'c']);
});

test('allowedOptions coerces non-string controlling keys', () => {
  const m = { '1': ['one'], 'true': ['yes'] };
  assert.deepEqual(allowedOptions(1, m), ['one']);
  assert.deepEqual(allowedOptions(true, m), ['yes']);
});

test('isComboValid enforces the allow-list when restricted', () => {
  assert.equal(isComboValid('US', 'CA', MAP), true);
  assert.equal(isComboValid('US', 'MH', MAP), false); // MH is an IN state
  assert.equal(isComboValid('IN', 'DL', MAP), true);
  assert.equal(isComboValid('IN', 'NY', MAP), false);
});

test('isComboValid allows any dependent value when unrestricted', () => {
  assert.equal(isComboValid('FR', 'anything', MAP), true); // controlling un-mapped
  assert.equal(isComboValid('', 'anything', MAP), true); // no controlling value
  assert.equal(isComboValid('CA_COUNTRY', 'anything', MAP), true); // empty allow-list
});

test('isComboValid treats an empty dependent value as valid (required-ness is a separate concern)', () => {
  assert.equal(isComboValid('US', '', MAP), true);
  assert.equal(isComboValid('US', null, MAP), true);
  assert.equal(isComboValid('US', undefined, MAP), true);
});

test('DependencyRule shape is structurally usable', () => {
  const rule: DependencyRule = {
    object: 'leads',
    controllingField: 'country',
    dependentField: 'state',
    map: MAP,
  };
  assert.equal(isComboValid(rule.map.US ? 'US' : '', 'CA', rule.map), true);
  assert.deepEqual(allowedOptions('IN', rule.map), ['MH', 'KA', 'DL']);
});
