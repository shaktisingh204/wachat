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
