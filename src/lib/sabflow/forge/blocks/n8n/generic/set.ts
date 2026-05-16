/**
 * Forge block: Set (Edit Fields)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Set/Set.node.ts (+ v1, v2)
 * Credential type: none — pure data transform.
 *
 * Operations covered:
 *   - set — write a list of key/value pairs into the flow variables
 *
 * Out of scope: dot-path notation, type coercion modes, "keep only set
 * fields" filter — all deferred. SabFlow has a native Set block; this port
 * exists for muscle-memory parity with n8n flow authors.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { asString } from '../_shared/http';

async function setValues(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const raw = ctx.options.values as ForgeKeyValuePair[] | undefined;
  const outputs: Record<string, unknown> = {};

  if (Array.isArray(raw)) {
    for (const pair of raw) {
      if (!pair?.key) continue;
      outputs[pair.key] = asString(pair.value);
    }
  }

  return {
    outputs,
    logs: [`Set → ${Object.keys(outputs).length} value(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_set_n8n',
  name: 'Set (n8n)',
  description: 'Write one or more values into flow variables.',
  iconName: 'LuPencilLine',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'set',
      label: 'Set values',
      description: 'Assign a list of key/value pairs into the flow.',
      fields: [
        {
          id: 'values',
          label: 'Values',
          type: 'key-value-list',
          helperText: 'Each entry becomes an output variable on this block.',
        },
      ],
      run: setValues,
    },
  ],
};

registerForgeBlock(block);
export default block;
