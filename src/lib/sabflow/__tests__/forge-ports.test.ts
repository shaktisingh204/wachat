/**
 * Phase 11 — multi-output port resolution for forge blocks.
 *
 *   npx tsx --test src/lib/sabflow/__tests__/forge-ports.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { registerForgeBlock } from '../forge/registry';
import type { ForgeBlock } from '../forge/types';
import { getDefaultPorts } from '../ports';

// Register fixtures BEFORE any test reads them (top-level eval order).
const multiOutputBlock: ForgeBlock = {
  id: 'forge_test_branching',
  name: 'TestBranching',
  description: 'fixture',
  category: 'Logic',
  outputs: [
    { name: 'true', displayName: 'true' },
    { name: 'false', displayName: 'false' },
  ],
};
registerForgeBlock(multiOutputBlock);

const singleOutputBlock: ForgeBlock = {
  id: 'forge_test_single',
  name: 'TestSingle',
  description: 'fixture',
  category: 'Integration',
  // No `outputs` field — falls back to default 1-out.
};
registerForgeBlock(singleOutputBlock);

const threeOutputBlock: ForgeBlock = {
  id: 'forge_test_switch3',
  name: 'TestSwitch3',
  description: 'fixture',
  category: 'Logic',
  outputs: [
    { name: 'low', displayName: 'low' },
    { name: 'mid', displayName: 'mid' },
    { name: 'high', displayName: 'high' },
  ],
};
registerForgeBlock(threeOutputBlock);

/* ── multi-output ──────────────────────────────────────────────────────── */

test('getDefaultPorts surfaces forge block outputs as canvas ports', () => {
  const ports = getDefaultPorts('forge_test_branching' as never);
  assert.equal(ports.outputs.length, 2);
  assert.equal(ports.outputs[0].id, 'outputs/main/0');
  assert.equal(ports.outputs[0].label, 'true');
  assert.equal(ports.outputs[1].id, 'outputs/main/1');
  assert.equal(ports.outputs[1].label, 'false');
});

test('three-output forge block renders 3 handles', () => {
  const ports = getDefaultPorts('forge_test_switch3' as never);
  assert.equal(ports.outputs.length, 3);
  assert.deepEqual(
    ports.outputs.map((o) => o.label),
    ['low', 'mid', 'high'],
  );
});

test('input ports stay at 1 (single main input) for multi-output forge blocks', () => {
  const ports = getDefaultPorts('forge_test_branching' as never);
  assert.equal(ports.inputs.length, 1);
  assert.equal(ports.inputs[0].id, 'inputs/main/0');
});

/* ── back-compat ───────────────────────────────────────────────────────── */

test('single-output forge block falls back to default 1-out', () => {
  // Block in registry with no outputs declaration — exact same shape as
  // every existing forge block ported before Phase 8. Must not regress.
  const ports = getDefaultPorts('forge_test_single' as never);
  // The legacy switch in getDefaultPorts hits the default case for
  // unmatched block types: 1 input, 1 output.
  assert.equal(ports.outputs.length, 1);
  assert.equal(ports.outputs[0].id, 'outputs/main/0');
});

test('unknown forge block (not registered) falls back to default 1-out', () => {
  const ports = getDefaultPorts('forge_does_not_exist' as never);
  assert.equal(ports.outputs.length, 1);
});
