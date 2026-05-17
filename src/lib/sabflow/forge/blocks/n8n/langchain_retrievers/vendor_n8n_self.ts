/**
 * Forge block: SabFlow Self (n8n vendor port)
 *
 * Source: n8n-master/packages/@n8n/nodes-base/nodes/N8n/N8n.node.ts
 *
 * Read-only self-introspection. n8n's own "n8n" node lets a flow query the
 * host instance — we expose the runtime tag, workspace owner, current
 * caller stack (for sub-workflow debugging), and a snapshot of flow
 * variables so downstream blocks (or LLM agents) can reason about the
 * execution context.
 *
 * No external calls — purely synchronous metadata return.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';

const SABFLOW_VERSION = '1.0';

async function introspect(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const variableCount = Object.keys(ctx.variables ?? {}).length;
  const callerStack = ctx.callerStack ?? [];
  return {
    outputs: {
      runtime: 'sabflow',
      version: SABFLOW_VERSION,
      // Workspace owner (userId) — populated when the worker passed tenant
      // identity through. Useful for downstream blocks that want to scope by
      // owner without round-tripping to a session lookup.
      workspaceId: ctx.userId ?? null,
      authenticated: Boolean(ctx.userId),
      callerStack,
      callerDepth: callerStack.length,
      variableCount,
      variables: ctx.variables ?? {},
      // Process tag — handy when debugging multi-worker deployments.
      hostnameTag: process.env.HOSTNAME ?? null,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
    logs: [
      `SabFlowSelf → workspace=${ctx.userId ?? '<none>'} depth=${callerStack.length} vars=${variableCount}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_vendor_n8n_self',
  name: 'SabFlow Self (info)',
  description: 'Read-only self-introspection: runtime tag, workspace owner, caller stack, and flow variables.',
  iconName: 'LuInfo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'introspect',
      label: 'Introspect runtime',
      description: 'Return runtime tag, workspace owner, caller stack, and current flow variables.',
      fields: [],
      run: introspect,
    },
  ],
};

registerForgeBlock(block);
export default block;
