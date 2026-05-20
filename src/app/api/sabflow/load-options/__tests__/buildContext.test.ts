/**
 * Unit tests for the load-options ctx builder.
 *
 *   npx tsx --test src/app/api/sabflow/load-options/__tests__/buildContext.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildLoadOptionsContext } from '../buildContext';
import type { ForgeBlock } from '@/lib/sabflow/forge/types';

const blockStub: ForgeBlock = {
  id: 'test_block',
  name: 'Test Block',
  description: 'fixture',
  category: 'Integration',
  fields: [
    { id: 'databaseId', label: 'Database', type: 'text' },
    {
      id: 'property',
      label: 'Property',
      type: 'select',
      loadOptionsDependsOn: ['databaseId'],
      loadOptions: async () => [],
    },
  ],
};

test('exposes options snapshot unchanged', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: { databaseId: 'db_42', other: 'foo' },
  });
  assert.deepEqual(ctx.options, { databaseId: 'db_42', other: 'foo' });
});

test('getNodeParameter reads from options snapshot', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: { databaseId: 'db_42' },
  });
  assert.equal(ctx.getNodeParameter?.('databaseId'), 'db_42');
});

test('getNodeParameter returns fallback when missing', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: {},
  });
  assert.equal(ctx.getNodeParameter?.('databaseId', 'dflt'), 'dflt');
  assert.equal(ctx.getNodeParameter?.('databaseId'), undefined);
});

test('getNodeParameter preserves null values (does not fall back)', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: { databaseId: null },
  });
  // hasOwnProperty is true → returns the stored null, NOT the fallback
  assert.equal(ctx.getNodeParameter?.('databaseId', 'dflt'), null);
});

test('getCurrentNodeParameter mirrors getNodeParameter', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: { databaseId: 'db_42' },
  });
  assert.equal(
    ctx.getCurrentNodeParameter?.('databaseId'),
    ctx.getNodeParameter?.('databaseId'),
  );
});

test('getNode returns block identity', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: {},
  });
  assert.deepEqual(ctx.getNode?.(), { id: 'test_block', name: 'Test Block' });
});

test('passes credential through verbatim', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: {},
    credential: { accessToken: 'tok_abc' },
  });
  assert.deepEqual(ctx.credential, { accessToken: 'tok_abc' });
});

test('credential omitted when not supplied', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: {},
  });
  assert.equal(ctx.credential, undefined);
});

/* ── resourceLocator auto-extraction ────────────────────────────────────── */

const rlBlock: ForgeBlock = {
  id: 'rl_block',
  name: 'RL Block',
  description: 'fixture',
  category: 'Integration',
  fields: [
    {
      id: 'channel',
      label: 'Channel',
      type: 'resourceLocator',
      modes: [
        { name: 'list', displayName: 'From list', type: 'list' },
        {
          name: 'url',
          displayName: 'By URL',
          type: 'string',
          extractValue: { type: 'regex', regex: 'archives/([A-Z0-9]+)' },
        },
        { name: 'id', displayName: 'By ID', type: 'string' },
      ],
    },
    {
      id: 'property',
      label: 'Property',
      type: 'select',
      loadOptionsDependsOn: ['channel'],
      loadOptions: async () => [],
    },
  ],
};

test('getNodeParameter auto-extracts resourceLocator url-mode value', () => {
  const ctx = buildLoadOptionsContext({
    block: rlBlock,
    options: {
      channel: { mode: 'url', value: 'https://app.slack.com/archives/C0123ABC' },
    },
  });
  // Sibling resolver should see the plain id, not the URL envelope.
  assert.equal(ctx.getNodeParameter?.('channel'), 'C0123ABC');
});

test('getNodeParameter auto-extracts list-mode (value already an id)', () => {
  const ctx = buildLoadOptionsContext({
    block: rlBlock,
    options: { channel: { mode: 'list', value: 'C99' } },
  });
  assert.equal(ctx.getNodeParameter?.('channel'), 'C99');
});

test('options snapshot still contains the raw envelope (for editor rehydration)', () => {
  const channel = { mode: 'url' as const, value: 'https://app.slack.com/archives/C9' };
  const ctx = buildLoadOptionsContext({
    block: rlBlock,
    options: { channel },
  });
  assert.deepEqual(ctx.options.channel, channel);
});

test('legacy plain-string field value still passes through unchanged', () => {
  const ctx = buildLoadOptionsContext({
    block: blockStub,
    options: { databaseId: 'plain_id' },
  });
  assert.equal(ctx.getNodeParameter?.('databaseId'), 'plain_id');
});

/* ── Phase 3: filter + paginationToken passthrough ─────────────────────── */

test('filter is forwarded to ctx (undefined when omitted)', () => {
  const ctxWith = buildLoadOptionsContext({
    block: blockStub,
    options: {},
    filter: 'general',
  });
  assert.equal(ctxWith.filter, 'general');

  const ctxWithout = buildLoadOptionsContext({
    block: blockStub,
    options: {},
  });
  assert.equal(ctxWithout.filter, undefined);
});

test('paginationToken is forwarded to ctx (string, null, or undefined)', () => {
  const a = buildLoadOptionsContext({
    block: blockStub,
    options: {},
    paginationToken: 'cursor_42',
  });
  assert.equal(a.paginationToken, 'cursor_42');

  const b = buildLoadOptionsContext({
    block: blockStub,
    options: {},
    paginationToken: null,
  });
  assert.equal(b.paginationToken, null);

  const c = buildLoadOptionsContext({ block: blockStub, options: {} });
  assert.equal(c.paginationToken, undefined);
});

test('resourceLocator declared at the action level (not block level)', () => {
  const multiAction: ForgeBlock = {
    id: 'multi',
    name: 'Multi',
    description: 'fixture',
    category: 'Integration',
    actions: [
      {
        id: 'send',
        label: 'Send',
        fields: [
          {
            id: 'channel',
            label: 'Channel',
            type: 'resourceLocator',
            modes: [
              {
                name: 'url',
                displayName: 'URL',
                type: 'string',
                extractValue: { type: 'regex', regex: '/([A-Z0-9]+)$' },
              },
              { name: 'id', displayName: 'ID', type: 'string' },
            ],
          },
        ],
        run: async () => ({}),
      },
    ],
  };
  const ctx = buildLoadOptionsContext({
    block: multiAction,
    actionId: 'send',
    options: { channel: { mode: 'url', value: 'https://x/y/Z9' } },
  });
  assert.equal(ctx.getNodeParameter?.('channel'), 'Z9');
});
