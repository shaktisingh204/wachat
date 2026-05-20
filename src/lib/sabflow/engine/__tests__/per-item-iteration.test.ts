/**
 * Phase 7 — per-item iteration semantics.
 *
 * When an upstream block exposes an `items[]` array, the downstream block
 * runs ONCE per item with `$json` bound to that item — matching n8n's
 * `for each input item` semantics. Verified at the unit level by feeding
 * crafted ctx + node outputs into `resolveDeep` (which is what
 * `executeForgeBlock` calls per iteration).
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/per-item-iteration.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveDeep, resolveTemplate } from '../resolveTokens';
import { evaluateExpression } from '@/lib/sabflow/n8n/expression-runner';

/* ── $input — derived from upstream items array ────────────────────────── */

test('$input.all() returns the upstream items array as { json } wrappers', () => {
  const out = evaluateExpression('={{ $input.all().length }}', {
    nodeOutputs: {
      List: {
        json: { id: 'first' },
        items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      } as unknown as Record<string, unknown>,
    },
    prevNodeName: 'List',
    currentNodeName: 'Next',
  });
  assert.equal(out, 3);
});

test('$input.first().json returns the first upstream item', () => {
  const out = resolveTemplate('id={{ $input.first().json.id }}', {
    nodeOutputs: {
      List: {
        json: { id: 'a' },
        items: [{ id: 'a' }, { id: 'b' }],
      } as unknown as Record<string, unknown>,
    },
    prevNodeName: 'List',
    currentNodeName: 'Next',
  });
  assert.equal(out, 'id=a');
});

test('$input.last().json returns the last upstream item', () => {
  const out = resolveTemplate('id={{ $input.last().json.id }}', {
    nodeOutputs: {
      List: {
        json: { id: 'a' },
        items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      } as unknown as Record<string, unknown>,
    },
    prevNodeName: 'List',
    currentNodeName: 'Next',
  });
  assert.equal(out, 'id=c');
});

test('$input.all() falls back to single-item when upstream has no items[]', () => {
  // Critical back-compat case: legacy blocks that only set `json` (no items)
  // must still expose a 1-element $input.all() so downstream `$input` users
  // don't see undefined.
  const out = evaluateExpression('={{ $input.all().length }}', {
    nodeOutputs: {
      Webhook: { json: { email: 'a@b.c' } },
    },
    prevNodeName: 'Webhook',
    currentNodeName: 'Next',
  });
  assert.equal(out, 1);
});

test('$input.item.json mirrors the first item (legacy single-item shape)', () => {
  const out = resolveTemplate('email={{ $input.item.json.email }}', {
    nodeOutputs: { Webhook: { json: { email: 'ada@x' } } },
    prevNodeName: 'Webhook',
    currentNodeName: 'Slack',
  });
  assert.equal(out, 'email=ada@x');
});

/* ── per-iteration $json resolution ────────────────────────────────────── */

test('passing json:item to resolveDeep makes $json see that item', () => {
  // Simulates what executeForgeBlock does inside its iteration loop: each
  // iteration calls resolveDeep with json=<currentItem> so {{ $json.x }}
  // varies per item.
  const items = [{ name: 'Ada' }, { name: 'Bob' }, { name: 'Carol' }];
  const results: string[] = [];
  for (const item of items) {
    const out = resolveDeep('Hi {{ $json.name }}', {
      variables: {},
      json: item,
      nodeOutputs: {},
      currentNodeName: 'Greeting',
    });
    results.push(out as string);
  }
  assert.deepEqual(results, ['Hi Ada', 'Hi Bob', 'Hi Carol']);
});

test('per-iteration $json + $node[upstream] both resolve correctly', () => {
  // Mix scope: $json shows the per-item value, $node[name] shows the
  // upstream's first-item bag — exactly what n8n does.
  const out = resolveDeep('{{ $json.id }} from {{ $node["DB"].json.source }}', {
    variables: {},
    json: { id: 42 },
    nodeOutputs: { DB: { json: { source: 'webhook' } } },
    currentNodeName: 'Slack',
    prevNodeName: 'DB',
  });
  assert.equal(out, '42 from webhook');
});

/* ── back-compat ───────────────────────────────────────────────────────── */

test('templates without $input still work (no regression)', () => {
  const out = resolveTemplate('hello {{ $node["Webhook"].json.name }}', {
    nodeOutputs: { Webhook: { json: { name: 'Ada' } } },
    currentNodeName: 'Slack',
  });
  assert.equal(out, 'hello Ada');
});
