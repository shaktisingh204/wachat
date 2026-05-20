/**
 * Forge block: Discord (webhook-based).
 *
 * Auth: routed through SabFlow Connections (credentialType `discord`).
 *   credential.webhookUrl → Discord incoming webhook used for chat posts.
 * Actions: Send webhook message.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function sendWebhookMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookUrl = ctx.credential?.webhookUrl;
  if (!webhookUrl) {
    throw new Error('Discord: select a credential from SabFlow Connections');
  }
  const content = str(ctx.options.content);
  const username = str(ctx.options.username);
  const avatarUrl = str(ctx.options.avatarUrl);

  const body: Record<string, unknown> = { content };
  if (username) body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;

  const r = await ctx.helpers!.httpRequest({
    method: 'POST',
    url: webhookUrl,
    json: body,
  });
  if (!r.ok) throw new Error(`Discord webhook failed: ${r.status}`);

  return { logs: ['Discord: webhook message delivered'] };
}

const block: ForgeBlock = {
  id: 'forge_discord',
  name: 'Discord',
  description: 'Post a message to a Discord channel via webhook.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'discord',
  },
  actions: [
    {
      id: 'send_message',
      label: 'Send Webhook Message',
      description: 'Deliver a message through the configured Discord webhook.',
      fields: [
        { id: 'content', label: 'Message', type: 'textarea', required: true },
        { id: 'username', label: 'Override Username', type: 'text' },
        { id: 'avatarUrl', label: 'Override Avatar URL', type: 'text' },
      ],
      run: sendWebhookMessage,
    },
  ],
};

registerForgeBlock(block);

export default block;
