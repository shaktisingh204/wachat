/**
 * Forge block: String — Substring.
 * Pure-JS transform: extract a substring by start/end index.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_substring',
  name: 'String: Substring',
  description: 'Extract part of a string by start/end index.',
  iconName: 'LuScissors',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'substring',
      label: 'Substring',
      description: 'Slice the input between two indices.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true },
        { id: 'start', label: 'Start index', type: 'number', required: true, defaultValue: 0 },
        { id: 'end', label: 'End index', type: 'number', helperText: 'Leave empty to slice to the end.' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const start = asNumber(ctx.options.start) ?? 0;
        const end = asNumber(ctx.options.end);
        const result = end === undefined ? input.slice(start) : input.slice(start, end);
        return { outputs: { result, length: result.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
