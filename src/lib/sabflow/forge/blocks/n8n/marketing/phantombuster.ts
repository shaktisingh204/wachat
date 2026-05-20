/**
 * Forge block: PhantomBuster
 *
 * Source: n8n-master/packages/nodes-base/nodes/Phantombuster/Phantombuster.node.ts
 * Credential type: 'phantombuster' — { apiKey } sent as `X-Phantombuster-Key-1` header.
 *
 * Operations covered:
 *   - agent.list
 *   - agent.get
 *   - agent.launch
 *   - agent.output (fetchOutput)
 *   - agent.delete
 *   - agent.fetchResultObject (downloads the parsed result-object the agent
 *     stored after its run — n8n calls this `resolveData=true` on getOutput,
 *     but flow authors usually want it as its own block so they can chain
 *     directly off a container id).
 *
 * Out of scope (deferred):
 *   - get-progress / persisted state inspection: those return raw run-state
 *     blobs that are only useful from inside the PhantomBuster UI.
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

async function agentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const agentId = asString(ctx.options.agentId);
  if (!agentId) throw new Error('PhantomBuster: agentId is required');
  const res = await apiRequest({
    service: 'PhantomBuster',
    method: 'GET',
    url: `${BASE}/agents/fetch?id=${encodeURIComponent(agentId)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { agent: res.data }, logs: [`PhantomBuster agent get → ${agentId}`] };
}

async function agentDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const agentId = asString(ctx.options.agentId);
  if (!agentId) throw new Error('PhantomBuster: agentId is required');
  await call(ctx, 'POST', '/agents/delete', { id: agentId });
  return { outputs: { success: true }, logs: [`PhantomBuster agent delete → ${agentId}`] };
}

async function agentFetchResultObject(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const containerId = asString(ctx.options.containerId);
  if (!containerId) throw new Error('PhantomBuster: containerId is required');
  const res = await apiRequest({
    service: 'PhantomBuster',
    method: 'GET',
    url: `${BASE}/containers/fetch-result-object?id=${encodeURIComponent(containerId)}`,
    headers: authHeader(ctx),
  });
  // PhantomBuster returns the result as a stringified JSON in `resultObject`;
  // parse it eagerly so downstream blocks don't need to JSON.parse again.
  const raw = (res.data as { resultObject?: string | null })?.resultObject ?? null;
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }
  return { outputs: { result: parsed }, logs: [`PhantomBuster fetch-result-object → ${containerId}`] };
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
      id: 'agent_get',
      label: 'Get agent',
      description: 'Fetch a single agent definition by id.',
      fields: [
        { id: 'agentId', label: 'Agent ID', type: 'text', required: true },
      ],
      run: agentGet,
    },
    {
      id: 'agent_delete',
      label: 'Delete agent',
      description: 'Delete an agent from the workspace.',
      fields: [
        { id: 'agentId', label: 'Agent ID', type: 'text', required: true },
      ],
      run: agentDelete,
    },
    {
      id: 'agent_fetch_result_object',
      label: 'Fetch container result-object',
      description: 'Download the parsed result-object stored by an agent run.',
      fields: [
        { id: 'containerId', label: 'Container ID', type: 'text', required: true },
      ],
      run: agentFetchResultObject,
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
