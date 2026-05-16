/**
 * Forge block: String — Split.
 * Pure-JS transform: split a string by delimiter into an array.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_split',
  name: 'String: Split',
  description: 'Split a string by a delimiter into an array.',
  iconName: 'LuSplit',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'split',
      label: 'Split',
      description: 'Break the input into pieces by delimiter.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true },
        { id: 'delimiter', label: 'Delimiter', type: 'text', required: true, defaultValue: ',', placeholder: ',' },
        { id: 'limit', label: 'Max pieces', type: 'number', placeholder: 'optional' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const delimiter = asString(ctx.options.delimiter);
        const limit = asNumber(ctx.options.limit);
        const parts = limit === undefined ? input.split(delimiter) : input.split(delimiter, limit);
        return { outputs: { result: parts, count: parts.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
