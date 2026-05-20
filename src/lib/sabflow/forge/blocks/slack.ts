/**
 * Forge block: Slack.
 *
 * Auth: routed through SabFlow Connections (credentialType `slack`).
 *   credential.botToken → Bearer token used to call chat.postMessage.
 * Actions: Send message (to a channel), Send DM (to a user id).
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function postMessage(
  ctx: ForgeActionContext,
  channel: string,
  text: string,
  logPrefix: string,
): Promise<ForgeActionResult> {
  if (!ctx.credential?.botToken) {
    throw new Error('Slack: select a credential from SabFlow Connections');
  }
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method: 'POST',
    url: 'https://slack.com/api/chat.postMessage',
    tokenField: 'botToken',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    json: { channel, text },
  });
  const data = r.data;
  const ok = !!(data && typeof data === 'object' && (data as { ok?: boolean }).ok);
  if (!r.ok || !ok) {
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
    credentialType: 'slack',
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
