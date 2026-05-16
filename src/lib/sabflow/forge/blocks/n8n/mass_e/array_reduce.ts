/**
 * Forge block: Array — Reduce.
 * Pure-JS transform: folds an array via a JS expression returning the new acc.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJson, parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_reduce',
  name: 'Array: Reduce',
  description: 'Fold an array into a single value using a JavaScript expression.',
  iconName: 'LuLayers',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'reduce',
      label: 'Reduce',
      description: 'Run a reducer expression that returns the new accumulator.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[1,2,3]' },
        {
          id: 'expression',
          label: 'Expression',
          type: 'code',
          required: true,
          placeholder: 'acc + item',
          helperText: 'Has access to `acc`, `item`, and `index`. Return the new acc.',
        },
        { id: 'initial', label: 'Initial value (JSON)', type: 'json', placeholder: '0' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const expression = asString(ctx.options.expression);
        if (!expression) throw new Error('Array: Reduce — expression is required');
        const initial = parseJson<unknown>(ctx.options.initial, 'initial');
        const fn = new Function('acc', 'item', 'index', `return (${expression});`) as (acc: unknown, item: unknown, index: number) => unknown;
        const result = items.reduce((acc, item, index) => fn(acc, item, index), initial);
        return { outputs: { result } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
