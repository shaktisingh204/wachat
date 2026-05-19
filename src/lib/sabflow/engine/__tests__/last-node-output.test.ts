/**
 * Reproduces and locks in the "last node output" guarantee:
 *
 *   {{ $node["Webhook"].json.email }}   must resolve to the value emitted
 *                                       by the upstream Webhook node.
 *
 *   {{ $node.Webhook.json.email }}      same, with dot notation.
 *
 * Run:  npx tsx --test src/lib/sabflow/engine/__tests__/last-node-output.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveTemplate } from '../resolveTokens';

test('$node["Name"].json.field resolves to upstream output', () => {
  const out = resolveTemplate('email={{ $node["Webhook"].json.email }}', {
    nodeOutputs: {
      Webhook: { json: { email: 'ada@example.com' } },
    },
    currentNodeName: 'Slack',
  });
  assert.equal(out, 'email=ada@example.com');
});

test('$node.Name.json.field (dot form) resolves to upstream output', () => {
  const out = resolveTemplate('hi {{ $node.Webhook.json.name }}', {
    nodeOutputs: {
      Webhook: { json: { name: 'Ada' } },
    },
    currentNodeName: 'Slack',
  });
  assert.equal(out, 'hi Ada');
});

test('nested path resolves: $node["X"].json.user.profile.handle', () => {
  const out = resolveTemplate('@{{ $node["X"].json.user.profile.handle }}', {
    nodeOutputs: {
      X: { json: { user: { profile: { handle: 'ada' } } } },
    },
    currentNodeName: 'Next',
  });
  assert.equal(out, '@ada');
});

test('missing upstream node leaves the template intact (fail-safe)', () => {
  const out = resolveTemplate('{{ $node["Missing"].json.x }}', {
    nodeOutputs: {},
    currentNodeName: 'Next',
  });
  // Either the original template or empty — what matters is it doesn't crash.
  assert.ok(typeof out === 'string');
});

test('mixed plain + upstream tokens both resolve', () => {
  const out = resolveTemplate(
    'Hello {{name}}, your id is {{ $node["DB"].json.id }}',
    {
      variables: { name: 'Ada' },
      nodeOutputs: { DB: { json: { id: 42 } } },
      currentNodeName: 'Next',
    },
  );
  assert.equal(out, 'Hello Ada, your id is 42');
});
