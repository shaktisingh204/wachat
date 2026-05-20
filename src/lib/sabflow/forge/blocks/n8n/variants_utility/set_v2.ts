/**
 * Forge block: Set V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Set/v2/SetV2.node.ts
 *
 * Compat-shim — preserves the `forge_set_v2` id for flow files pinned to the
 * v2 node. Delegates to the modern `forge_set_n8n` action.
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
  id: 'forge_set_v2',
  name: 'Set (v2)',
  description: 'Legacy Set v2 shape. Delegates to forge_set_n8n.',
  iconName: 'LuPencilLine',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'set_legacy',
      label: 'Set values (legacy v2)',
      description: 'V2 compatibility entry-point. Same fields, modern executor.',
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
