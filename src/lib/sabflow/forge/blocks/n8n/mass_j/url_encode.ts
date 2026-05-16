/**
 * Forge block: URL Encode
 *
 * Percent-encode a string with `encodeURIComponent` semantics — safe for use
 * as a query-string value or path segment.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_url_encode',
  name: 'URL: Encode',
  description: 'Percent-encode a string with encodeURIComponent.',
  iconName: 'LuLink',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'encode',
      label: 'Encode',
      fields: [{ id: 'input', label: 'Input', type: 'text', required: true }],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const encoded = encodeURIComponent(input);
        return { outputs: { encoded } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
