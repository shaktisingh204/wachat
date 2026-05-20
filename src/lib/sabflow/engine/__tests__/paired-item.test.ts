/**
 * Phase 9 — pairedItem ancestry tracking.
 *
 * Verifies:
 *   • $getPairedItem walks back a single hop to the immediate ancestor.
 *   • Walk traverses multiple hops via the prevNodeName chain.
 *   • Missing ancestor / unknown target returns undefined (fail-safe).
 *   • $itemIndex reads the current iteration index.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/paired-item.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveTemplate } from '../resolveTokens';

/* ── single-hop walk-back ───────────────────────────────────────────────── */

test('$getPairedItem("Upstream") returns the ancestor item one hop back', () => {
  // Flow: Webhook → Slack
  // Webhook emitted 3 items; Slack iterated, currentItemIndex = 1 means
  // we're processing the row paired with Webhook items[1].
  const out = resolveTemplate(
    '{{ $getPairedItem("Webhook").email }}',
    {
      nodeOutputs: {
        Webhook: {
          json: { email: 'a@x' },
          items: [
            { email: 'a@x' },
            { email: 'b@x' },
            { email: 'c@x' },
          ],
        } as unknown as Record<string, unknown>,
        Slack: {
          // Slack runs 3 times (once per webhook item) → its items mirror
          // upstream, paired 1:1.
          json: { sent: true },
          items: [{ sent: true }, { sent: true }, { sent: true }],
          pairedItems: [{ item: 0 }, { item: 1 }, { item: 2 }],
          prevNodeName: 'Webhook',
        } as unknown as Record<string, unknown>,
      },
      currentNodeName: 'Slack',
      currentItemIndex: 1,
    },
  );
  assert.equal(out, 'b@x');
});

/* ── multi-hop walk-back ────────────────────────────────────────────────── */

test('$getPairedItem walks back across multiple hops', () => {
  // Flow: Webhook → Map → Slack
  // We're at Slack itemIndex=2, walk back through Map to Webhook.
  // Slack[2].pairedItem → Map item 2
  // Map[2].pairedItem  → Webhook item 0  (Map fanned 3-from-1)
  // Result: Webhook items[0]
  const out = resolveTemplate(
    '{{ $getPairedItem("Webhook").trigger_id }}',
    {
      nodeOutputs: {
        Webhook: {
          json: { trigger_id: 'tr_only_one' },
          items: [{ trigger_id: 'tr_only_one' }],
        } as unknown as Record<string, unknown>,
        Map: {
          json: { mapped: 'first' },
          items: [
            { mapped: 'first' },
            { mapped: 'second' },
            { mapped: 'third' },
          ],
          // Map produced 3 items all from upstream item 0.
          pairedItems: [{ item: 0 }, { item: 0 }, { item: 0 }],
          prevNodeName: 'Webhook',
        } as unknown as Record<string, unknown>,
        Slack: {
          json: { ok: true },
          items: [{ ok: true }, { ok: true }, { ok: true }],
          pairedItems: [{ item: 0 }, { item: 1 }, { item: 2 }],
          prevNodeName: 'Map',
        } as unknown as Record<string, unknown>,
      },
      currentNodeName: 'Slack',
      currentItemIndex: 2,
    },
  );
  assert.equal(out, 'tr_only_one');
});

/* ── fail-safe behaviours ───────────────────────────────────────────────── */

test('$getPairedItem returns undefined when target node is unknown', () => {
  const out = resolveTemplate(
    '[{{ $getPairedItem("Missing").x }}]',
    {
      nodeOutputs: {
        Webhook: { json: {}, items: [{}] },
        Slack: {
          json: {},
          items: [{}],
          pairedItems: [{ item: 0 }],
          prevNodeName: 'Webhook',
        } as unknown as Record<string, unknown>,
      },
      currentNodeName: 'Slack',
      currentItemIndex: 0,
    },
  );
  // n8n returns undefined → the expression engine renders as empty string.
  assert.equal(out, '[]');
});

test('$getPairedItem returns undefined for a node without pairedItems', () => {
  // Legacy single-shot blocks don't ship pairedItems — walk-back should
  // bail rather than crash.
  const out = resolveTemplate('[{{ $getPairedItem("Old").x }}]', {
    nodeOutputs: {
      Old: { json: { x: 1 } },
      New: { json: {}, items: [{}] } as unknown as Record<string, unknown>,
    },
    currentNodeName: 'New',
    currentItemIndex: 0,
  });
  assert.equal(out, '[]');
});

/* ── $itemIndex ─────────────────────────────────────────────────────────── */

test('$itemIndex reflects the current iteration index', () => {
  for (const i of [0, 1, 5, 42]) {
    const out = resolveTemplate('i={{ $itemIndex }}', {
      currentItemIndex: i,
    });
    assert.equal(out, `i=${i}`);
  }
});

test('$itemIndex defaults to 0 when no iteration in progress', () => {
  const out = resolveTemplate('{{ $itemIndex }}', {});
  assert.equal(out, '0');
});

/* ── back-compat ────────────────────────────────────────────────────────── */

test('templates without $getPairedItem still resolve normally', () => {
  const out = resolveTemplate(
    'hello {{ $node["Webhook"].json.name }}',
    {
      nodeOutputs: { Webhook: { json: { name: 'Ada' } } },
      currentNodeName: 'Slack',
    },
  );
  assert.equal(out, 'hello Ada');
});
