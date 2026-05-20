/**
 * Forge block: LINE (Messaging API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Line/Line.node.ts (+ GenericFunctions.ts)
 *   The n8n node targets the now-discontinued LINE Notify API; this port targets
 *   the still-supported LINE Messaging API since the SabFlow credential schema
 *   exposes a `channelAccessToken` (the Messaging API auth shape).
 * Credential type: 'line' — { channelAccessToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - push       POST /v2/bot/message/push
 *   - reply      POST /v2/bot/message/reply
 *   - multicast  POST /v2/bot/message/multicast
 *   - broadcast  POST /v2/bot/message/broadcast
 *
 * Out of scope (n8n's `Line.node.ts` only ships the now-discontinued LINE
 * Notify `send` operation, so there is no upstream parity work to do):
 *   - Rich/Flex message builder UI — only text and a single sticker per request
 *   - Webhook trigger node (handled by SabFlow triggers, separate wave)
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';

const LINE_BASE = 'https://api.line.me/v2/bot';

function tokenOrThrow(ctx: ForgeActionContext): string {
  const cred = requireCredential('LINE', ctx.credential);
  const token = cred.channelAccessToken ?? cred.accessToken;
  if (!token) throw new Error('LINE: credential missing `channelAccessToken`');
  return token;
}

async function line(ctx: ForgeActionContext, endpoint: string, body: unknown): Promise<unknown> {
  const token = tokenOrThrow(ctx);
  const res = await apiRequest({
    service: 'LINE',
    method: 'POST',
    url: `${LINE_BASE}/${endpoint.replace(/^\//, '')}`,
    headers: { Authorization: `Bearer ${token}` },
    json: body,
  });
  return res.data;
}

function buildMessages(ctx: ForgeActionContext): Array<Record<string, unknown>> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('LINE: text is required');
  const messages: Array<Record<string, unknown>> = [{ type: 'text', text }];

  const stickerId = asNumber(ctx.options.stickerId);
  const packageId = asNumber(ctx.options.packageId);
  if (stickerId !== undefined && packageId !== undefined) {
    messages.push({
      type: 'sticker',
      packageId: String(packageId),
      stickerId: String(stickerId),
    });
  }
  return messages;
}

async function push(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  if (!to) throw new Error('LINE: `to` (user/group/room id) is required');
  const result = await line(ctx, 'message/push', { to, messages: buildMessages(ctx) });
  return { outputs: { result }, logs: [`LINE push → ${to}`] };
}

async function reply(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const replyToken = asString(ctx.options.replyToken);
  if (!replyToken) throw new Error('LINE: replyToken is required');
  const result = await line(ctx, 'message/reply', {
    replyToken,
    messages: buildMessages(ctx),
  });
  return { outputs: { result }, logs: ['LINE reply'] };
}

async function multicast(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const raw = asString(ctx.options.to);
  if (!raw) throw new Error('LINE: `to` is required (comma-separated user IDs)');
  const to = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) throw new Error('LINE: provide at least one user ID');
  const result = await line(ctx, 'message/multicast', { to, messages: buildMessages(ctx) });
  return { outputs: { result }, logs: [`LINE multicast → ${to.length} recipients`] };
}

async function broadcast(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const result = await line(ctx, 'message/broadcast', { messages: buildMessages(ctx) });
  return { outputs: { result }, logs: ['LINE broadcast'] };
}

const block: ForgeBlock = {
  id: 'forge_line',
  name: 'LINE',
  description: 'Send LINE Messaging API push, reply, multicast and broadcast messages.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'line' },
  actions: [
    {
      id: 'message_push',
      label: 'Push message',
      description: 'Send a message to a user, group or room.',
      fields: [
        { id: 'to', label: 'Recipient (user/group/room ID)', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'stickerId', label: 'Sticker ID (optional)', type: 'number' },
        { id: 'packageId', label: 'Sticker package ID (optional)', type: 'number' },
      ],
      run: push,
    },
    {
      id: 'message_reply',
      label: 'Reply message',
      description: 'Reply to a LINE webhook event using its replyToken.',
      fields: [
        { id: 'replyToken', label: 'Reply token', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'stickerId', label: 'Sticker ID', type: 'number' },
        { id: 'packageId', label: 'Sticker package ID', type: 'number' },
      ],
      run: reply,
    },
    {
      id: 'message_multicast',
      label: 'Multicast message',
      description: 'Send the same message to multiple users.',
      fields: [
        { id: 'to', label: 'User IDs (comma-separated)', type: 'textarea', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'stickerId', label: 'Sticker ID', type: 'number' },
        { id: 'packageId', label: 'Sticker package ID', type: 'number' },
      ],
      run: multicast,
    },
    {
      id: 'message_broadcast',
      label: 'Broadcast message',
      description: 'Send a message to every follower of the channel.',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'stickerId', label: 'Sticker ID', type: 'number' },
        { id: 'packageId', label: 'Sticker package ID', type: 'number' },
      ],
      run: broadcast,
    },
  ],
};

registerForgeBlock(block);
export default block;
