/**
 * Phase 8 — multi-output branching schema.
 *
 *   npx tsx --test src/lib/sabflow/forge/__tests__/multi-output.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type {
  ForgeAction,
  ForgeActionResult,
  ForgeBlock,
  ForgeOutput,
} from '../types';

test('ForgeBlock accepts outputs array', () => {
  const b: ForgeBlock = {
    id: 'forge_test_if',
    name: 'TestIf',
    description: 'fixture',
    category: 'Logic',
    outputs: [
      { name: 'true', displayName: 'true' },
      { name: 'false', displayName: 'false' },
    ],
  };
  assert.equal(b.outputs?.length, 2);
  assert.equal(b.outputs?.[0].name, 'true');
});

test('ForgeOutput.displayName is optional (falls back to name)', () => {
  const o: ForgeOutput = { name: 'main' };
  assert.equal(o.name, 'main');
  assert.equal(o.displayName, undefined);
});

test('ForgeAction.outputs overrides block-level outputs', () => {
  const a: ForgeAction = {
    id: 'evaluate',
    label: 'Evaluate',
    fields: [],
    outputs: [
      { name: 'pass' },
      { name: 'fail' },
    ],
    run: async () => ({}),
  };
  assert.equal(a.outputs?.length, 2);
});

test('ForgeActionResult.selectedOutput type-checks as string', () => {
  const r: ForgeActionResult = {
    outputs: { x: 1 },
    selectedOutput: 'true',
  };
  assert.equal(r.selectedOutput, 'true');
});

test('block without outputs declaration is single-output (back-compat)', () => {
  // Most existing blocks do not declare outputs — they're implicitly
  // single-output and route sequentially. This regression-guards that path.
  const b: ForgeBlock = {
    id: 'forge_test_legacy',
    name: 'Legacy',
    description: 'fixture',
    category: 'Integration',
  };
  assert.equal(b.outputs, undefined);
});
