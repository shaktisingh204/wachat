/**
 * Forge block: Hash SHA-1
 *
 * Compute the SHA-1 digest of a string. `node:crypto` is dynamically imported
 * inside `run` so the block stays client-safe at the top level.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_hash_sha1',
  name: 'Hash: SHA-1',
  description: 'Compute SHA-1 hash of a string.',
  iconName: 'LuFileCode',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'hash',
      label: 'SHA-1',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        {
          id: 'encoding',
          label: 'Output',
          type: 'select',
          defaultValue: 'hex',
          options: [
            { value: 'hex', label: 'Hex' },
            { value: 'base64', label: 'Base64' },
          ],
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const { createHash } = await import('node:crypto');
        const input = asString(ctx.options.input);
        const encoding = (asString(ctx.options.encoding) || 'hex') as 'hex' | 'base64';
        const hash = createHash('sha1').update(input).digest(encoding);
        return { outputs: { hash } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
