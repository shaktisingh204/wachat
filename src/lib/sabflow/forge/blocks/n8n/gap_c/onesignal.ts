/**
 * Forge block: OneSignal
 *
 * `https://api.onesignal.com` — push notifications and audience management.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.onesignal.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('OneSignal: apiKey is required');
  return { Authorization: `Key ${apiKey}`, Accept: 'application/json' };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`OneSignal: ${label} must be valid JSON`);
  }
}

async function sendNotification(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const appId = asString(ctx.options.appId);
  const heading = asString(ctx.options.heading);
  const content = asString(ctx.options.content);
  const segments = asString(ctx.options.segments);
  const playerIds = parseJson(ctx.options.playerIdsJson, 'playerIdsJson');
  if (!appId) throw new Error('OneSignal: appId is required');
  if (!content) throw new Error('OneSignal: content is required');
  const body: Record<string, unknown> = {
    app_id: appId,
    contents: { en: content },
  };
  if (heading) body.headings = { en: heading };
  if (segments) body.included_segments = segments.split(',').map((s) => s.trim());
  if (Array.isArray(playerIds)) body.include_player_ids = playerIds;
  const res = await apiRequest({
    service: 'OneSignal',
    method: 'POST',
    url: `${API}/notifications`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { notification: res.data }, logs: ['OneSignal send notification'] };
}

async function listNotifications(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const appId = asString(ctx.options.appId);
  const limit = asString(ctx.options.limit) || '20';
  if (!appId) throw new Error('OneSignal: appId is required');
  const res = await apiRequest({
    service: 'OneSignal',
    method: 'GET',
    url: `${API}/notifications?app_id=${encodeURIComponent(appId)}&limit=${limit}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { notifications: res.data }, logs: ['OneSignal list notifications'] };
}

const block: ForgeBlock = {
  id: 'forge_onesignal',
  name: 'OneSignal',
  description: 'Send push notifications and list delivery history via OneSignal.',
  iconName: 'LuBell',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_notification',
      label: 'Send notification',
      fields: [
        { id: 'apiKey', label: 'REST API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'heading', label: 'Heading', type: 'text' },
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'segments', label: 'Included segments (comma)', type: 'text' },
        { id: 'playerIdsJson', label: 'Player IDs (JSON array)', type: 'json' },
      ],
      run: sendNotification,
    },
    {
      id: 'list_notifications',
      label: 'List notifications',
      fields: [
        { id: 'apiKey', label: 'REST API key', type: 'password', required: true },
        { id: 'appId', label: 'App ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 20 },
      ],
      run: listNotifications,
    },
  ],
};

registerForgeBlock(block);
export default block;
