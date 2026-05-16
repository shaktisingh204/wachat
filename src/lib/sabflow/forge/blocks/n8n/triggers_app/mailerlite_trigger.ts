/**
 * Forge block: MailerLite Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * register the URL via the MailerLite webhook API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/MailerLite/v2/MailerLiteTriggerV2.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'campaign.sent',
  'subscriber.added_to_group',
  'subscriber.automation_completed',
  'subscriber.automation_triggered',
  'subscriber.bounced',
  'subscriber.created',
  'subscriber.removed_from_group',
  'subscriber.spam_reported',
  'subscriber.unsubscribed',
  'subscriber.updated',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'MailerLite',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.mailerlite.com/docs/webhooks.html',
      registrationInstructions:
        `POST https://connect.mailerlite.com/api/webhooks with { name, events: [<selectedEvents>], url: "${sabflowReceiverUrl}" } using Bearer auth.`,
    },
    logs: [`MailerLite trigger info → ${KNOWN_EVENTS.length} known event types`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mailerlite_trigger',
  name: 'MailerLite Trigger (info)',
  description:
    'Returns the SabFlow receiver URL + MailerLite event types. Register via POST /api/webhooks.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + MailerLite event types to subscribe to.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["subscriber.created", "campaign.sent"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
