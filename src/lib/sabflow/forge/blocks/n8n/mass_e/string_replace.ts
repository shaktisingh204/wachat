/**
 * Forge block: String — Replace.
 * Pure-JS transform: regex (or literal) find + replace.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_replace',
  name: 'String: Replace',
  description: 'Find and replace text in a string (literal or regex).',
  iconName: 'LuReplace',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'replace',
      label: 'Replace',
      description: 'Replace occurrences of a pattern.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true },
        { id: 'pattern', label: 'Find', type: 'text', required: true, placeholder: 'foo' },
        { id: 'replacement', label: 'Replace with', type: 'text', placeholder: 'bar' },
        { id: 'useRegex', label: 'Use regex', type: 'toggle', defaultValue: false },
        { id: 'flags', label: 'Regex flags', type: 'text', placeholder: 'g', helperText: 'e.g. "g", "gi" — only used when regex is enabled.' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const pattern = asString(ctx.options.pattern);
        const replacement = asString(ctx.options.replacement);
        const useRegex = asBoolean(ctx.options.useRegex);
        const flags = asString(ctx.options.flags) || 'g';

        let result: string;
        if (useRegex) {
          const re = new RegExp(pattern, flags);
          result = input.replace(re, replacement);
        } else {
          result = input.split(pattern).join(replacement);
        }
        return { outputs: { result } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
