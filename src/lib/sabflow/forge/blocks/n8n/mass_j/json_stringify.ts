/**
 * Forge block: JSON Stringify
 *
 * Serialises any flow variable into a JSON string. Supports an optional
 * indent for pretty-printing — useful when piping into a downstream HTTP
 * request body or storing in SabFiles.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_json_stringify',
  name: 'JSON: Stringify',
  description: 'Serialise a value into a JSON string.',
  iconName: 'LuFileJson',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'stringify',
      label: 'Stringify',
      fields: [
        { id: 'value', label: 'Value', type: 'variable', required: true },
        { id: 'indent', label: 'Indent spaces', type: 'number', defaultValue: 0 },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const indent = asNumber(ctx.options.indent) ?? 0;
        try {
          const json = JSON.stringify(ctx.options.value, null, indent);
          return { outputs: { json }, logs: [`Stringified (${json?.length ?? 0} chars)`] };
        } catch (err) {
          throw new Error(`JSON stringify failed: ${(err as Error).message}`);
        }
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
