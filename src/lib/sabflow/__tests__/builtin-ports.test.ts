/**
 * Audit — every multi-output built-in block declares labeled ports via
 * `getDefaultPorts`. The forge-block multi-output path was wired in
 * Phase 11 (P11.1); this test locks in the contract for the non-forge
 * primitives that ship with sabflow's runtime.
 *
 *   npx tsx --test src/lib/sabflow/__tests__/builtin-ports.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { getDefaultPorts } from '../ports';

test('condition declares True / False output ports', () => {
  const p = getDefaultPorts('condition' as never);
  assert.equal(p.outputs.length, 2);
  assert.equal(p.outputs[0].label, 'True');
  assert.equal(p.outputs[1].label, 'False');
});

test('ab_test declares Path A / Path B output ports', () => {
  const p = getDefaultPorts('ab_test' as never);
  assert.equal(p.outputs.length, 2);
  assert.equal(p.outputs[0].label, 'Path A');
  assert.equal(p.outputs[1].label, 'Path B');
});

test('filter declares Pass / Fail output ports', () => {
  const p = getDefaultPorts('filter' as never);
  assert.equal(p.outputs.length, 2);
  assert.equal(p.outputs[0].label, 'Pass');
  assert.equal(p.outputs[1].label, 'Fail');
});

test('loop declares Loop / Done output ports', () => {
  const p = getDefaultPorts('loop' as never);
  assert.equal(p.outputs.length, 2);
  assert.equal(p.outputs[0].label, 'Loop');
  assert.equal(p.outputs[1].label, 'Done');
});

test('merge declares two named input ports + single main output', () => {
  const p = getDefaultPorts('merge' as never);
  assert.equal(p.inputs.length, 2);
  assert.equal(p.inputs[0].label, 'Input 1');
  assert.equal(p.inputs[1].label, 'Input 2');
  assert.equal(p.outputs.length, 1);
});

test('integration-style block (webhook) declares Success / Error outputs', () => {
  // Verifies the integration cluster (webhook/send_email/google_sheets/…)
  // gets the n8n-style error pin alongside the main output.
  const p = getDefaultPorts('webhook' as never);
  assert.equal(p.outputs.length, 2);
  assert.equal(p.outputs[0].label, 'Success');
  assert.equal(p.outputs[1].label, 'Error');
});

test('jump and redirect declare zero output ports (terminal blocks)', () => {
  assert.equal(getDefaultPorts('jump' as never).outputs.length, 0);
  assert.equal(getDefaultPorts('redirect' as never).outputs.length, 0);
});

test('every output port id follows the n8n outputs/main/<index> shape', () => {
  for (const type of ['condition', 'ab_test', 'filter', 'loop', 'webhook'] as const) {
    const p = getDefaultPorts(type as never);
    p.outputs.forEach((o, i) => {
      assert.equal(
        o.id,
        `outputs/main/${i}`,
        `${type}: output[${i}].id should be outputs/main/${i}, got ${o.id}`,
      );
    });
  }
});
