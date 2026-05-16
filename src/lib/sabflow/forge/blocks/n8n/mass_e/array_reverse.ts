/**
 * Forge block: Array — Reverse.
 * Pure-JS transform: returns the array in reverse order (non-mutating).
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_reverse',
  name: 'Array: Reverse',
  description: 'Reverse the order of items in an array.',
  iconName: 'LuArrowDownUp',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'reverse',
      label: 'Reverse',
      description: 'Return a new array with the items in reverse order.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[1,2,3]' },
      ],
      run: async (ctx) => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const result = items.slice().reverse();
        return { outputs: { result, count: result.length } } as ForgeActionResult;
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
