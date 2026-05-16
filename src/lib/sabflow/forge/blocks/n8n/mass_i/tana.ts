/**
 * Forge block: Tana
 *
 * API: https://github.com/tanainc/tana-input-api-samples (Input API)
 * Auth: `Authorization: Bearer <api_token>`.
 *
 * Operations covered:
 *   - node.create               POST  /api/v1/input
 *   - node.createWithSupertag   POST  /api/v1/input (with supertag id)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://europe-west1-tagr-prod.cloudfunctions.net';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiToken);
  if (!token) throw new Error('Tana: apiToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function nodeCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Tana: name is required');
  const targetNodeId = asString(ctx.options.targetNodeId);
  const description = asString(ctx.options.description);
  const node: Record<string, unknown> = { name };
  if (description) node.description = description;
  const body: Record<string, unknown> = { nodes: [node] };
  if (targetNodeId) body.targetNodeId = targetNodeId;
  const res = await apiRequest({
    service: 'Tana',
    method: 'POST',
    url: `${API}/addToNodeV2`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Tana node create → ${name}`] };
}

async function nodeCreateWithSupertag(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const supertagId = asString(ctx.options.supertagId);
  if (!name || !supertagId) throw new Error('Tana: name and supertagId are required');
  const targetNodeId = asString(ctx.options.targetNodeId);
  const node: Record<string, unknown> = {
    name,
    supertags: [{ id: supertagId }],
  };
  const description = asString(ctx.options.description);
  if (description) node.description = description;
  const body: Record<string, unknown> = { nodes: [node] };
  if (targetNodeId) body.targetNodeId = targetNodeId;
  const res = await apiRequest({
    service: 'Tana',
    method: 'POST',
    url: `${API}/addToNodeV2`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Tana node+supertag → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_tana',
  name: 'Tana',
  description: 'Push nodes into Tana via the Input API.',
  iconName: 'LuNetwork',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'node_create',
      label: 'Create node',
      description: 'Add a node, optionally to a target node.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'targetNodeId', label: 'Target node ID (optional)', type: 'text' },
      ],
      run: nodeCreate,
    },
    {
      id: 'node_create_supertag',
      label: 'Create node with supertag',
      description: 'Create a node tagged with a Tana supertag.',
      fields: [
        { id: 'apiToken', label: 'API token', type: 'password', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'supertagId', label: 'Supertag ID', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'targetNodeId', label: 'Target node ID (optional)', type: 'text' },
      ],
      run: nodeCreateWithSupertag,
    },
  ],
};

registerForgeBlock(block);
export default block;
