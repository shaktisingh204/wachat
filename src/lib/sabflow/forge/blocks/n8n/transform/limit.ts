/**
 * Forge block: Limit
 *
 * Source: n8n-master/packages/nodes-base/nodes/Transform/Limit/Limit.node.ts
 *
 * Slices the incoming items down to the first or last N.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

async function limit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray(ctx.options.items, 'items');
  const count = asNumber(ctx.options.count);
  if (count === undefined || count < 0) {
    throw new Error('Limit: count is required and must be ≥ 0');
  }
  const keep = (asString(ctx.options.keep) || 'first') as 'first' | 'last';

  let out: unknown[];
  if (count >= items.length) {
    out = items;
  } else if (keep === 'last') {
    out = items.slice(items.length - count);
  } else {
    out = items.slice(0, count);
  }

  return {
    outputs: { items: out, count: out.length },
    logs: [`Limit ${keep} ${count} → ${items.length} in / ${out.length} out`],
  };
}

const block: ForgeBlock = {
  id: 'forge_limit',
  name: 'Limit',
  description: 'Keep only the first or last N items from a list.',
  iconName: 'LuListFilter',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'limit',
      label: 'Limit items',
      description: 'Return the first or last N items of the input array.',
      fields: [
        {
          id: 'items',
          label: 'Items (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"id":1},{"id":2},{"id":3}]',
        },
        {
          id: 'count',
          label: 'Count',
          type: 'number',
          required: true,
          defaultValue: 1,
        },
        {
          id: 'keep',
          label: 'Keep',
          type: 'select',
          required: true,
          defaultValue: 'first',
          options: [
            { label: 'First items', value: 'first' },
            { label: 'Last items', value: 'last' },
          ],
        },
      ],
      run: limit,
    },
  ],
};

registerForgeBlock(block);
export default block;
