/**
 * Phase 5 — expression globals: $prevNode, $execution, $env.
 *
 * Goal: bring sabflow's expression scope up to n8n parity for the most
 * commonly-referenced globals. The runtime already exposes $node, $json,
 * $vars, $workflow, $now, $today (Phase 1 fix). This adds the missing set.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/expression-globals.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveTemplate } from '../resolveTokens';

/* ── $prevNode ─────────────────────────────────────────────────────────── */

test('$prevNode.name returns the upstream node display name', () => {
  // When `Slack` runs after `Webhook`, $prevNode points at Webhook.
  const out = resolveTemplate('from={{ $prevNode.name }}', {
    nodeOutputs: { Webhook: { json: { email: 'a@b.c' } } },
    currentNodeName: 'Slack',
    prevNodeName: 'Webhook',
  });
  assert.equal(out, 'from=Webhook');
});

test('$prevNode.json mirrors the upstream node output', () => {
  const out = resolveTemplate('email={{ $prevNode.json.email }}', {
    nodeOutputs: { Webhook: { json: { email: 'ada@example.com' } } },
    currentNodeName: 'Slack',
    prevNodeName: 'Webhook',
  });
  assert.equal(out, 'email=ada@example.com');
});

test('$prevNode is undefined when no upstream is known (root nodes)', () => {
  // Should not crash; expression engine falls back to leaving the template
  // intact rather than throwing.
  assert.doesNotThrow(() => {
    resolveTemplate('{{ $prevNode.name }}', {
      nodeOutputs: {},
      currentNodeName: 'Webhook',
    });
  });
});

/* ── $execution ────────────────────────────────────────────────────────── */

test('$execution.id returns the execution id', () => {
  const out = resolveTemplate('run={{ $execution.id }}', {
    execution: { id: 'exec_42', mode: 'manual' },
  });
  assert.equal(out, 'run=exec_42');
});

test('$execution.mode returns the trigger mode', () => {
  const out = resolveTemplate('mode={{ $execution.mode }}', {
    execution: { id: 'exec_1', mode: 'trigger' },
  });
  assert.equal(out, 'mode=trigger');
});

test('$execution falls back to a stub when not provided (no crash)', () => {
  // Critical: every legacy caller passes ctx without `execution`; the proxy
  // already shipped a stub for this. Verify we didn't regress it.
  assert.doesNotThrow(() => {
    resolveTemplate('{{ $execution.id }}', {});
  });
});

/* ── $env ──────────────────────────────────────────────────────────────── */

test('$env.<KEY> reads from the allowlist', () => {
  process.env.SABFLOW_TEST_VAR = 'hello-from-env';
  try {
    const out = resolveTemplate('v={{ $env.SABFLOW_TEST_VAR }}', {
      envAllowlist: ['SABFLOW_TEST_VAR'],
    });
    assert.equal(out, 'v=hello-from-env');
  } finally {
    delete process.env.SABFLOW_TEST_VAR;
  }
});

test('$env.<KEY> returns empty for vars NOT in the allowlist', () => {
  process.env.SABFLOW_SECRET = 'do-not-leak';
  try {
    // Caller never allowlists SABFLOW_SECRET → expression sees no value.
    // This prevents accidental env exfiltration via flow expressions.
    const out = resolveTemplate('v={{ $env.SABFLOW_SECRET }}', {
      envAllowlist: ['SOMETHING_ELSE'],
    });
    assert.equal(out, 'v=');
  } finally {
    delete process.env.SABFLOW_SECRET;
  }
});

test('$env with no allowlist exposes nothing (default-deny)', () => {
  process.env.SABFLOW_LEAK_CHECK = 'should-not-appear';
  try {
    const out = resolveTemplate('v={{ $env.SABFLOW_LEAK_CHECK }}', {});
    assert.equal(out, 'v=');
  } finally {
    delete process.env.SABFLOW_LEAK_CHECK;
  }
});

/* ── all three composed ────────────────────────────────────────────────── */

/* ── Luxon constructors ────────────────────────────────────────────────── */

test('DateTime.now().toFormat(...) is callable from expressions', () => {
  const out = resolveTemplate("{{ DateTime.now().toFormat('yyyy') }}", {
    timezone: 'UTC',
  });
  // Just check the year shape; the exact value depends on wall-clock.
  assert.match(out, /^\d{4}$/);
});

test('DateTime.fromISO(...) parses and formats', () => {
  const out = resolveTemplate(
    "{{ DateTime.fromISO('2026-01-15T12:34:56Z').toFormat('yyyy-MM-dd') }}",
    { timezone: 'UTC' },
  );
  assert.equal(out, '2026-01-15');
});

test('Duration.fromObject(...) computes durations', () => {
  const out = resolveTemplate(
    "{{ Duration.fromObject({ hours: 2, minutes: 30 }).as('minutes') }}",
    {},
  );
  assert.equal(out, '150');
});

/* ── $jmesPath ─────────────────────────────────────────────────────────── */

test('$jmesPath extracts via a JMESPath query', () => {
  const out = resolveTemplate(
    "{{ $jmesPath($json, 'items[0].name') }}",
    { json: { items: [{ name: 'Alpha' }, { name: 'Bravo' }] } },
  );
  assert.equal(out, 'Alpha');
});

test('$jmespath alias also works (n8n parity)', () => {
  const out = resolveTemplate(
    "{{ $jmespath($json, 'items[?score > `5`].name | [0]') }}",
    { json: { items: [{ name: 'a', score: 3 }, { name: 'b', score: 9 }] } },
  );
  assert.equal(out, 'b');
});

test('all three globals can be referenced in the same template', () => {
  process.env.RUN_TAG = 'prod-01';
  try {
    const out = resolveTemplate(
      'tag={{ $env.RUN_TAG }} | from={{ $prevNode.name }} | run={{ $execution.id }}',
      {
        envAllowlist: ['RUN_TAG'],
        nodeOutputs: { Webhook: { json: { id: 1 } } },
        currentNodeName: 'Slack',
        prevNodeName: 'Webhook',
        execution: { id: 'exec_9', mode: 'manual' },
      },
    );
    assert.equal(out, 'tag=prod-01 | from=Webhook | run=exec_9');
  } finally {
    delete process.env.RUN_TAG;
  }
});
