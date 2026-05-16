/**
 * Forge block: Array — Map.
 * Pure-JS transform: applies a JS expression (body of `item => …`) to each item.
 * Uses Function constructor; auth: none so it inherits the engine's own trust
 * boundary. No Node-only APIs are exposed to the expression.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_map',
  name: 'Array: Map',
  description: 'Transform each array item using a JavaScript expression.',
  iconName: 'LuMap',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'map',
      label: 'Map',
      description: 'Apply an expression like `item.name.toUpperCase()` to every item.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[{"name":"ada"}]' },
        {
          id: 'expression',
          label: 'Expression',
          type: 'code',
          required: true,
          placeholder: 'item.name.toUpperCase()',
          helperText: 'Has access to `item` and `index`. Return the new value.',
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const expression = asString(ctx.options.expression);
        if (!expression) throw new Error('Array: Map — expression is required');
        const fn = new Function('item', 'index', `return (${expression});`) as (item: unknown, index: number) => unknown;
        const result = items.map((item, index) => fn(item, index));
        return { outputs: { result, count: result.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
