/**
 * Forge block: Rocket.Chat
 *
 * Source: n8n-master/packages/nodes-base/nodes/Rocketchat/Rocketchat.node.ts (+ GenericFunctions.ts)
 * Credential type: 'rocketchat' — { baseUrl, userId, authToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - chat.postMessage   POST /api/v1/chat.postMessage
 *   - chat.delete        POST /api/v1/chat.delete
 *   - chat.update        POST /api/v1/chat.update
 *   - channels.info      GET  /api/v1/channels.info
 *   - im.create          POST /api/v1/im.create
 *
 * The original n8n node only exposes `chat:postMessage`; the additional REST
 * endpoints above are part of the same public API and are included to give
 * the SabFlow port a useful surface (the migration plan allows extending
 * single-operation n8n nodes to a 3-action minimum).
 *
 * Out of scope for the first port:
 *   - Attachments/actions builder UI — pass attachments JSON as a string
 *   - Channel admin endpoints, user management, file uploads
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type RocketCred = { baseUrl: string; userId: string; authToken: string };

function credsOrThrow(ctx: ForgeActionContext): RocketCred {
  const cred = requireCredential('Rocket.Chat', ctx.credential);
  const baseUrl = (cred.baseUrl ?? '').replace(/\/$/, '');
  const userId = cred.userId ?? '';
  const authToken = cred.authToken ?? '';
  if (!baseUrl) throw new Error('Rocket.Chat: credential missing `baseUrl`');
  if (!userId) throw new Error('Rocket.Chat: credential missing `userId`');
  if (!authToken) throw new Error('Rocket.Chat: credential missing `authToken`');
  return { baseUrl, userId, authToken };
}

async function rc(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
  qs?: Record<string, string>,
): Promise<unknown> {
  const { baseUrl, userId, authToken } = credsOrThrow(ctx);
  const search = qs ? `?${new URLSearchParams(qs).toString()}` : '';
  const res = await apiRequest({
    service: 'Rocket.Chat',
    method,
    url: `${baseUrl}/api/v1/${endpoint.replace(/^\//, '')}${search}`,
    headers: {
      'X-Auth-Token': authToken,
      'X-User-Id': userId,
    },
    json: body,
  });
  const data = res.data as { success?: boolean; error?: string };
  if (data && data.success === false) {
    throw new Error(`Rocket.Chat ${endpoint} failed: ${data.error ?? 'unknown error'}`);
  }
  return res.data;
}

function parseJson<T>(raw: unknown, field: string, fallback: T): T {
  const s = asString(raw).trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch (err) {
    throw new Error(`Rocket.Chat: ${field} is not valid JSON — ${(err as Error).message}`);
  }
}

async function chatPostMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const channel = asString(ctx.options.channel);
  const text = asString(ctx.options.text);
  if (!channel) throw new Error('Rocket.Chat: channel is required');

  const body: Record<string, unknown> = { channel };
  if (text) body.text = text;
  const alias = asString(ctx.options.alias);
  if (alias) body.alias = alias;
  const avatar = asString(ctx.options.avatar);
  if (avatar) body.avatar = avatar;
  const emoji = asString(ctx.options.emoji);
  if (emoji) body.emoji = emoji;
  const attachments = parseJson<unknown[]>(ctx.options.attachments, 'attachments', []);
  if (attachments.length) body.attachments = attachments;

  const result = await rc(ctx, 'POST', 'chat.postMessage', body);
  return { outputs: { result }, logs: [`Rocket.Chat postMessage → ${channel}`] };
}

async function chatDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  const msgId = asString(ctx.options.msgId);
  if (!roomId) throw new Error('Rocket.Chat: roomId is required');
  if (!msgId) throw new Error('Rocket.Chat: msgId is required');
  const result = await rc(ctx, 'POST', 'chat.delete', { roomId, msgId });
  return { outputs: { result }, logs: [`Rocket.Chat delete → ${msgId}`] };
}

async function chatUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  const msgId = asString(ctx.options.msgId);
  const text = asString(ctx.options.text);
  if (!roomId) throw new Error('Rocket.Chat: roomId is required');
  if (!msgId) throw new Error('Rocket.Chat: msgId is required');
  if (!text) throw new Error('Rocket.Chat: text is required');
  const result = await rc(ctx, 'POST', 'chat.update', { roomId, msgId, text });
  return { outputs: { result }, logs: [`Rocket.Chat update → ${msgId}`] };
}

async function channelsInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomName = asString(ctx.options.roomName);
  const roomId = asString(ctx.options.roomId);
  if (!roomName && !roomId) throw new Error('Rocket.Chat: provide roomName or roomId');
  const qs: Record<string, string> = {};
  if (roomName) qs.roomName = roomName;
  if (roomId) qs.roomId = roomId;
  const result = await rc(ctx, 'GET', 'channels.info', undefined, qs);
  return { outputs: { result }, logs: ['Rocket.Chat channels.info'] };
}

async function imCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = asString(ctx.options.username);
  if (!username) throw new Error('Rocket.Chat: username is required');
  const result = await rc(ctx, 'POST', 'im.create', { username });
  return { outputs: { result }, logs: [`Rocket.Chat im.create → ${username}`] };
}

const block: ForgeBlock = {
  id: 'forge_rocketchat',
  name: 'Rocket.Chat',
  description: 'Post and manage messages on a Rocket.Chat server.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'rocketchat' },
  actions: [
    {
      id: 'chat_post_message',
      label: 'Post message',
      description: 'Post a message into a channel or DM.',
      fields: [
        { id: 'channel', label: 'Channel', type: 'text', required: true, placeholder: '#general or @user' },
        { id: 'text', label: 'Text', type: 'textarea' },
        { id: 'alias', label: 'Alias', type: 'text' },
        { id: 'avatar', label: 'Avatar URL', type: 'text' },
        { id: 'emoji', label: 'Emoji', type: 'text' },
        { id: 'attachments', label: 'Attachments (JSON array)', type: 'json' },
      ],
      run: chatPostMessage,
    },
    {
      id: 'chat_delete',
      label: 'Delete message',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        { id: 'msgId', label: 'Message ID', type: 'text', required: true },
      ],
      run: chatDelete,
    },
    {
      id: 'chat_update',
      label: 'Update message',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        { id: 'msgId', label: 'Message ID', type: 'text', required: true },
        { id: 'text', label: 'New text', type: 'textarea', required: true },
      ],
      run: chatUpdate,
    },
    {
      id: 'channels_info',
      label: 'Get channel info',
      fields: [
        { id: 'roomName', label: 'Room name', type: 'text' },
        { id: 'roomId', label: 'Room ID', type: 'text' },
      ],
      run: channelsInfo,
    },
    {
      id: 'im_create',
      label: 'Open direct message',
      description: 'Create or open a direct message room with a user.',
      fields: [{ id: 'username', label: 'Username', type: 'text', required: true }],
      run: imCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
