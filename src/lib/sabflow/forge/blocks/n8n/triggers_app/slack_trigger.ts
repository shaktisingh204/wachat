/**
 * Forge block: Slack Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Slack/SlackTrigger.node.ts
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

const SERVICE = 'Slack';

const SUPPORTED_EVENTS = [
  'message',
  'message.channels',
  'message.groups',
  'message.im',
  'message.mpim',
  'app_mention',
  'reaction_added',
  'reaction_removed',
  'channel_created',
  'channel_deleted',
  'channel_rename',
  'channel_archive',
  'channel_unarchive',
  'member_joined_channel',
  'member_left_channel',
  'team_join',
  'user_change',
  'file_created',
  'file_shared',
  'file_deleted',
  'pin_added',
  'pin_removed',
  'star_added',
  'star_removed',
  'app_home_opened',
  'workflow_step_execute',
] as const;

const REGISTRATION_DOCS = 'https://api.slack.com/apis/events-api';

const REGISTRATION_INSTRUCTIONS = [
  '1. Create / open your Slack app at https://api.slack.com/apps → Event Subscriptions → enable.',
  '2. Paste the SabFlow receiver URL below into "Request URL". Slack will send a `url_verification` challenge — SabFlow’s receiver must echo back `challenge`.',
  '3. Add the bot/user events you want under "Subscribe to events" and install the app. Slack POSTs `event_callback` envelopes; branch on `event.type` inside your flow.',
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
  id: 'forge_slack_trigger',
  name: 'Slack Trigger',
  description:
    'Registration-info shim for Slack Events API. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Slack event surface so you can paste it into the Slack app Event Subscriptions UI.',
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
          label: 'Event types',
          type: 'json',
          placeholder: '["message.channels","app_mention"] or comma-separated',
          helperText:
            'JSON array or comma-separated list of Slack Events API event types to subscribe to.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
