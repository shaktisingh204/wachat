/**
 * Forge block: Merge V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Merge/v2/MergeV2.node.ts
 *
 * Compat-shim — preserves the `forge_merge_v2` id for flow files pinned to
 * the v2 node. Delegates to the modern `forge_merge` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

function delegate(actionId: string) {
  return async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
    const modern = getForgeBlock('forge_merge');
    if (!modern) throw new Error('forge_merge not registered');
    const action = modern.actions?.find((a) => a.id === actionId);
    if (!action) throw new Error(`forge_merge action "${actionId}" not found`);
    return action.run(ctx);
  };
}

const block: ForgeBlock = {
  id: 'forge_merge_v2',
  name: 'Merge (v2)',
  description: 'Legacy Merge v2 shape. Delegates to forge_merge.',
  iconName: 'LuMerge',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'append',
      label: 'Append (legacy v2)',
      description: 'Concatenate left + right into a single array.',
      fields: [
        { id: 'left', label: 'Left array', type: 'json', required: true },
        { id: 'right', label: 'Right array', type: 'json', required: true },
      ],
      run: delegate('append'),
    },
    {
      id: 'merge_by_key',
      label: 'Merge by key (legacy v2)',
      description: 'Outer-join two arrays of objects on a shared key.',
      fields: [
        { id: 'left', label: 'Left array', type: 'json', required: true },
        { id: 'right', label: 'Right array', type: 'json', required: true },
        { id: 'leftKey', label: 'Left key', type: 'text', required: true, placeholder: 'id' },
        {
          id: 'rightKey',
          label: 'Right key (defaults to left key)',
          type: 'text',
          placeholder: 'id',
        },
      ],
      run: delegate('merge_by_key'),
    },
  ],
};

registerForgeBlock(block);
export default block;
