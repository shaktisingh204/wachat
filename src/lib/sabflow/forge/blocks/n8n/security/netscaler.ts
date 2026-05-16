/**
 * Forge block: Netscaler ADC (NITRO)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Netscaler/ADC/NetscalerAdc.node.ts
 *
 * Basic-auth (username + password) against the ADC management IP. NITRO API
 * lives at `${baseUrl}/nitro/v1/config/`.
 *
 * Operations covered:
 *   - lbvserver.list   GET /nitro/v1/config/lbvserver
 *   - lbvserver.get    GET /nitro/v1/config/lbvserver/{name}
 *   - service.list     GET /nitro/v1/config/service
 *   - server.list      GET /nitro/v1/config/server
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.baseUrl);
  if (!raw) throw new Error('Netscaler: baseUrl is required');
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password);
  if (!username || !password) throw new Error('Netscaler: username and password are required');
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

async function lbVserverList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Netscaler',
    method: 'GET',
    url: `${base(ctx)}/nitro/v1/config/lbvserver`,
    headers: authHeader(ctx),
  });
  return { outputs: { lbvservers: res.data }, logs: ['Netscaler lbvserver.list'] };
}

async function lbVserverGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Netscaler: name is required');
  const res = await apiRequest({
    service: 'Netscaler',
    method: 'GET',
    url: `${base(ctx)}/nitro/v1/config/lbvserver/${encodeURIComponent(name)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { lbvserver: res.data }, logs: [`Netscaler lbvserver.get → ${name}`] };
}

async function serviceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Netscaler',
    method: 'GET',
    url: `${base(ctx)}/nitro/v1/config/service`,
    headers: authHeader(ctx),
  });
  return { outputs: { services: res.data }, logs: ['Netscaler service.list'] };
}

async function serverList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Netscaler',
    method: 'GET',
    url: `${base(ctx)}/nitro/v1/config/server`,
    headers: authHeader(ctx),
  });
  return { outputs: { servers: res.data }, logs: ['Netscaler server.list'] };
}

const credFields = [
  { id: 'baseUrl', label: 'ADC base URL', type: 'text' as const, required: true, placeholder: 'https://adc.example.com' },
  { id: 'username', label: 'Username', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_netscaler',
  name: 'Netscaler ADC',
  description: 'Read load-balancer, service and server configuration over the NITRO API.',
  iconName: 'LuServer',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'lbvserver_list',
      label: 'List load-balancer vservers',
      description: 'List all lb vservers on the ADC.',
      fields: [...credFields],
      run: lbVserverList,
    },
    {
      id: 'lbvserver_get',
      label: 'Get load-balancer vserver',
      description: 'Fetch a single lb vserver by name.',
      fields: [
        ...credFields,
        { id: 'name', label: 'Name', type: 'text', required: true },
      ],
      run: lbVserverGet,
    },
    {
      id: 'service_list',
      label: 'List services',
      description: 'List bound services on the ADC.',
      fields: [...credFields],
      run: serviceList,
    },
    {
      id: 'server_list',
      label: 'List servers',
      description: 'List backend servers configured on the ADC.',
      fields: [...credFields],
      run: serverList,
    },
  ],
};

registerForgeBlock(block);
export default block;
