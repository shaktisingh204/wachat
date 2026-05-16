/**
 * Forge block: Ghost (Members API)
 *
 * API: https://ghost.org/docs/admin-api/#members
 * Auth: Ghost Admin API uses signed JWT, but the simpler `Authorization: Ghost <key>`
 * header (with `key` being the admin-api key id:secret form) is accepted by self-hosted
 * Ghost instances. We surface that as an inline password field — users paste the full
 * admin API key.
 *
 * Operations covered:
 *   - member.create             POST   /ghost/api/admin/members
 *   - member.list               GET    /ghost/api/admin/members
 *   - member.get                GET    /ghost/api/admin/members/{id}
 *   - member.update             PUT    /ghost/api/admin/members/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.siteUrl);
  if (!url) throw new Error('Ghost: siteUrl is required');
  return url.replace(/\/$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.adminKey);
  if (!key) throw new Error('Ghost: adminKey is required');
  return { Authorization: `Ghost ${key}` };
}

async function memberCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Ghost: email is required');
  const member: Record<string, unknown> = { email };
  const name = asString(ctx.options.name);
  const note = asString(ctx.options.note);
  if (name) member.name = name;
  if (note) member.note = note;
  const res = await apiRequest({
    service: 'Ghost',
    method: 'POST',
    url: `${base}/ghost/api/admin/members/`,
    headers: authHeader(ctx),
    json: { members: [member] },
  });
  return { outputs: { member: res.data }, logs: [`Ghost member create → ${email}`] };
}

async function memberList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const page = asString(ctx.options.page);
  const filter = asString(ctx.options.filter);
  if (limit) params.set('limit', limit);
  if (page) params.set('page', page);
  if (filter) params.set('filter', filter);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Ghost',
    method: 'GET',
    url: `${base}/ghost/api/admin/members/${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { members: res.data }, logs: ['Ghost member list'] };
}

async function memberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const id = asString(ctx.options.memberId);
  if (!id) throw new Error('Ghost: memberId is required');
  const res = await apiRequest({
    service: 'Ghost',
    method: 'GET',
    url: `${base}/ghost/api/admin/members/${encodeURIComponent(id)}/`,
    headers: authHeader(ctx),
  });
  return { outputs: { member: res.data }, logs: [`Ghost member get → ${id}`] };
}

async function memberUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const id = asString(ctx.options.memberId);
  if (!id) throw new Error('Ghost: memberId is required');
  const member: Record<string, unknown> = {};
  const email = asString(ctx.options.email);
  const name = asString(ctx.options.name);
  const note = asString(ctx.options.note);
  if (email) member.email = email;
  if (name) member.name = name;
  if (note) member.note = note;
  const res = await apiRequest({
    service: 'Ghost',
    method: 'PUT',
    url: `${base}/ghost/api/admin/members/${encodeURIComponent(id)}/`,
    headers: authHeader(ctx),
    json: { members: [member] },
  });
  return { outputs: { member: res.data }, logs: [`Ghost member update → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_ghost_members',
  name: 'Ghost (Members)',
  description: 'Ghost Admin API — members CRUD.',
  iconName: 'LuGhost',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'member_create',
      label: 'Create member',
      description: 'Add a member to the Ghost site.',
      fields: [
        { id: 'siteUrl', label: 'Site URL', type: 'text', required: true, placeholder: 'https://example.ghost.io' },
        { id: 'adminKey', label: 'Admin key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'note', label: 'Note', type: 'textarea' },
      ],
      run: memberCreate,
    },
    {
      id: 'member_list',
      label: 'List members',
      description: 'List Ghost members.',
      fields: [
        { id: 'siteUrl', label: 'Site URL', type: 'text', required: true },
        { id: 'adminKey', label: 'Admin key', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'filter', label: 'Filter (NQL)', type: 'text' },
      ],
      run: memberList,
    },
    {
      id: 'member_get',
      label: 'Get member',
      description: 'Fetch a single member.',
      fields: [
        { id: 'siteUrl', label: 'Site URL', type: 'text', required: true },
        { id: 'adminKey', label: 'Admin key', type: 'password', required: true },
        { id: 'memberId', label: 'Member ID', type: 'text', required: true },
      ],
      run: memberGet,
    },
    {
      id: 'member_update',
      label: 'Update member',
      description: 'Patch a member by id.',
      fields: [
        { id: 'siteUrl', label: 'Site URL', type: 'text', required: true },
        { id: 'adminKey', label: 'Admin key', type: 'password', required: true },
        { id: 'memberId', label: 'Member ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'note', label: 'Note', type: 'textarea' },
      ],
      run: memberUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
