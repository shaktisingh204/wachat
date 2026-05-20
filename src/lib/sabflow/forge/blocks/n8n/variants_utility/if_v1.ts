/**
 * Forge block: If V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/If/V1/IfV1.node.ts
 *
 * Compat-shim — preserves the `forge_if_v1` id for flow files pinned to the
 * v1 node. Delegates to the modern `forge_if` action.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const modern = getForgeBlock('forge_if');
  if (!modern?.actions?.[0]) throw new Error('forge_if not registered');
  return modern.actions[0].run(ctx);
}

const block: ForgeBlock = {
  id: 'forge_if_v1',
  name: 'If (v1)',
  description: 'Legacy If v1 shape. Delegates to forge_if.',
  iconName: 'LuGitBranch',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'evaluate_legacy',
      label: 'Evaluate condition (legacy v1)',
      description: 'V1 compatibility entry-point. Same fields, modern executor.',
      fields: [
        {
          id: 'condition',
          label: 'Condition (JavaScript expression)',
          type: 'code',
          required: true,
          placeholder: "vars.status === 'paid' && vars.total > 0",
          helperText: 'Receives `vars` — the current flow variables object.',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
