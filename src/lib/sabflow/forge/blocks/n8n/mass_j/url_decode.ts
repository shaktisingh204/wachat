/**
 * Forge block: URL Decode
 *
 * Reverse of `url_encode.ts` — runs `decodeURIComponent` and throws on
 * malformed input.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_url_decode',
  name: 'URL: Decode',
  description: 'Decode a percent-encoded string.',
  iconName: 'LuLink',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'decode',
      label: 'Decode',
      fields: [{ id: 'input', label: 'Input', type: 'text', required: true }],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        try {
          const decoded = decodeURIComponent(input);
          return { outputs: { decoded } };
        } catch (err) {
          throw new Error(`URL decode failed: ${(err as Error).message}`);
        }
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
