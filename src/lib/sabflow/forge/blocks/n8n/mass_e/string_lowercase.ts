/**
 * Forge block: String — Lowercase.
 * Pure-JS transform: converts a string to lower case.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_lowercase',
  name: 'String: Lowercase',
  description: 'Convert a string to lowercase.',
  iconName: 'LuType',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'lowercase',
      label: 'Lowercase',
      description: 'Return the input transformed to lower case.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true, placeholder: 'HELLO' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        return { outputs: { result: input.toLowerCase() } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
