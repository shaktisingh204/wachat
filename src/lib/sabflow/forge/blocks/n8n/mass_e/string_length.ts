/**
 * Forge block: String — Length.
 * Pure-JS transform: returns the string's character length.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_length',
  name: 'String: Length',
  description: 'Get the length of a string.',
  iconName: 'LuRuler',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'length',
      label: 'Length',
      description: 'Return the number of characters in the input.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        return { outputs: { result: input.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
