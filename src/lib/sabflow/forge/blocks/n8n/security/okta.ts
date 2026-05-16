/**
 * Forge block: Okta
 *
 * Source: n8n-master/packages/nodes-base/nodes/Okta/Okta.node.ts
 *
 * Okta domains use `Authorization: SSWS <apiToken>` against `${domain}/api/v1`.
 *
 * Operations covered:
 *   - user.list    GET    /api/v1/users
 *   - user.get     GET    /api/v1/users/{id}
 *   - user.create  POST   /api/v1/users?activate=true
 *   - group.list   GET    /api/v1/groups
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.domain);
  if (!raw) throw new Error('Okta: domain is required');
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiToken);
  if (!token) throw new Error('Okta: apiToken is required');
  return { Authorization: `SSWS ${token}`, Accept: 'application/json' };
}

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit);
  const filter = asString(ctx.options.filter);
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (filter) params.set('filter', filter);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Okta',
    method: 'GET',
    url: `${base(ctx)}/api/v1/users${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { users: res.data }, logs: ['Okta user.list'] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Okta: userId is required');
  const res = await apiRequest({
    service: 'Okta',
    method: 'GET',
    url: `${base(ctx)}/api/v1/users/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { user: res.data }, logs: [`Okta user.get → ${id}`] };
}

async function userCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const email = asString(ctx.options.email);
  const login = asString(ctx.options.login) || email;
  if (!firstName || !lastName || !email) {
    throw new Error('Okta: firstName, lastName and email are required');
  }
  const body: Record<string, unknown> = {
    profile: { firstName, lastName, email, login },
  };
  const password = asString(ctx.options.password);
  if (password) {
    body.credentials = { password: { value: password } };
  }
  const res = await apiRequest({
    service: 'Okta',
    method: 'POST',
    url: `${base(ctx)}/api/v1/users?activate=true`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { user: res.data }, logs: [`Okta user.create → ${email}`] };
}

async function groupList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit);
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Okta',
    method: 'GET',
    url: `${base(ctx)}/api/v1/groups${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { groups: res.data }, logs: ['Okta group.list'] };
}

const credFields = [
  { id: 'domain', label: 'Okta domain', type: 'text' as const, required: true, placeholder: 'https://example.okta.com' },
  { id: 'apiToken', label: 'API token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_okta',
  name: 'Okta',
  description: 'Manage Okta users and groups via the Users API.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'user_list',
      label: 'List users',
      description: 'List users on the Okta org.',
      fields: [
        ...credFields,
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'filter', label: 'Filter (SCIM)', type: 'text', placeholder: 'status eq "ACTIVE"' },
      ],
      run: userList,
    },
    {
      id: 'user_get',
      label: 'Get user',
      description: 'Fetch a single user by id or login.',
      fields: [
        ...credFields,
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: userGet,
    },
    {
      id: 'user_create',
      label: 'Create user',
      description: 'Create + activate a new Okta user.',
      fields: [
        ...credFields,
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'login', label: 'Login (defaults to email)', type: 'text' },
        { id: 'password', label: 'Initial password', type: 'password' },
      ],
      run: userCreate,
    },
    {
      id: 'group_list',
      label: 'List groups',
      description: 'List groups on the Okta org.',
      fields: [
        ...credFields,
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: groupList,
    },
  ],
};

registerForgeBlock(block);
export default block;
