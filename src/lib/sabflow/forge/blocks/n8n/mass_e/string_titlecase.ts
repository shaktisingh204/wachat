/**
 * Forge block: String — Title Case.
 * Pure-JS transform: capitalises the first letter of each word.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function toTitleCase(input: string): string {
  return input.toLowerCase().replace(/\b([a-z])/g, (_m, ch: string) => ch.toUpperCase());
}

const block: ForgeBlock = {
  id: 'forge_string_titlecase',
  name: 'String: Title Case',
  description: 'Convert a string to title case.',
  iconName: 'LuType',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'titlecase',
      label: 'Title case',
      description: 'Capitalise the first letter of each word.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true, placeholder: 'hello world' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        return { outputs: { result: toTitleCase(input) } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
