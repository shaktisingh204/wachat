/**
 * Forge block: Pushbullet
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pushbullet/Pushbullet.node.ts
 *
 * Uses Access-Token header (personal access token) — OAuth2 in n8n is reduced
 * to the long-lived token surface here.
 *
 * Operations covered:
 *   - push.create   POST   /pushes
 *   - push.list     GET    /pushes
 *   - push.delete   DELETE /pushes/{id}
 *   - device.list   GET    /devices
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.pushbullet.com/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const t = asString(ctx.options.accessToken);
  if (!t) throw new Error('Pushbullet: accessToken is required');
  return { 'Access-Token': t };
}

async function pushCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const type = asString(ctx.options.type) || 'note';
  const body: Record<string, unknown> = { type };
  const bodyText = asString(ctx.options.body);
  if (bodyText) body.body = bodyText;
  const title = asString(ctx.options.title);
  if (title) body.title = title;
  if (type === 'link') {
    const url = asString(ctx.options.url);
    if (!url) throw new Error('Pushbullet: url is required for link push');
    body.url = url;
  }
  const target = asString(ctx.options.target) || 'default';
  if (target !== 'default') {
    const value = asString(ctx.options.targetValue);
    if (!value) throw new Error('Pushbullet: targetValue is required when target is not default');
    body[target] = value;
  }
  const res = await apiRequest({
    service: 'Pushbullet',
    method: 'POST',
    url: `${API}/pushes`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { push: res.data }, logs: [`Pushbullet push ${type}`] };
}

async function pushList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const limit = asNumber(ctx.options.limit);
  if (limit !== undefined) params.set('limit', String(limit));
  const modifiedAfter = asString(ctx.options.modifiedAfter);
  if (modifiedAfter) params.set('modified_after', modifiedAfter);
  const active = asString(ctx.options.active);
  if (active) params.set('active', active);
  const url = `${API}/pushes${params.toString() ? `?${params}` : ''}`;
  const res = await apiRequest({
    service: 'Pushbullet',
    method: 'GET',
    url,
    headers: authHeader(ctx),
  });
  return { outputs: { pushes: res.data }, logs: ['Pushbullet push list'] };
}

async function pushDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pushId);
  if (!id) throw new Error('Pushbullet: pushId is required');
  const res = await apiRequest({
    service: 'Pushbullet',
    method: 'DELETE',
    url: `${API}/pushes/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { ok: true, status: res.status }, logs: [`Pushbullet delete → ${id}`] };
}

async function deviceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Pushbullet',
    method: 'GET',
    url: `${API}/devices`,
    headers: authHeader(ctx),
  });
  return { outputs: { devices: res.data }, logs: ['Pushbullet device list'] };
}

const block: ForgeBlock = {
  id: 'forge_pushbullet',
  name: 'Pushbullet',
  description: 'Send notes/links, list pushes and devices via Pushbullet.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'push_create',
      label: 'Create push',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'type', label: 'Type', type: 'select', options: [
          { label: 'Note', value: 'note' },
          { label: 'Link', value: 'link' },
        ], defaultValue: 'note' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'body', label: 'Body', type: 'textarea' },
        { id: 'url', label: 'URL (link only)', type: 'text' },
        { id: 'target', label: 'Target', type: 'select', options: [
          { label: 'Default (all devices)', value: 'default' },
          { label: 'Device ID', value: 'device_iden' },
          { label: 'Email', value: 'email' },
          { label: 'Channel tag', value: 'channel_tag' },
        ], defaultValue: 'default' },
        { id: 'targetValue', label: 'Target value', type: 'text' },
      ],
      run: pushCreate,
    },
    {
      id: 'push_list',
      label: 'List pushes',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'modifiedAfter', label: 'Modified after (unix)', type: 'text' },
        { id: 'active', label: 'Active only (true/false)', type: 'text' },
      ],
      run: pushList,
    },
    {
      id: 'push_delete',
      label: 'Delete push',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'pushId', label: 'Push ID', type: 'text', required: true },
      ],
      run: pushDelete,
    },
    {
      id: 'device_list',
      label: 'List devices',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: deviceList,
    },
  ],
};

registerForgeBlock(block);
export default block;
