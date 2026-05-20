/**
 * Forge block: Set V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Set/v1/SetV1.node.ts
 *
 * Compat-shim — preserves the `forge_set_v1` id so flow files that pinned the
 * v1 node keep deserialising. The runtime simply delegates to the modern
 * `forge_set_n8n` action since the surface (a list of key/value pairs) is
 * structurally identical for SabFlow's purposes.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const modern = getForgeBlock('forge_set_n8n');
  if (!modern?.actions?.[0]) throw new Error('forge_set_n8n not registered');
  return modern.actions[0].run(ctx);
}

const block: ForgeBlock = {
  id: 'forge_set_v1',
  name: 'Set (v1)',
  description: 'Legacy Set v1 shape. Delegates to forge_set_n8n.',
  iconName: 'LuPencilLine',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'set_legacy',
      label: 'Set values (legacy)',
      description: 'V1 compatibility entry-point. Same fields, modern executor.',
      fields: [
        {
          id: 'values',
          label: 'Values',
          type: 'key-value-list',
          helperText: 'Each entry becomes an output variable on this block.',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
