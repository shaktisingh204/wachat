/**
 * Forge block: Discord (webhook-based).
 *
 * Auth: none (the webhook URL is its own secret).
 * Actions: Send webhook message.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function sendWebhookMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookUrl = str(ctx.options.webhookUrl);
  const content = str(ctx.options.content);
  const username = str(ctx.options.username);
  const avatarUrl = str(ctx.options.avatarUrl);

  const body: Record<string, unknown> = { content };
  if (username) body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status}`);

  return { logs: ['Discord: webhook message delivered'] };
}

const block: ForgeBlock = {
  id: 'forge_discord',
  name: 'Discord',
  description: 'Post a message to a Discord channel via webhook.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  fields: [
    {
      id: 'webhookUrl',
      label: 'Webhook URL',
      type: 'password',
      placeholder: 'https://discord.com/api/webhooks/…',
      required: true,
    },
    { id: 'content', label: 'Message', type: 'textarea', required: true },
    { id: 'username', label: 'Override Username', type: 'text' },
    { id: 'avatarUrl', label: 'Override Avatar URL', type: 'text' },
  ],
  actions: [
    {
      id: 'send_message',
      label: 'Send Webhook Message',
      description: 'Deliver a message through the configured Discord webhook.',
      fields: [
        {
          id: 'webhookUrl',
          label: 'Webhook URL',
          type: 'password',
          placeholder: 'https://discord.com/api/webhooks/…',
          required: true,
        },
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
