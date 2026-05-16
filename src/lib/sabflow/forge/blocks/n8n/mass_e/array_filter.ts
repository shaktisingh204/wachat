/**
 * Forge block: Array — Filter.
 * Pure-JS transform: keeps items where a JS predicate returns truthy.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_filter',
  name: 'Array: Filter',
  description: 'Keep items that match a JavaScript predicate.',
  iconName: 'LuFilter',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'filter',
      label: 'Filter',
      description: 'Keep items where the predicate returns truthy.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[1,2,3,4]' },
        {
          id: 'predicate',
          label: 'Predicate',
          type: 'code',
          required: true,
          placeholder: 'item > 2',
          helperText: 'Has access to `item` and `index`. Return truthy to keep.',
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const predicate = asString(ctx.options.predicate);
        if (!predicate) throw new Error('Array: Filter — predicate is required');
        const fn = new Function('item', 'index', `return (${predicate});`) as (item: unknown, index: number) => unknown;
        const result = items.filter((item, index) => Boolean(fn(item, index)));
        return { outputs: { result, count: result.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
