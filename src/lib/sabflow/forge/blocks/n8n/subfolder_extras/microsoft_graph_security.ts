/**
 * Forge block: Microsoft Graph Security
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/GraphSecurity/MicrosoftGraphSecurity.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline.
 *
 * REST base: https://graph.microsoft.com/v1.0/security
 *
 * Operations:
 *   - alert.list   GET   /alerts
 *   - alert.get    GET   /alerts/{id}
 *   - alert.update PATCH /alerts/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Microsoft Graph Security';
const BASE = 'https://graph.microsoft.com/v1.0/security';

function readCred(ctx: ForgeActionContext): Record<string, string> {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'PATCH',
  path: string,
  qs?: Record<string, string>,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), MICROSOFT_TOKEN_URL);
  const params = qs ? new URLSearchParams(qs).toString() : '';
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}${params ? `?${params}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

async function alertList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const filter = asString(ctx.options.filter);
  const top = asString(ctx.options.top);
  const qs: Record<string, string> = {};
  if (filter) qs.$filter = filter;
  if (top) qs.$top = top;
  const data = await call(ctx, 'GET', '/alerts', qs);
  return { outputs: { result: data }, logs: ['Graph Security alerts list'] };
}

async function alertGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.alertId);
  if (!id) throw new Error(`${SERVICE}: alertId is required`);
  const data = await call(ctx, 'GET', `/alerts/${encodeURIComponent(id)}`);
  return { outputs: { result: data }, logs: [`Graph Security alert get → ${id}`] };
}

async function alertUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.alertId);
  if (!id) throw new Error(`${SERVICE}: alertId is required`);
  const patchRaw = asString(ctx.options.patch).trim();
  if (!patchRaw) throw new Error(`${SERVICE}: patch (JSON object) is required`);
  let patch: unknown;
  try {
    patch = JSON.parse(patchRaw);
  } catch {
    throw new Error(`${SERVICE}: patch must be valid JSON`);
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error(`${SERVICE}: patch must be a JSON object`);
  }
  const data = await call(ctx, 'PATCH', `/alerts/${encodeURIComponent(id)}`, undefined, patch);
  return { outputs: { result: data }, logs: [`Graph Security alert update → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_graph_security',
  name: 'Microsoft Graph Security',
  description: 'List, fetch, and update Microsoft Graph security alerts.',
  iconName: 'LuShieldCheck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'alert_list',
      label: 'List alerts',
      description: 'List security alerts (supports $filter / $top).',
      fields: [
        ...authFields,
        { id: 'filter', label: '$filter', type: 'text', placeholder: "severity eq 'high'" },
        { id: 'top', label: '$top (page size)', type: 'number' },
      ],
      run: alertList,
    },
    {
      id: 'alert_get',
      label: 'Get alert',
      description: 'Fetch an alert by id.',
      fields: [
        ...authFields,
        { id: 'alertId', label: 'Alert ID', type: 'text', required: true },
      ],
      run: alertGet,
    },
    {
      id: 'alert_update',
      label: 'Update alert',
      description: 'Patch an alert (e.g. set status / assignedTo).',
      fields: [
        ...authFields,
        { id: 'alertId', label: 'Alert ID', type: 'text', required: true },
        { id: 'patch', label: 'Patch body (JSON object)', type: 'json', required: true },
      ],
      run: alertUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
