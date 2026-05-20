/**
 * Forge block: Filter V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Filter/V1/FilterV1.node.ts
 *
 * Compat-shim — preserves the `forge_filter_v1` id for flow files pinned to
 * the v1 node. Delegates to the modern `forge_filter` action.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const modern = getForgeBlock('forge_filter');
  if (!modern?.actions?.[0]) throw new Error('forge_filter not registered');
  return modern.actions[0].run(ctx);
}

const block: ForgeBlock = {
  id: 'forge_filter_v1',
  name: 'Filter (v1)',
  description: 'Legacy Filter v1 shape. Delegates to forge_filter.',
  iconName: 'LuFilter',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'filter_legacy',
      label: 'Filter array (legacy v1)',
      description: 'V1 compatibility entry-point. Same fields, modern executor.',
      fields: [
        {
          id: 'input',
          label: 'Input array',
          type: 'json',
          required: true,
          placeholder: '[ { "status": "paid" }, { "status": "pending" } ]',
        },
        {
          id: 'predicate',
          label: 'Predicate (JavaScript)',
          type: 'code',
          required: true,
          placeholder: "item.status === 'paid'",
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
