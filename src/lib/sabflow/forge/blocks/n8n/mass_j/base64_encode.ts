/**
 * Forge block: Base64 Encode
 *
 * Encodes a UTF-8 string into base64. Uses `globalThis.btoa` when available
 * (after first encoding into a binary string) and falls back to Buffer in
 * Node.js — keeping the block client-safe at the top level.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function encodeBase64(s: string): string {
  const g = globalThis as { btoa?: (s: string) => string; Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } } };
  if (typeof g.btoa === 'function') {
    // btoa expects a "binary string". Convert UTF-8 → binary first.
    const utf8 = unescape(encodeURIComponent(s));
    return g.btoa(utf8);
  }
  if (g.Buffer) {
    return g.Buffer.from(s, 'utf8').toString('base64');
  }
  throw new Error('No base64 encoder available in this runtime');
}

const block: ForgeBlock = {
  id: 'forge_base64_encode',
  name: 'Base64: Encode',
  description: 'Encode a UTF-8 string into base64.',
  iconName: 'LuBinary',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'encode',
      label: 'Encode',
      fields: [{ id: 'input', label: 'Input', type: 'textarea', required: true }],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const encoded = encodeBase64(input);
        return { outputs: { encoded }, logs: [`Base64 encoded (${encoded.length} chars)`] };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
