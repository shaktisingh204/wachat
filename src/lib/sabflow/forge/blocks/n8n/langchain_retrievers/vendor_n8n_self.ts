/**
 * Forge block: SabFlow Self (n8n vendor stub)
 *
 * Source: n8n-master/packages/@n8n/nodes-base/nodes/N8n/N8n.node.ts
 *
 * Read-only self-introspection. n8n's own "n8n" node lets a flow query the
 * host instance — we expose the runtime tag and current flow variables so
 * downstream blocks (or LLM agents) can reason about the execution context.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';

async function introspect(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return {
    outputs: {
      runtime: 'sabflow',
      vars: ctx.variables,
      note: 'read-only self introspection',
    },
    logs: ['SabFlowSelf → runtime info returned'],
  };
}

const block: ForgeBlock = {
  id: 'forge_vendor_n8n_self',
  name: 'SabFlow Self (info)',
  description: 'Read-only self-introspection: returns runtime tag and current flow variables.',
  iconName: 'LuInfo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'introspect',
      label: 'Introspect runtime',
      description: 'Return runtime tag and current flow variables.',
      fields: [],
      run: introspect,
    },
  ],
};

registerForgeBlock(block);
export default block;
