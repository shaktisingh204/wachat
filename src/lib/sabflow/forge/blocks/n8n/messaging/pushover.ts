/**
 * Forge block: Pushover
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pushover/Pushover.node.ts
 *
 * Auth is via app token + user key in the POST body (no header).
 *
 * Operations covered:
 *   - message.send   POST  /messages.json
 *   - sound.list     GET   /sounds.json
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://api.pushover.net/1';

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = asString(ctx.options.appToken);
  const user = asString(ctx.options.userKey);
  const message = asString(ctx.options.message);
  if (!token) throw new Error('Pushover: appToken is required');
  if (!user) throw new Error('Pushover: userKey is required');
  if (!message) throw new Error('Pushover: message is required');

  const body: Record<string, unknown> = { token, user, message };
  const priority = asNumber(ctx.options.priority);
  if (priority !== undefined) body.priority = priority;
  const title = asString(ctx.options.title);
  if (title) body.title = title;
  const url = asString(ctx.options.url);
  if (url) body.url = url;
  const urlTitle = asString(ctx.options.urlTitle);
  if (urlTitle) body.url_title = urlTitle;
  const sound = asString(ctx.options.sound);
  if (sound) body.sound = sound;
  const device = asString(ctx.options.device);
  if (device) body.device = device;
  const html = asString(ctx.options.html);
  if (html === '1' || html === 'true') body.html = 1;
  const ttl = asNumber(ctx.options.ttl);
  if (ttl !== undefined) body.ttl = ttl;
  if (priority === 2) {
    const retry = asNumber(ctx.options.retry);
    const expire = asNumber(ctx.options.expire);
    if (retry === undefined) throw new Error('Pushover: retry is required for emergency priority');
    if (expire === undefined) throw new Error('Pushover: expire is required for emergency priority');
    body.retry = retry;
    body.expire = expire;
  }

  const res = await apiRequest({
    service: 'Pushover',
    method: 'POST',
    url: `${API}/messages.json`,
    json: body,
  });
  return { outputs: { result: res.data }, logs: ['Pushover message sent'] };
}

async function soundList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = asString(ctx.options.appToken);
  if (!token) throw new Error('Pushover: appToken is required');
  const res = await apiRequest({
    service: 'Pushover',
    method: 'GET',
    url: `${API}/sounds.json?token=${encodeURIComponent(token)}`,
  });
  return { outputs: { sounds: res.data }, logs: ['Pushover sound list'] };
}

const block: ForgeBlock = {
  id: 'forge_pushover',
  name: 'Pushover',
  description: 'Send messages via Pushover push-notification service.',
  iconName: 'LuBellPlus',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      fields: [
        { id: 'appToken', label: 'App token', type: 'password', required: true },
        { id: 'userKey', label: 'User / group key', type: 'password', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'priority', label: 'Priority (-2..2)', type: 'number' },
        { id: 'sound', label: 'Sound', type: 'text' },
        { id: 'device', label: 'Device', type: 'text' },
        { id: 'url', label: 'URL', type: 'text' },
        { id: 'urlTitle', label: 'URL title', type: 'text' },
        { id: 'html', label: 'HTML (1/true)', type: 'text' },
        { id: 'ttl', label: 'TTL (seconds)', type: 'number' },
        { id: 'retry', label: 'Retry (emergency)', type: 'number' },
        { id: 'expire', label: 'Expire (emergency)', type: 'number' },
      ],
      run: messageSend,
    },
    {
      id: 'sound_list',
      label: 'List sounds',
      fields: [
        { id: 'appToken', label: 'App token', type: 'password', required: true },
      ],
      run: soundList,
    },
  ],
};

registerForgeBlock(block);
export default block;
