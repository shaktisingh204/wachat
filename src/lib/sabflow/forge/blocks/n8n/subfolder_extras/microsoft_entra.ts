/**
 * Forge block: Microsoft Entra ID (Azure AD)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Entra/MicrosoftEntra.node.ts
 *
 * Auth: OAuth2 refresh-token grant against login.microsoftonline.com.
 *   clientId/clientSecret/refreshToken inline.
 *
 * REST base: https://graph.microsoft.com/v1.0
 *
 * Operations:
 *   - user.list        GET /users
 *   - group.list       GET /groups
 *   - application.list GET /applications
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Microsoft Entra';
const BASE = 'https://graph.microsoft.com/v1.0';

function readCred(ctx: ForgeActionContext): Record<string, string> {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function graphGet(ctx: ForgeActionContext, path: string): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), MICROSOFT_TOKEN_URL);
  const params = new URLSearchParams();
  const filter = asString(ctx.options.filter);
  const select = asString(ctx.options.select);
  const top = asString(ctx.options.top);
  if (filter) params.set('$filter', filter);
  if (select) params.set('$select', select);
  if (top) params.set('$top', top);
  const qs = params.toString();
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `${BASE}${path}${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

const queryFields = [
  { id: 'filter', label: '$filter', type: 'text' as const, placeholder: "displayName eq 'Alice'" },
  { id: 'select', label: '$select (fields)', type: 'text' as const, placeholder: 'id,displayName,mail' },
  { id: 'top', label: '$top (page size)', type: 'number' as const },
];

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await graphGet(ctx, '/users');
  return { outputs: { result: data }, logs: ['Entra users list'] };
}

async function groupList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await graphGet(ctx, '/groups');
  return { outputs: { result: data }, logs: ['Entra groups list'] };
}

async function applicationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await graphGet(ctx, '/applications');
  return { outputs: { result: data }, logs: ['Entra applications list'] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_entra',
  name: 'Microsoft Entra ID',
  description: 'List users, groups, and applications from Microsoft Entra ID (Azure AD).',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'user_list',
      label: 'List users',
      description: 'List directory users.',
      fields: [...authFields, ...queryFields],
      run: userList,
    },
    {
      id: 'group_list',
      label: 'List groups',
      description: 'List directory groups.',
      fields: [...authFields, ...queryFields],
      run: groupList,
    },
    {
      id: 'application_list',
      label: 'List applications',
      description: 'List registered applications.',
      fields: [...authFields, ...queryFields],
      run: applicationList,
    },
  ],
};

registerForgeBlock(block);
export default block;
