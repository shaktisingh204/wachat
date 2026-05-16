/**
 * Forge block: PhantomBuster
 *
 * Source: n8n-master/packages/nodes-base/nodes/Phantombuster/Phantombuster.node.ts
 * Credential type: 'phantombuster' — { apiKey } sent as `X-Phantombuster-Key-1` header.
 *
 * Operations covered:
 *   - agent.list
 *   - agent.launch
 *   - agent.output (fetchOutput)
 *
 * Out of scope (deferred):
 *   - delete agent / get-progress / persisted state inspection
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.phantombuster.com/api/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('PhantomBuster', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('PhantomBuster: credential is missing `apiKey`');
  return { 'X-Phantombuster-Key-1': key };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'PhantomBuster',
    method,
    url: `${BASE}${path}`,
    headers: authHeader(ctx),
    json,
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function agentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', '/agents/fetch-all');
  return { outputs: { result: data }, logs: ['PhantomBuster agent list'] };
}

async function agentLaunch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const agentId = asString(ctx.options.agentId);
  if (!agentId) throw new Error('PhantomBuster: agentId is required');
  const args = asString(ctx.options.argument);
  let argument: unknown;
  if (args) {
    try {
      argument = JSON.parse(args);
    } catch {
      throw new Error('PhantomBuster: argument must be valid JSON');
    }
  }
  const body: Record<string, unknown> = { id: agentId };
  if (argument !== undefined) body.argument = argument;
  const data = await call(ctx, 'POST', '/agents/launch', body);
  return { outputs: { result: data }, logs: [`PhantomBuster agent launch → ${agentId}`] };
}

async function agentOutput(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const agentId = asString(ctx.options.agentId);
  if (!agentId) throw new Error('PhantomBuster: agentId is required');
  const containerId = asString(ctx.options.containerId);
  const qs = new URLSearchParams({ id: agentId });
  if (containerId) qs.set('containerId', containerId);
  const res = await apiRequest({
    service: 'PhantomBuster',
    method: 'GET',
    url: `${BASE}/agents/fetch-output?${qs.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: [`PhantomBuster agent output → ${agentId}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_phantombuster',
  name: 'PhantomBuster',
  description: 'List, launch and inspect PhantomBuster agents.',
  iconName: 'LuGhost',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'phantombuster',
  },
  actions: [
    {
      id: 'agent_list',
      label: 'List agents',
      description: 'List all agents in the workspace.',
      fields: [],
      run: agentList,
    },
    {
      id: 'agent_launch',
      label: 'Launch agent',
      description: 'Trigger an agent run, optionally with a JSON argument.',
      fields: [
        { id: 'agentId', label: 'Agent ID', type: 'text', required: true },
        { id: 'argument', label: 'Argument (JSON)', type: 'json' },
      ],
      run: agentLaunch,
    },
    {
      id: 'agent_output',
      label: 'Get agent output',
      description: 'Fetch the latest output of an agent run.',
      fields: [
        { id: 'agentId', label: 'Agent ID', type: 'text', required: true },
        { id: 'containerId', label: 'Container ID', type: 'text' },
      ],
      run: agentOutput,
    },
  ],
};

registerForgeBlock(block);
export default block;
