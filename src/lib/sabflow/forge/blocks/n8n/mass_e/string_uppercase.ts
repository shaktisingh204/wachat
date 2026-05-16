/**
 * Forge block: String — Uppercase.
 * Pure-JS transform: converts a string to upper case.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_uppercase',
  name: 'String: Uppercase',
  description: 'Convert a string to uppercase.',
  iconName: 'LuType',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'uppercase',
      label: 'Uppercase',
      description: 'Return the input transformed to upper case.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true, placeholder: 'hello' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        return { outputs: { result: input.toUpperCase() } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
