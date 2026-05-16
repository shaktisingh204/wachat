/**
 * Forge block: String — Trim.
 * Pure-JS transform: removes leading/trailing whitespace.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_string_trim',
  name: 'String: Trim',
  description: 'Trim leading and trailing whitespace from a string.',
  iconName: 'LuType',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'trim',
      label: 'Trim',
      description: 'Strip whitespace from both ends.',
      fields: [
        {
          id: 'input',
          label: 'Input',
          type: 'text',
          required: true,
          placeholder: '  hello  ',
        },
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          defaultValue: 'both',
          options: [
            { label: 'Both ends', value: 'both' },
            { label: 'Start only', value: 'start' },
            { label: 'End only', value: 'end' },
          ],
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const mode = asString(ctx.options.mode) || 'both';
        let result = input;
        if (mode === 'start') result = input.trimStart();
        else if (mode === 'end') result = input.trimEnd();
        else result = input.trim();
        return { outputs: { result } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
