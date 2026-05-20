/**
 * Forge block: Switch V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Switch/V1/SwitchV1.node.ts
 *
 * Compat-shim — preserves the `forge_switch_v1` id for flow files pinned to
 * the v1 node. Delegates to the modern `forge_switch_n8n` action.
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
  id: 'forge_switch_v1',
  name: 'Switch (v1)',
  description: 'Legacy Switch v1 shape. Delegates to forge_switch_n8n.',
  iconName: 'LuRoute',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'route_legacy',
      label: 'Route by case (legacy v1)',
      description: 'V1 compatibility entry-point. Same fields, modern executor.',
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
