/**
 * Forge block: Base64 Decode
 *
 * Decode a base64 string back into UTF-8 text. Mirrors `base64_encode.ts` by
 * preferring `globalThis.atob` and falling back to Buffer.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function decodeBase64(s: string): string {
  const g = globalThis as { atob?: (s: string) => string; Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } } };
  if (typeof g.atob === 'function') {
    const binary = g.atob(s);
    try {
      return decodeURIComponent(escape(binary));
    } catch {
      return binary;
    }
  }
  if (g.Buffer) {
    return g.Buffer.from(s, 'base64').toString('utf8');
  }
  throw new Error('No base64 decoder available in this runtime');
}

const block: ForgeBlock = {
  id: 'forge_base64_decode',
  name: 'Base64: Decode',
  description: 'Decode a base64 string back into UTF-8 text.',
  iconName: 'LuBinary',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'decode',
      label: 'Decode',
      fields: [{ id: 'input', label: 'Base64 input', type: 'textarea', required: true }],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input).trim();
        try {
          const decoded = decodeBase64(input);
          return { outputs: { decoded }, logs: [`Base64 decoded (${decoded.length} chars)`] };
        } catch (err) {
          throw new Error(`Base64 decode failed: ${(err as Error).message}`);
        }
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
