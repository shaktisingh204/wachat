/**
 * Forge block: Google Workspace (G Suite) Admin Directory
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/GSuiteAdmin/GSuiteAdmin.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action (Admin SDK Directory scope required).
 *
 * REST base: https://admin.googleapis.com/admin/directory/v1
 *
 * Operations covered:
 *   - user.list    GET    /users
 *   - user.get     GET    /users/{userKey}
 *   - user.create  POST   /users
 *   - group.list   GET    /groups
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://admin.googleapis.com/admin/directory/v1';
const SERVICE = 'GSuite Admin';

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
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  qs?: Record<string, string>,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), GOOGLE_TOKEN_URL);
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

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customer = asString(ctx.options.customer) || 'my_customer';
  const domain = asString(ctx.options.domain);
  const maxResults = asString(ctx.options.maxResults);
  const qs: Record<string, string> = { customer };
  if (domain) qs.domain = domain;
  if (maxResults) qs.maxResults = maxResults;
  const data = await call(ctx, 'GET', '/users', qs);
  return { outputs: { result: data }, logs: ['GSuite users list'] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userKey = asString(ctx.options.userKey);
  if (!userKey) throw new Error(`${SERVICE}: userKey is required`);
  const data = await call(ctx, 'GET', `/users/${encodeURIComponent(userKey)}`);
  return { outputs: { result: data }, logs: [`GSuite user get → ${userKey}`] };
}

async function userCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const primaryEmail = asString(ctx.options.primaryEmail);
  const givenName = asString(ctx.options.givenName);
  const familyName = asString(ctx.options.familyName);
  const password = asString(ctx.options.password);
  if (!primaryEmail) throw new Error(`${SERVICE}: primaryEmail is required`);
  if (!givenName) throw new Error(`${SERVICE}: givenName is required`);
  if (!familyName) throw new Error(`${SERVICE}: familyName is required`);
  if (!password) throw new Error(`${SERVICE}: password is required`);
  const body = {
    primaryEmail,
    name: { givenName, familyName },
    password,
  };
  const data = await call(ctx, 'POST', '/users', undefined, body);
  return { outputs: { result: data }, logs: [`GSuite user create → ${primaryEmail}`] };
}

async function groupList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customer = asString(ctx.options.customer) || 'my_customer';
  const domain = asString(ctx.options.domain);
  const maxResults = asString(ctx.options.maxResults);
  const qs: Record<string, string> = { customer };
  if (domain) qs.domain = domain;
  if (maxResults) qs.maxResults = maxResults;
  const data = await call(ctx, 'GET', '/groups', qs);
  return { outputs: { result: data }, logs: ['GSuite groups list'] };
}

const block: ForgeBlock = {
  id: 'forge_gsuite_admin',
  name: 'Google Workspace Admin',
  description: 'Manage Google Workspace users and groups via the Admin SDK Directory API.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'user_list',
      label: 'List users',
      description: 'List users in the Workspace customer/domain.',
      fields: [
        ...authFields,
        { id: 'customer', label: 'Customer ID', type: 'text', placeholder: 'my_customer' },
        { id: 'domain', label: 'Domain', type: 'text' },
        { id: 'maxResults', label: 'Max results', type: 'number' },
      ],
      run: userList,
    },
    {
      id: 'user_get',
      label: 'Get user',
      description: 'Fetch a user by primary email or id.',
      fields: [
        ...authFields,
        { id: 'userKey', label: 'User key (email or id)', type: 'text', required: true },
      ],
      run: userGet,
    },
    {
      id: 'user_create',
      label: 'Create user',
      description: 'Create a new Workspace user.',
      fields: [
        ...authFields,
        { id: 'primaryEmail', label: 'Primary email', type: 'text', required: true },
        { id: 'givenName', label: 'Given (first) name', type: 'text', required: true },
        { id: 'familyName', label: 'Family (last) name', type: 'text', required: true },
        { id: 'password', label: 'Initial password', type: 'password', required: true },
      ],
      run: userCreate,
    },
    {
      id: 'group_list',
      label: 'List groups',
      description: 'List Workspace groups.',
      fields: [
        ...authFields,
        { id: 'customer', label: 'Customer ID', type: 'text', placeholder: 'my_customer' },
        { id: 'domain', label: 'Domain', type: 'text' },
        { id: 'maxResults', label: 'Max results', type: 'number' },
      ],
      run: groupList,
    },
  ],
};

registerForgeBlock(block);
export default block;
