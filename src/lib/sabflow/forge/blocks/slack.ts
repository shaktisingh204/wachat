/**
 * Forge block: Slack.
 *
 * Auth: Bot user OAuth token (xoxb-…).
 * Actions: Send message (to a channel), Send DM (to a user id).
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const buildHeaders = (ctx: ForgeActionContext): Record<string, string> => {
  const token = ctx.credential?.botToken ?? str(ctx.options.botToken);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=utf-8',
  };
};

async function postMessage(
  ctx: ForgeActionContext,
  channel: string,
  text: string,
  logPrefix: string,
): Promise<ForgeActionResult> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: buildHeaders(ctx),
    body: JSON.stringify({ channel, text }),
  });
  const data: unknown = await res.json();
  const ok = !!(data && typeof data === 'object' && (data as { ok?: boolean }).ok);
  if (!res.ok || !ok) {
    const err =
      data && typeof data === 'object' ? (data as { error?: string }).error ?? 'unknown' : 'unknown';
    throw new Error(`Slack ${logPrefix} failed: ${err}`);
  }
  return { logs: [`${logPrefix} → ${channel}`] };
}

async function sendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return postMessage(ctx, str(ctx.options.channel), str(ctx.options.text), 'Slack message');
}

async function sendDm(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return postMessage(ctx, str(ctx.options.userId), str(ctx.options.text), 'Slack DM');
}

const block: ForgeBlock = {
  id: 'forge_slack',
  name: 'Slack',
  description: 'Post messages and direct messages from a Slack bot.',
  iconName: 'LuSlack',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    fields: [
      {
        id: 'botToken',
        label: 'Bot User OAuth Token',
        type: 'password',
        placeholder: 'xoxb-…',
        required: true,
      },
    ],
  },
  actions: [
    {
      id: 'send_message',
      label: 'Send Channel Message',
      description: 'Post a message to a Slack channel.',
      fields: [
        {
          id: 'channel',
          label: 'Channel',
          type: 'text',
          placeholder: '#general or C01234ABCD',
          required: true,
        },
        { id: 'text', label: 'Message', type: 'textarea', required: true },
      ],
      run: sendMessage,
    },
    {
      id: 'send_dm',
      label: 'Send Direct Message',
      description: 'Post a message directly to a user.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', placeholder: 'U01234ABCD', required: true },
        { id: 'text', label: 'Message', type: 'textarea', required: true },
      ],
      run: sendDm,
    },
  ],
};

registerForgeBlock(block);

export default block;
