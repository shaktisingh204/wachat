/**
 * Forge block: Split Out
 *
 * Source: n8n-master/packages/nodes-base/nodes/Transform/SplitOut/SplitOut.node.ts
 *
 * For each input item, fan out one outgoing item per entry of the target
 * field. The chosen field on each input must be an array. Other fields can
 * optionally be carried over (we carry them all — matches n8n's default
 * "include all other fields").
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

async function split(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'items');
  const field = asString(ctx.options.field).trim();
  if (!field) throw new Error('SplitOut: field is required');

  const out: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('SplitOut: every input must be an object');
    }
    const value = (item as Record<string, unknown>)[field];
    if (!Array.isArray(value)) {
      throw new Error(`SplitOut: item field "${field}" must be an array`);
    }
    const rest = { ...(item as Record<string, unknown>) };
    delete rest[field];
    for (const entry of value) {
      // If each array entry is an object, merge it; otherwise place under the field name.
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        out.push({ ...rest, ...(entry as Record<string, unknown>) });
      } else {
        out.push({ ...rest, [field]: entry });
      }
    }
  }

  return {
    outputs: { items: out, count: out.length },
    logs: [`SplitOut "${field}" → ${items.length} in / ${out.length} out`],
  };
}

const block: ForgeBlock = {
  id: 'forge_split_out',
  name: 'Split Out',
  description: 'Fan out items by an array field, emitting one item per entry.',
  iconName: 'LuSplit',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'split',
      label: 'Split out array field',
      description: 'Emit one item per entry of the target array field.',
      fields: [
        {
          id: 'items',
          label: 'Items (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"id":1,"tags":["a","b"]}]',
        },
        {
          id: 'field',
          label: 'Field to split on',
          type: 'text',
          required: true,
          placeholder: 'tags',
        },
      ],
      run: split,
    },
  ],
};

registerForgeBlock(block);
export default block;
