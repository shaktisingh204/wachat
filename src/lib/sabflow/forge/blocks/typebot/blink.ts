/**
 * Forge block: Blink (workplace platform — HR + comms)
 *
 * Source: typebot.io-main/packages/forge/blocks/blink/
 *
 * Actions (mirrors typebot's three Blink actions):
 *   - get_users         GET  <accountUrl>/api/v3/users?filter=<filter>
 *   - send_feed_event   POST <accountUrl>/api/v3/feed/events
 *   - redirect          (no HTTP — typebot uses this to redirect the bot user)
 *
 * Auth is `none` at the forge layer (no SabFlow Connections credential type
 * has been minted yet); apiKey + accountUrl are taken inline per action.
 * Move this to a proper Connections credential later if Blink gets popular.
 */

import { registerForgeBlock } from '../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../types';
import { apiRequest, asString } from '../n8n/_shared/http';

function bearerHeaders(ctx: ForgeActionContext): { headers: Record<string, string>; accountUrl: string } {
  const apiKey = asString(ctx.options.apiKey);
  const accountUrl = asString(ctx.options.accountUrl).replace(/\/+$/, '');
  if (!apiKey) throw new Error('Blink: apiKey is required');
  if (!accountUrl) throw new Error('Blink: accountUrl is required');
  return {
    headers: { Authorization: `Bearer ${apiKey}` },
    accountUrl,
  };
}

async function getUsers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { headers, accountUrl } = bearerHeaders(ctx);
  const filter = asString(ctx.options.filter);
  const url = filter
    ? `${accountUrl}/api/v3/users?filter=${encodeURIComponent(filter)}`
    : `${accountUrl}/api/v3/users`;

  const res = await apiRequest({
    service: 'Blink',
    method: 'GET',
    url,
    headers,
  });

  return { outputs: { users: res.data }, logs: [`Blink get_users → ${filter || '*'}`] };
}

async function sendFeedEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { headers, accountUrl } = bearerHeaders(ctx);
  const eventName = asString(ctx.options.eventName);
  const userId = asString(ctx.options.userId);
  if (!eventName) throw new Error('Blink: eventName is required');
  if (!userId) throw new Error('Blink: userId is required');

  let payload: unknown = ctx.options.payload;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed) {
      try {
        payload = JSON.parse(trimmed);
      } catch {
        throw new Error('Blink: payload must be valid JSON');
      }
    } else {
      payload = undefined;
    }
  }

  const res = await apiRequest({
    service: 'Blink',
    method: 'POST',
    url: `${accountUrl}/api/v3/feed/events`,
    headers,
    json: {
      event_name: eventName,
      user_id: userId,
      payload,
    },
  });

  return { outputs: { event: res.data }, logs: [`Blink send_feed_event → ${eventName}`] };
}

async function redirect(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('Blink: url is required');
  return { outputs: { redirectUrl: url }, logs: [`Blink redirect → ${url}`] };
}

const block: ForgeBlock = {
  id: 'forge_typebot_blink',
  name: 'Blink (typebot)',
  description:
    'Blink workplace platform — look up users, send feed events, or redirect the bot user into the Blink app.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'get_users',
      label: 'Get users',
      description: 'Search Blink users by filter (User ID, Employee ID, etc.).',
      fields: [
        { id: 'apiKey', label: 'App token', type: 'password', required: true },
        { id: 'accountUrl', label: 'Account URL', type: 'text', required: true, placeholder: 'https://api.joinblink.com' },
        { id: 'filter', label: 'Filter', type: 'text', placeholder: 'employeeId=EMP-123' },
      ],
      run: getUsers,
    },
    {
      id: 'send_feed_event',
      label: 'Send feed event',
      description: 'Post a feed event to a Blink user.',
      fields: [
        { id: 'apiKey', label: 'App token', type: 'password', required: true },
        { id: 'accountUrl', label: 'Account URL', type: 'text', required: true, placeholder: 'https://api.joinblink.com' },
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'payload', label: 'Payload', type: 'json', placeholder: '{ "title": "Welcome" }' },
      ],
      run: sendFeedEvent,
    },
    {
      id: 'redirect',
      label: 'Redirect',
      description: 'Redirect the bot user to a Blink deep link.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://app.joinblink.com/#/hub/xxxx' },
      ],
      run: redirect,
    },
  ],
};

registerForgeBlock(block);
export default block;
