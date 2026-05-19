/**
 * Tests for the resourceLocator value extractor — normalises the
 * `{ mode, value }` shape into the plain string id an action expects.
 *
 *   npx tsx --test src/lib/sabflow/forge/__tests__/extractValue.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { extractValue, isResourceLocatorValue } from '../extractValue';
import type { ForgeFieldMode } from '../types';

const slackModes: ForgeFieldMode[] = [
  { name: 'list', displayName: 'From list', type: 'list' },
  {
    name: 'url',
    displayName: 'By URL',
    type: 'string',
    extractValue: { type: 'regex', regex: 'archives/([A-Z0-9]+)' },
  },
  { name: 'id', displayName: 'By ID', type: 'string' },
];

const discordModes: ForgeFieldMode[] = [
  { name: 'list', displayName: 'From list', type: 'list' },
  {
    name: 'url',
    displayName: 'By URL',
    type: 'string',
    extractValue: {
      type: 'regex',
      regex: 'discord\\.com/channels/[0-9]+/([0-9]+)',
    },
  },
  { name: 'id', displayName: 'By ID', type: 'string' },
];

test('extracts via regex group 1 for url mode', () => {
  assert.equal(
    extractValue({ mode: 'url', value: 'https://app.slack.com/archives/C0123ABC' }, slackModes),
    'C0123ABC',
  );
});

test('extracts via regex for a Discord URL', () => {
  assert.equal(
    extractValue(
      { mode: 'url', value: 'https://discord.com/channels/999/12345' },
      discordModes,
    ),
    '12345',
  );
});

test('falls back to raw value when regex does not match', () => {
  assert.equal(
    extractValue(
      { mode: 'url', value: 'https://nope.example/no-match-here' },
      slackModes,
    ),
    'https://nope.example/no-match-here',
  );
});

test('list mode returns value as-is (already an id)', () => {
  assert.equal(
    extractValue({ mode: 'list', value: 'C99' }, slackModes),
    'C99',
  );
});

test('id mode returns value as-is', () => {
  assert.equal(
    extractValue({ mode: 'id', value: 'C99' }, slackModes),
    'C99',
  );
});

test('plain-string input passes through (back-compat with legacy fields)', () => {
  assert.equal(extractValue('C01', slackModes), 'C01');
});

test('null / undefined → empty string', () => {
  assert.equal(extractValue(null, slackModes), '');
  assert.equal(extractValue(undefined, slackModes), '');
});

test('empty modes list → value as-is (no extraction attempted)', () => {
  assert.equal(
    extractValue({ mode: 'url', value: 'https://x/123' }, undefined),
    'https://x/123',
  );
});

test('invalid regex in mode declaration is caught — does not throw', () => {
  const broken: ForgeFieldMode[] = [
    {
      name: 'url',
      displayName: 'By URL',
      type: 'string',
      // Unterminated character class — would crash naive callers.
      extractValue: { type: 'regex', regex: '[unterminated' },
    },
  ];
  assert.doesNotThrow(() => {
    const out = extractValue({ mode: 'url', value: 'whatever' }, broken);
    assert.equal(out, 'whatever');
  });
});

test('isResourceLocatorValue type guard', () => {
  assert.equal(isResourceLocatorValue({ mode: 'id', value: 'x' }), true);
  assert.equal(isResourceLocatorValue('plain string'), false);
  assert.equal(isResourceLocatorValue(null), false);
  assert.equal(isResourceLocatorValue(undefined), false);
  assert.equal(isResourceLocatorValue({ mode: 'id' }), false);
  assert.equal(isResourceLocatorValue({ value: 'x' }), false);
  assert.equal(isResourceLocatorValue({ mode: 'bogus', value: 'x' }), false);
});
