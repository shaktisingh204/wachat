/**
 * Forge block: UUID v4
 *
 * Generate a random RFC 4122 v4 UUID. Prefer `crypto.randomUUID()` when the
 * runtime exposes it (Node ≥ 19, modern browsers); fall back to a Math.random
 * implementation for older environments. The fallback is NOT cryptographically
 * strong — only used when crypto is unavailable.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const block: ForgeBlock = {
  id: 'forge_uuid_v4',
  name: 'UUID: v4',
  description: 'Generate a random v4 UUID.',
  iconName: 'LuFingerprint',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate UUID',
      fields: [],
      run: async (_ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const g = globalThis as { crypto?: { randomUUID?: () => string } };
        const uuid = g.crypto?.randomUUID?.() ?? fallbackUuid();
        return { outputs: { uuid } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
