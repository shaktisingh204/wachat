/**
 * Forge block: Vercel
 *
 * `https://api.vercel.com` — projects, deployments, triggering redeploys.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.vercel.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiKey);
  if (!token) throw new Error('Vercel: apiKey is required');
  return { Authorization: `Bearer ${token}` };
}

function teamQuery(ctx: ForgeActionContext, extra?: URLSearchParams): string {
  const teamId = asString(ctx.options.teamId);
  const params = extra ?? new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function listProjects(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Vercel',
    method: 'GET',
    url: `${API}/v9/projects${teamQuery(ctx)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { projects: res.data }, logs: ['Vercel list projects'] };
}

async function listDeployments(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const limit = asString(ctx.options.limit);
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (limit) params.set('limit', limit);
  const res = await apiRequest({
    service: 'Vercel',
    method: 'GET',
    url: `${API}/v6/deployments${teamQuery(ctx, params)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { deployments: res.data }, logs: ['Vercel list deployments'] };
}

async function getDeployment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.deploymentId);
  if (!id) throw new Error('Vercel: deploymentId is required');
  const res = await apiRequest({
    service: 'Vercel',
    method: 'GET',
    url: `${API}/v13/deployments/${encodeURIComponent(id)}${teamQuery(ctx)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { deployment: res.data }, logs: [`Vercel get deployment → ${id}`] };
}

async function redeploy(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const deploymentId = asString(ctx.options.deploymentId);
  if (!name) throw new Error('Vercel: name is required');
  if (!deploymentId) throw new Error('Vercel: deploymentId is required');
  const res = await apiRequest({
    service: 'Vercel',
    method: 'POST',
    url: `${API}/v13/deployments${teamQuery(ctx)}`,
    headers: authHeaders(ctx),
    json: { name, deploymentId, target: asString(ctx.options.target) || 'production' },
  });
  return { outputs: { deployment: res.data }, logs: [`Vercel redeploy → ${deploymentId}`] };
}

const block: ForgeBlock = {
  id: 'forge_vercel',
  name: 'Vercel',
  description: 'Manage Vercel projects and deployments via the REST API.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_projects',
      label: 'List projects',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'teamId', label: 'Team ID (optional)', type: 'text' },
      ],
      run: listProjects,
    },
    {
      id: 'list_deployments',
      label: 'List deployments',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'teamId', label: 'Team ID (optional)', type: 'text' },
        { id: 'projectId', label: 'Project ID (optional)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: listDeployments,
    },
    {
      id: 'get_deployment',
      label: 'Get deployment',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'teamId', label: 'Team ID (optional)', type: 'text' },
        { id: 'deploymentId', label: 'Deployment ID', type: 'text', required: true },
      ],
      run: getDeployment,
    },
    {
      id: 'redeploy',
      label: 'Redeploy',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'teamId', label: 'Team ID (optional)', type: 'text' },
        { id: 'name', label: 'Project name', type: 'text', required: true },
        { id: 'deploymentId', label: 'Source deployment ID', type: 'text', required: true },
        { id: 'target', label: 'Target', type: 'select', options: [
          { label: 'Production', value: 'production' },
          { label: 'Preview', value: 'preview' },
        ], defaultValue: 'production' },
      ],
      run: redeploy,
    },
  ],
};

registerForgeBlock(block);
export default block;
