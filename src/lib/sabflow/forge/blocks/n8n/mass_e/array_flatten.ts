/**
 * Forge block: Array — Flatten.
 * Pure-JS transform: flattens nested arrays to a given depth.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_flatten',
  name: 'Array: Flatten',
  description: 'Flatten nested arrays to a given depth.',
  iconName: 'LuLayers',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'flatten',
      label: 'Flatten',
      description: 'Recursively flatten arrays. Depth defaults to 1; use Infinity-like values for deep flatten.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[[1,2],[3,[4]]]' },
        { id: 'depth', label: 'Depth', type: 'number', defaultValue: 1, helperText: 'Use a large number (e.g. 99) for deep flatten.' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const depth = asNumber(ctx.options.depth) ?? 1;
        const result = (items as unknown[]).flat(depth as number);
        return { outputs: { result, count: result.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
