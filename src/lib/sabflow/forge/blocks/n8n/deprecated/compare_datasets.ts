/**
 * Forge block: Compare Datasets (deprecated parity port)
 *
 * Source: n8n-master/packages/nodes-base/nodes/CompareDatasets/CompareDatasets.node.ts
 *
 * n8n's CompareDatasets ships as a versioned dual-input transform (1, 2,
 * 2.1, 2.2, 2.3) that pairs items from two main inputs by match-field pairs
 * and routes them to 4 outputs (in-A-only, same, different, in-B-only).
 *
 * SabFlow's engine pipes a single bag of variables through each block, so
 * the dual-input/quad-output topology cannot be reproduced 1:1. This block
 * is kept for migration parity only — for new flows prefer composing two
 * `forge_filter`/`forge_merge` blocks against the same variable scope.
 *
 * Operations covered:
 *   - compare(left, right, key) → { inBoth, leftOnly, rightOnly }
 *
 * Limitations / deferred:
 *   - No fuzzy compare, no dot-notation, no "include both versions" resolver.
 *   - Single match field (n8n supports multiple pairs).
 *   - All inputs must be arrays of plain objects.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function toRecordArray(input: unknown, label: string): Array<Record<string, unknown>> {
  let value: unknown = input;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    try {
      value = JSON.parse(t);
    } catch (err) {
      throw new Error(`CompareDatasets: ${label} is not valid JSON — ${(err as Error).message}`);
    }
  }
  if (!Array.isArray(value)) {
    throw new Error(`CompareDatasets: ${label} must be a JSON array of objects`);
  }
  return value.map((row, idx) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`CompareDatasets: ${label}[${idx}] must be a plain object`);
    }
    return row as Record<string, unknown>;
  });
}

async function compare(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('CompareDatasets: key is required');
  const left = toRecordArray(ctx.options.left, 'left');
  const right = toRecordArray(ctx.options.right, 'right');

  const rightByKey = new Map<string, Record<string, unknown>>();
  for (const row of right) {
    rightByKey.set(asString(row[key]), row);
  }

  const inBoth: Array<{ left: Record<string, unknown>; right: Record<string, unknown> }> = [];
  const leftOnly: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const row of left) {
    const k = asString(row[key]);
    const match = rightByKey.get(k);
    if (match !== undefined) {
      inBoth.push({ left: row, right: match });
      seen.add(k);
    } else {
      leftOnly.push(row);
    }
  }

  const rightOnly: Array<Record<string, unknown>> = [];
  for (const row of right) {
    const k = asString(row[key]);
    if (!seen.has(k)) rightOnly.push(row);
  }

  return {
    outputs: { inBoth, leftOnly, rightOnly },
    logs: [`CompareDatasets compare → both=${inBoth.length} leftOnly=${leftOnly.length} rightOnly=${rightOnly.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_compare_datasets',
  name: 'Compare Datasets (legacy)',
  description: 'Pair two arrays of objects by a key and return overlap + diffs (migration parity only).',
  iconName: 'LuColumns',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'compare',
      label: 'Compare two arrays',
      description: 'Match rows from `left` and `right` by `key` and return { inBoth, leftOnly, rightOnly }.',
      fields: [
        {
          id: 'left',
          label: 'Left array',
          type: 'json',
          required: true,
          placeholder: '[{"id":1,"name":"a"}]',
          helperText: 'JSON array of objects (or a variable reference to one).',
        },
        {
          id: 'right',
          label: 'Right array',
          type: 'json',
          required: true,
          placeholder: '[{"id":1,"name":"b"}]',
        },
        {
          id: 'key',
          label: 'Match field',
          type: 'text',
          required: true,
          placeholder: 'id',
          helperText: 'Top-level field name compared across both arrays.',
        },
      ],
      run: compare,
    },
  ],
};

registerForgeBlock(block);
export default block;
