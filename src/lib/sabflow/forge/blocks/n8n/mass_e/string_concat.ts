/**
 * Forge block: String — Concat.
 * Pure-JS transform: join an array of values with a separator.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_string_concat',
  name: 'String: Concat',
  description: 'Join an array of values into a single string.',
  iconName: 'LuJoin',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'concat',
      label: 'Concat',
      description: 'Join the items of a JSON array with a separator.',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '["a","b","c"]' },
        { id: 'separator', label: 'Separator', type: 'text', defaultValue: ',', placeholder: ', ' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const separator = asString(ctx.options.separator);
        const result = items.map((v) => (v == null ? '' : String(v))).join(separator);
        return { outputs: { result, count: items.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
