/**
 * Forge block: JSON Parse
 *
 * Parses a JSON string into a structured value and writes it onto a flow
 * variable. Throws when the input is not valid JSON so callers can recover via
 * SabFlow's error edges instead of silently propagating a string.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_json_parse',
  name: 'JSON: Parse',
  description: 'Parse a JSON string into an object/array value.',
  iconName: 'LuFileJson',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse JSON',
      fields: [
        { id: 'input', label: 'JSON string', type: 'textarea', required: true },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        try {
          const value = JSON.parse(input);
          return { outputs: { value }, logs: ['JSON parsed'] };
        } catch (err) {
          throw new Error(`JSON parse failed: ${(err as Error).message}`);
        }
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
