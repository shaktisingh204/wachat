/**
 * Forge block: Render
 *
 * `https://api.render.com/v1` — services list/get + trigger deploy.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

const API = 'https://api.render.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Render: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function listServices(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit);
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Render',
    method: 'GET',
    url: `${API}/services${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { services: res.data }, logs: ['Render list services'] };
}

async function getService(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.serviceId);
  if (!id) throw new Error('Render: serviceId is required');
  const res = await apiRequest({
    service: 'Render',
    method: 'GET',
    url: `${API}/services/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { service: res.data }, logs: [`Render get service → ${id}`] };
}

async function triggerDeploy(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.serviceId);
  const clearCache = asBoolean(ctx.options.clearCache);
  if (!id) throw new Error('Render: serviceId is required');
  const body: Record<string, unknown> = {};
  if (clearCache) body.clearCache = 'clear';
  const res = await apiRequest({
    service: 'Render',
    method: 'POST',
    url: `${API}/services/${encodeURIComponent(id)}/deploys`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { deploy: res.data }, logs: [`Render trigger deploy → ${id}`] };
}

async function listDeploys(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.serviceId);
  if (!id) throw new Error('Render: serviceId is required');
  const res = await apiRequest({
    service: 'Render',
    method: 'GET',
    url: `${API}/services/${encodeURIComponent(id)}/deploys`,
    headers: authHeaders(ctx),
  });
  return { outputs: { deploys: res.data }, logs: [`Render list deploys → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_render',
  name: 'Render',
  description: 'Manage Render services and trigger deploys.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_services',
      label: 'List services',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: listServices,
    },
    {
      id: 'get_service',
      label: 'Get service',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'serviceId', label: 'Service ID', type: 'text', required: true },
      ],
      run: getService,
    },
    {
      id: 'trigger_deploy',
      label: 'Trigger deploy',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'serviceId', label: 'Service ID', type: 'text', required: true },
        { id: 'clearCache', label: 'Clear build cache', type: 'toggle' },
      ],
      run: triggerDeploy,
    },
    {
      id: 'list_deploys',
      label: 'List deploys',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'serviceId', label: 'Service ID', type: 'text', required: true },
      ],
      run: listDeploys,
    },
  ],
};

registerForgeBlock(block);
export default block;
