/**
 * Forge block: Telegram Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Telegram/TelegramTrigger.node.ts
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const SERVICE = 'Telegram';

const SUPPORTED_EVENTS = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'inline_query',
  'chosen_inline_result',
  'callback_query',
  'shipping_query',
  'pre_checkout_query',
  'poll',
  'poll_answer',
  'my_chat_member',
  'chat_member',
  'chat_join_request',
  '*',
] as const;

const REGISTRATION_DOCS = 'https://core.telegram.org/bots/api#setwebhook';

const REGISTRATION_INSTRUCTIONS = [
  '1. Create a bot with @BotFather and copy the bot token.',
  '2. Call https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SabFlow URL>&allowed_updates=["message",…] to register.',
  '3. Telegram POSTs an Update object on each event; branch on the populated field (`message`, `callback_query`, etc).',
].join('\n');

async function registerTriggerInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId).trim();
  const eventTypes = parseEvents(ctx.options.eventTypes);

  const base = asString(ctx.variables.SABFLOW_PUBLIC_URL) || 'https://app.sabnode.com';
  const sabflowReceiverUrl = webhookId
    ? `${base.replace(/\/+$/, '')}/api/sabflow/webhook/${webhookId}`
    : `${base.replace(/\/+$/, '')}/api/sabflow/webhook/<webhookId>`;

  return {
    outputs: {
      service: SERVICE,
      sabflowReceiverUrl,
      supportedEvents: [...SUPPORTED_EVENTS],
      selectedEvents: eventTypes,
      registrationDocs: REGISTRATION_DOCS,
      registrationInstructions: REGISTRATION_INSTRUCTIONS,
    },
    logs: [`${SERVICE} Trigger info → receiver=${sabflowReceiverUrl}`],
  };
}

function parseEvents(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => asString(v)).filter(Boolean);
  const s = asString(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) return parsed.map((v) => asString(v)).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

const block: ForgeBlock = {
  id: 'forge_telegram_trigger',
  name: 'Telegram Trigger',
  description:
    'Registration-info shim for Telegram bot webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Telegram Update types so you can pass them to setWebhook.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook ID',
          type: 'text',
          required: false,
          placeholder: 'mint via flow.events + upsertFlowWebhooks',
          helperText:
            'The `webhookId` minted by `upsertFlowWebhooks` for this flow. Leave blank to preview a placeholder URL.',
        },
        {
          id: 'eventTypes',
          label: 'allowed_updates',
          type: 'json',
          placeholder: '["message","callback_query"] or comma-separated',
          helperText:
            'Telegram Update field names to subscribe to. Pass these as `allowed_updates` to setWebhook.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
