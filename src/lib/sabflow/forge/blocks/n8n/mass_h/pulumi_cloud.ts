/**
 * Forge block: Pulumi Cloud
 *
 * `https://api.pulumi.com/api` — stacks list, stack details, latest update.
 * Auth: `Authorization: token <PAT>`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.pulumi.com/api';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiKey);
  if (!token) throw new Error('Pulumi: apiKey is required');
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.pulumi+8',
  };
}

async function listStacks(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const organization = asString(ctx.options.organization);
  const project = asString(ctx.options.project);
  const params = new URLSearchParams();
  if (organization) params.set('organization', organization);
  if (project) params.set('project', project);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Pulumi',
    method: 'GET',
    url: `${API}/user/stacks${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { stacks: res.data }, logs: ['Pulumi list stacks'] };
}

async function getStack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const organization = asString(ctx.options.organization);
  const project = asString(ctx.options.project);
  const stack = asString(ctx.options.stack);
  if (!organization || !project || !stack) {
    throw new Error('Pulumi: organization, project and stack are all required');
  }
  const res = await apiRequest({
    service: 'Pulumi',
    method: 'GET',
    url: `${API}/stacks/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/${encodeURIComponent(stack)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { stack: res.data }, logs: [`Pulumi get stack → ${organization}/${project}/${stack}`] };
}

async function getLatestUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const organization = asString(ctx.options.organization);
  const project = asString(ctx.options.project);
  const stack = asString(ctx.options.stack);
  if (!organization || !project || !stack) {
    throw new Error('Pulumi: organization, project and stack are all required');
  }
  const res = await apiRequest({
    service: 'Pulumi',
    method: 'GET',
    url: `${API}/stacks/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/${encodeURIComponent(stack)}/updates/latest`,
    headers: authHeaders(ctx),
  });
  return { outputs: { update: res.data }, logs: [`Pulumi latest update → ${organization}/${project}/${stack}`] };
}

const block: ForgeBlock = {
  id: 'forge_pulumi_cloud',
  name: 'Pulumi Cloud',
  description: 'Inspect Pulumi Cloud stacks and the latest stack update.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_stacks',
      label: 'List stacks',
      fields: [
        { id: 'apiKey', label: 'Personal access token', type: 'password', required: true },
        { id: 'organization', label: 'Organization', type: 'text' },
        { id: 'project', label: 'Project', type: 'text' },
      ],
      run: listStacks,
    },
    {
      id: 'get_stack',
      label: 'Get stack',
      fields: [
        { id: 'apiKey', label: 'Personal access token', type: 'password', required: true },
        { id: 'organization', label: 'Organization', type: 'text', required: true },
        { id: 'project', label: 'Project', type: 'text', required: true },
        { id: 'stack', label: 'Stack', type: 'text', required: true },
      ],
      run: getStack,
    },
    {
      id: 'get_latest_update',
      label: 'Get latest update',
      fields: [
        { id: 'apiKey', label: 'Personal access token', type: 'password', required: true },
        { id: 'organization', label: 'Organization', type: 'text', required: true },
        { id: 'project', label: 'Project', type: 'text', required: true },
        { id: 'stack', label: 'Stack', type: 'text', required: true },
      ],
      run: getLatestUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
