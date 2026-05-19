/**
 * Unit tests for the Forge schema extensions added in Phase 1 of the
 * sabflow ↔ n8n parity plan. Runs with Node's built-in `node:test`:
 *
 *   npx tsx --test src/lib/sabflow/forge/__tests__/types.test.ts
 *
 * Covers:
 *   • ForgeField.loadOptionsDependsOn type-checks
 *   • ForgeField.displayOptions type-checks
 *   • ForgeLoadOptionsContext.getNodeParameter / getCurrentNodeParameter / getNode
 *   • isFieldVisible respects displayOptions.show / .hide and falls back to showIf
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  isFieldVisible,
  type ForgeField,
  type ForgeLoadOptionsContext,
  type ForgeFieldMode,
  type ResourceLocatorValue,
} from '../types';

test('ForgeField accepts loadOptionsDependsOn array', () => {
  const f: ForgeField = {
    id: 'property',
    label: 'Property',
    type: 'select',
    loadOptionsDependsOn: ['databaseId'],
    loadOptions: async () => [],
  };
  assert.deepEqual(f.loadOptionsDependsOn, ['databaseId']);
});

test('ForgeField accepts displayOptions.show', () => {
  const f: ForgeField = {
    id: 'pipeline',
    label: 'Pipeline',
    type: 'text',
    displayOptions: { show: { resource: ['deal'] } },
  };
  assert.deepEqual(f.displayOptions?.show, { resource: ['deal'] });
});

test('ForgeField accepts displayOptions.hide', () => {
  const f: ForgeField = {
    id: 'pipeline',
    label: 'Pipeline',
    type: 'text',
    displayOptions: { hide: { mode: ['readonly'] } },
  };
  assert.deepEqual(f.displayOptions?.hide, { mode: ['readonly'] });
});

test('ForgeLoadOptionsContext exposes getNodeParameter / getCurrentNodeParameter / getNode', () => {
  const ctx: ForgeLoadOptionsContext = {
    options: { databaseId: 'abc' },
    getNodeParameter: (name) => (name === 'databaseId' ? 'abc' : undefined),
    getCurrentNodeParameter: (name) => (name === 'databaseId' ? 'abc' : undefined),
    getNode: () => ({ id: 'block_1', name: 'Notion' }),
  };
  assert.equal(ctx.getNodeParameter?.('databaseId'), 'abc');
  assert.equal(ctx.getNodeParameter?.('missing', 'fallback'), undefined);
  assert.equal(ctx.getCurrentNodeParameter?.('databaseId'), 'abc');
  assert.equal(ctx.getNode?.().name, 'Notion');
});

test('isFieldVisible: displayOptions.show passes when value matches', () => {
  const f: ForgeField = {
    id: 'pipeline',
    label: 'Pipeline',
    type: 'text',
    displayOptions: { show: { resource: ['deal'] } },
  };
  assert.equal(isFieldVisible(f, { resource: 'deal' }), true);
  assert.equal(isFieldVisible(f, { resource: 'contact' }), false);
});

test('isFieldVisible: displayOptions.hide wins over show', () => {
  const f: ForgeField = {
    id: 'pipeline',
    label: 'Pipeline',
    type: 'text',
    displayOptions: {
      show: { resource: ['deal'] },
      hide: { mode: ['readonly'] },
    },
  };
  assert.equal(
    isFieldVisible(f, { resource: 'deal', mode: 'readonly' }),
    false,
  );
  assert.equal(
    isFieldVisible(f, { resource: 'deal', mode: 'write' }),
    true,
  );
});

test('isFieldVisible: multiple values in show array (OR match)', () => {
  const f: ForgeField = {
    id: 'x',
    label: 'X',
    type: 'text',
    displayOptions: { show: { resource: ['deal', 'contact'] } },
  };
  assert.equal(isFieldVisible(f, { resource: 'deal' }), true);
  assert.equal(isFieldVisible(f, { resource: 'contact' }), true);
  assert.equal(isFieldVisible(f, { resource: 'company' }), false);
});

test('isFieldVisible: falls back to legacy showIf when displayOptions absent', () => {
  const f: ForgeField = {
    id: 'x',
    label: 'X',
    type: 'text',
    showIf: { field: 'on', equals: true },
  };
  assert.equal(isFieldVisible(f, { on: true }), true);
  assert.equal(isFieldVisible(f, { on: false }), false);
});

test('isFieldVisible: returns true when no rules declared', () => {
  const f: ForgeField = { id: 'x', label: 'X', type: 'text' };
  assert.equal(isFieldVisible(f, {}), true);
});

/* ── resourceLocator schema ────────────────────────────────────────────── */

test('ForgeField accepts type: resourceLocator with 3 modes', () => {
  const f: ForgeField = {
    id: 'channel',
    label: 'Channel',
    type: 'resourceLocator',
    modes: [
      { name: 'list', displayName: 'From list', type: 'list' },
      {
        name: 'url',
        displayName: 'By URL',
        type: 'string',
        extractValue: { type: 'regex', regex: 'channels/([0-9]+)' },
      },
      { name: 'id', displayName: 'By ID', type: 'string' },
    ],
    loadOptions: async () => [{ label: '#general', value: 'C01' }],
  };
  assert.equal(f.type, 'resourceLocator');
  assert.equal(f.modes?.length, 3);
  assert.equal(f.modes?.[1].extractValue?.type, 'regex');
});

test('ForgeFieldMode shape: list mode can declare searchListMethod', () => {
  const m: ForgeFieldMode = {
    name: 'list',
    displayName: 'From list',
    type: 'list',
    searchListMethod: 'channelSearch',
  };
  assert.equal(m.searchListMethod, 'channelSearch');
});

test('ForgeFieldMode shape: string mode can declare validation', () => {
  const m: ForgeFieldMode = {
    name: 'url',
    displayName: 'By URL',
    type: 'string',
    validation: {
      regex: '^https?://',
      errorMessage: 'Must be an http(s) URL',
    },
  };
  assert.equal(m.validation?.errorMessage, 'Must be an http(s) URL');
});

test('ResourceLocatorValue carries mode + value', () => {
  const v: ResourceLocatorValue = { mode: 'url', value: 'https://x/123' };
  assert.equal(v.mode, 'url');
  assert.equal(v.value, 'https://x/123');
});
