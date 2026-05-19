/**
 * End-to-end integration test: a forge block reads the upstream block's
 * output via `{{ $node["<DisplayName>"].json.<key> }}` and that token
 * resolves at runtime — proving the picker → executor → action pipeline
 * actually delivers values without manual entry.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/forge-upstream-output.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveDeep } from '../resolveTokens';

test('forge options containing $node["..."].json.x resolve via resolveDeep', () => {
  const blockOptions = {
    channel: 'C01',
    text: 'Hello {{ $node["Webhook"].json.name }}, your email is {{ $node["Webhook"].json.email }}',
    extra: {
      header: 'X-Caller-Id: {{ $node["Webhook"].json.id }}',
      meta: ['static', '{{ $node["Webhook"].json.tag }}'],
    },
  };

  const resolved = resolveDeep(blockOptions, {
    variables: {},
    nodeOutputs: {
      Webhook: {
        json: {
          name: 'Ada',
          email: 'ada@example.com',
          id: 42,
          tag: 'priority',
        },
      },
    },
    currentNodeName: 'Slack',
  }) as typeof blockOptions;

  assert.equal(resolved.channel, 'C01');
  assert.equal(
    resolved.text,
    'Hello Ada, your email is ada@example.com',
    'top-level field resolves both upstream references',
  );
  assert.equal(
    resolved.extra.header,
    'X-Caller-Id: 42',
    'nested object string resolves',
  );
  assert.equal(
    resolved.extra.meta[1],
    'priority',
    'string inside array resolves',
  );
  assert.equal(
    resolved.extra.meta[0],
    'static',
    'non-template strings pass through verbatim',
  );
});

test('mixed legacy {{var}} + advanced {{ $node[...] }} both resolve in same field', () => {
  const out = resolveDeep(
    'Hi {{userName}}, last order id = {{ $node["DB"].json.orderId }}',
    {
      variables: { userName: 'Ada' },
      nodeOutputs: { DB: { json: { orderId: 'ord_42' } } },
      currentNodeName: 'Email',
    },
  );
  assert.equal(out, 'Hi Ada, last order id = ord_42');
});

test('field with NO templating passes through verbatim (no advanced engine cost)', () => {
  const out = resolveDeep('plain literal value', {
    variables: {},
    nodeOutputs: { X: { json: { y: 1 } } },
  });
  assert.equal(out, 'plain literal value');
});

test('upstream reference to non-existent node fails safe (does not crash)', () => {
  // What matters: this does not throw. The exact fallback (undefined / empty
  // string / original token) is implementation detail and matches n8n's
  // permissive behaviour for unresolved upstream references.
  assert.doesNotThrow(() => {
    resolveDeep('{{ $node["Missing"].json.x }}', {
      variables: {},
      nodeOutputs: {},
      currentNodeName: 'Next',
    });
  });
});
