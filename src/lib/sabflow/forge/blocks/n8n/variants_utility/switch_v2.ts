/**
 * Forge block: Switch V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Switch/V2/SwitchV2.node.ts
 *
 * Compat-shim — preserves the `forge_switch_v2` id for flow files pinned to
 * the v2 node. Delegates to the modern `forge_switch_n8n` action.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const modern = getForgeBlock('forge_switch_n8n');
  if (!modern?.actions?.[0]) throw new Error('forge_switch_n8n not registered');
  return modern.actions[0].run(ctx);
}

const block: ForgeBlock = {
  id: 'forge_switch_v2',
  name: 'Switch (v2)',
  description: 'Legacy Switch v2 shape. Delegates to forge_switch_n8n.',
  iconName: 'LuRoute',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'route_legacy',
      label: 'Route by case (legacy v2)',
      description: 'V2 compatibility entry-point. Same fields, modern executor.',
      fields: [
        {
          id: 'expression',
          label: 'Expression (JavaScript)',
          type: 'code',
          required: true,
          placeholder: 'vars.status',
          helperText: 'Receives `vars`. Result is stringified before matching.',
        },
        {
          id: 'cases',
          label: 'Cases (comma-separated)',
          type: 'text',
          required: true,
          placeholder: 'paid, pending, failed',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
