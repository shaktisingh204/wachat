/**
 * Forge block: Array — Chunk.
 * Pure-JS transform: splits an array into chunks of N items.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_chunk',
  name: 'Array: Chunk',
  description: 'Split an array into chunks of N items.',
  iconName: 'LuRows3',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chunk',
      label: 'Chunk',
      description: 'Break the input into sub-arrays of the given size.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[1,2,3,4,5]' },
        { id: 'size', label: 'Chunk size', type: 'number', required: true, defaultValue: 2 },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const size = asNumber(ctx.options.size) ?? 1;
        if (size < 1) throw new Error('Array: Chunk — size must be at least 1');
        const result: unknown[][] = [];
        for (let i = 0; i < items.length; i += size) {
          result.push(items.slice(i, i + size));
        }
        return { outputs: { result, count: result.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
