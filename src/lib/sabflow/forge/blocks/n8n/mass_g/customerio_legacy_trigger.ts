/**
 * Forge block: Customer.io (legacy) Trigger (info shim).
 *
 * Registration-info shim. Incoming webhooks are handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: Customer.io reporting webhooks (legacy v1).
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
  'email_attempted',
  'email_bounced',
  'email_clicked',
  'email_converted',
  'email_delivered',
  'email_drafted',
  'email_dropped',
  'email_failed',
  'email_opened',
  'email_sent',
  'email_spammed',
  'email_unsubscribed',
  'sms_attempted',
  'sms_bounced',
  'sms_clicked',
  'sms_delivered',
  'sms_dropped',
  'sms_failed',
  'sms_sent',
  'push_attempted',
  'push_bounced',
  'push_clicked',
  'push_delivered',
  'push_dropped',
  'push_failed',
  'push_opened',
  'push_sent',
  'slack_attempted',
  'slack_clicked',
  'slack_drafted',
  'slack_dropped',
  'slack_failed',
  'slack_sent',
  'webhook_attempted',
  'webhook_clicked',
  'webhook_drafted',
  'webhook_dropped',
  'webhook_failed',
  'webhook_sent',
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
      service: 'Customer.io (legacy)',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://customer.io/docs/api/webhooks/',
      registrationInstructions:
        `In Customer.io, Account Settings → Reporting Webhooks, add an endpoint with URL ${sabflowReceiverUrl} and check one or more of supportedEvents.`,
    },
    logs: [`Customer.io (legacy) trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_customerio_legacy_trigger',
  name: 'Customer.io Legacy Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Customer.io legacy reporting-webhook event types.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Customer.io legacy event slugs.',
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
          placeholder: '["email_sent", "email_opened"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
