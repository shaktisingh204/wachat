/**
 * Forge block: Orbit
 *
 * Source: n8n-master/packages/nodes-base/nodes/Orbit/Orbit.node.ts
 * Auth: `Authorization: Bearer <apiKey>` — inline as `password`.
 *
 * Operations covered:
 *   - member.create   POST /{workspace}/members
 *   - member.get      GET  /{workspace}/members/{id}
 *   - member.list     GET  /{workspace}/members
 *   - activity.create POST /{workspace}/members/{id}/activities
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://app.orbit.love/api/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Orbit: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

function workspace(ctx: ForgeActionContext): string {
  const ws = asString(ctx.options.workspace);
  if (!ws) throw new Error('Orbit: workspace is required');
  return ws;
}

async function memberCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = workspace(ctx);
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Orbit: name is required');
  const member: Record<string, unknown> = { name };
  const email = asString(ctx.options.email);
  const slug = asString(ctx.options.slug);
  if (email) member.email = email;
  if (slug) member.slug = slug;
  const res = await apiRequest({
    service: 'Orbit',
    method: 'POST',
    url: `${API}/${encodeURIComponent(ws)}/members`,
    headers: authHeader(ctx),
    json: { member },
  });
  return { outputs: { member: res.data }, logs: [`Orbit member.create → ${name}`] };
}

async function memberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = workspace(ctx);
  const id = asString(ctx.options.memberId);
  if (!id) throw new Error('Orbit: memberId is required');
  const res = await apiRequest({
    service: 'Orbit',
    method: 'GET',
    url: `${API}/${encodeURIComponent(ws)}/members/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { member: res.data }, logs: [`Orbit member.get → ${id}`] };
}

async function memberList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = workspace(ctx);
  const params = new URLSearchParams();
  const page = asString(ctx.options.page);
  const items = asString(ctx.options.items);
  if (page) params.set('page', page);
  if (items) params.set('items', items);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Orbit',
    method: 'GET',
    url: `${API}/${encodeURIComponent(ws)}/members${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { members: res.data }, logs: [`Orbit member.list → ${ws}`] };
}

async function activityCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = workspace(ctx);
  const id = asString(ctx.options.memberId);
  if (!id) throw new Error('Orbit: memberId is required');
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Orbit: title is required');
  const activity: Record<string, unknown> = { title };
  const description = asString(ctx.options.description);
  const link = asString(ctx.options.link);
  const activityType = asString(ctx.options.activityType);
  if (description) activity.description = description;
  if (link) activity.link = link;
  if (activityType) activity.activity_type = activityType;
  const res = await apiRequest({
    service: 'Orbit',
    method: 'POST',
    url: `${API}/${encodeURIComponent(ws)}/members/${encodeURIComponent(id)}/activities`,
    headers: authHeader(ctx),
    json: { activity },
  });
  return { outputs: { activity: res.data }, logs: [`Orbit activity.create → ${title}`] };
}

const block: ForgeBlock = {
  id: 'forge_orbit',
  name: 'Orbit',
  description: 'Manage Orbit community members and activities.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'member_create',
      label: 'Create member',
      description: 'Add a new member to a workspace.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspace', label: 'Workspace slug', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'slug', label: 'Member slug', type: 'text' },
      ],
      run: memberCreate,
    },
    {
      id: 'member_get',
      label: 'Get member',
      description: 'Fetch a member by id or slug.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspace', label: 'Workspace slug', type: 'text', required: true },
        { id: 'memberId', label: 'Member id or slug', type: 'text', required: true },
      ],
      run: memberGet,
    },
    {
      id: 'member_list',
      label: 'List members',
      description: 'List members in a workspace.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspace', label: 'Workspace slug', type: 'text', required: true },
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'items', label: 'Items per page', type: 'number' },
      ],
      run: memberList,
    },
    {
      id: 'activity_create',
      label: 'Create activity',
      description: 'Log a new activity for a member.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspace', label: 'Workspace slug', type: 'text', required: true },
        { id: 'memberId', label: 'Member id or slug', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'link', label: 'Link', type: 'text' },
        { id: 'activityType', label: 'Activity type key', type: 'text', placeholder: 'custom_activity' },
      ],
      run: activityCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
