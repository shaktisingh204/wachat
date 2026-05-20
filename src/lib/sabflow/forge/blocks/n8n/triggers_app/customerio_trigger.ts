/**
 * Forge block: Customer.io Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/CustomerIo/CustomerIoTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'customer.subscribed',
  'customer.unsubscribed',
  'email.attempted',
  'email.bounced',
  'email.clicked',
  'email.converted',
  'email.delivered',
  'email.drafted',
  'email.failed',
  'email.opened',
  'email.sent',
  'email.spammed',
  'push.attempted',
  'push.bounced',
  'push.clicked',
  'push.delivered',
  'push.drafted',
  'push.failed',
  'push.opened',
  'push.sent',
  'slack.attempted',
  'slack.clicked',
  'slack.drafted',
  'slack.failed',
  'slack.sent',
  'sms.attempted',
  'sms.bounced',
  'sms.clicked',
  'sms.delivered',
  'sms.drafted',
  'sms.failed',
  'sms.sent',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw) ? eventTypesRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Customer.io',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://customer.io/docs/api/webhooks/',
      registrationInstructions: `Create a Reporting Webhook in Customer.io pointing at ${sabflowReceiverUrl}, subscribed to selected events.`,
    },
    logs: [`Customer.io trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_customerio_trigger',
  name: 'Customer.io Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Customer.io reporting event slugs.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Customer.io event slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Event types (JSON array)', type: 'json', placeholder: '["email.delivered"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
