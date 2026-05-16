/**
 * Forge block: Intercom (Workspace ops)
 *
 * API: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/
 * Auth: `Authorization: Bearer <access_token>` + `Intercom-Version` header.
 *
 * Operations covered:
 *   - admin.list                GET   /admins
 *   - me                        GET   /me
 *   - team.list                 GET   /teams
 *   - tag.create                POST  /tags
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.intercom.io';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Intercom: accessToken is required');
  const version = asString(ctx.options.apiVersion) || '2.11';
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Intercom-Version': version,
  };
}

async function adminList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Intercom',
    method: 'GET',
    url: `${API}/admins`,
    headers: authHeaders(ctx),
  });
  return { outputs: { admins: res.data }, logs: ['Intercom admin list'] };
}

async function me(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Intercom',
    method: 'GET',
    url: `${API}/me`,
    headers: authHeaders(ctx),
  });
  return { outputs: { me: res.data }, logs: ['Intercom me'] };
}

async function teamList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Intercom',
    method: 'GET',
    url: `${API}/teams`,
    headers: authHeaders(ctx),
  });
  return { outputs: { teams: res.data }, logs: ['Intercom team list'] };
}

async function tagCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Intercom: name is required');
  const res = await apiRequest({
    service: 'Intercom',
    method: 'POST',
    url: `${API}/tags`,
    headers: authHeaders(ctx),
    json: { name },
  });
  return { outputs: { tag: res.data }, logs: [`Intercom tag create → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_intercom_workspace',
  name: 'Intercom (Workspace)',
  description: 'Intercom workspace ops — admins, teams, tags.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'admin_list',
      label: 'List admins',
      description: 'List all admins in the workspace.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'apiVersion', label: 'API version', type: 'text', defaultValue: '2.11' },
      ],
      run: adminList,
    },
    {
      id: 'me',
      label: 'Get current admin',
      description: 'Identity for the authenticated token.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'apiVersion', label: 'API version', type: 'text', defaultValue: '2.11' },
      ],
      run: me,
    },
    {
      id: 'team_list',
      label: 'List teams',
      description: 'List all teams.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'apiVersion', label: 'API version', type: 'text', defaultValue: '2.11' },
      ],
      run: teamList,
    },
    {
      id: 'tag_create',
      label: 'Create tag',
      description: 'Create a workspace tag.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'apiVersion', label: 'API version', type: 'text', defaultValue: '2.11' },
        { id: 'name', label: 'Tag name', type: 'text', required: true },
      ],
      run: tagCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
