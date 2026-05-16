/**
 * Forge block: Summarize
 *
 * Source: n8n-master/packages/nodes-base/nodes/Transform/Summarize/Summarize.node.ts
 *
 * Compute a single aggregate stat (sum / avg / min / max / count) over the
 * numeric values of a field across all input items.
 *
 * Limitations:
 *   - n8n's group-by + multi-aggregate matrix is not exposed; this block
 *     emits one scalar at a time. Run it multiple times for parallel stats.
 *   - For `count`, non-numeric values still count (it's a row count, not a
 *     defined-value count) — matches n8n's `count` aggregator.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

type Op = 'sum' | 'avg' | 'min' | 'max' | 'count';

async function summarizeField(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'items');
  const field = asString(ctx.options.field).trim();
  const op = (asString(ctx.options.op) || 'sum') as Op;
  if (op !== 'count' && !field) {
    throw new Error('Summarize: field is required (except for op="count")');
  }

  let result: number;
  if (op === 'count') {
    result = items.length;
  } else {
    const nums: number[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const v = (item as Record<string, unknown>)[field];
      const n = asNumber(v);
      if (n !== undefined) nums.push(n);
    }
    if (nums.length === 0) {
      throw new Error(`Summarize: no numeric values found for field "${field}"`);
    }
    switch (op) {
      case 'sum':
        result = nums.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        result = nums.reduce((a, b) => a + b, 0) / nums.length;
        break;
      case 'min':
        result = Math.min(...nums);
        break;
      case 'max':
        result = Math.max(...nums);
        break;
      default:
        throw new Error(`Summarize: unknown op "${op}"`);
    }
  }

  return {
    outputs: { result, op, field: field || null, count: items.length },
    logs: [`Summarize ${op}${field ? ` "${field}"` : ''} → ${result}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_summarize',
  name: 'Summarize',
  description: 'Compute a single stat (sum/avg/min/max/count) over a field.',
  iconName: 'LuSigma',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'summarize_field',
      label: 'Summarize field',
      description: 'Aggregate the numeric values of a field across all items.',
      fields: [
        {
          id: 'items',
          label: 'Items (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"price":10},{"price":20}]',
        },
        {
          id: 'field',
          label: 'Field',
          type: 'text',
          placeholder: 'price',
          helperText: 'Required for sum/avg/min/max. Optional for count.',
        },
        {
          id: 'op',
          label: 'Operation',
          type: 'select',
          required: true,
          defaultValue: 'sum',
          options: [
            { label: 'Sum', value: 'sum' },
            { label: 'Average', value: 'avg' },
            { label: 'Min', value: 'min' },
            { label: 'Max', value: 'max' },
            { label: 'Count', value: 'count' },
          ],
        },
      ],
      run: summarizeField,
    },
  ],
};

registerForgeBlock(block);
export default block;
