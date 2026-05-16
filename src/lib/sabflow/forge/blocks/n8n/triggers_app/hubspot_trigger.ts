/**
 * Forge block: HubSpot Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Hubspot/HubspotTrigger.node.ts
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
  'company.creation',
  'company.deletion',
  'company.propertyChange',
  'contact.creation',
  'contact.deletion',
  'contact.privacyDeletion',
  'contact.propertyChange',
  'conversation.creation',
  'conversation.deletion',
  'conversation.newMessage',
  'conversation.privacyDeletion',
  'conversation.propertyChange',
  'deal.creation',
  'deal.deletion',
  'deal.propertyChange',
  'ticket.creation',
  'ticket.deletion',
  'ticket.propertyChange',
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
      service: 'HubSpot',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.hubspot.com/docs/api/webhooks',
      registrationInstructions:
        `Create a webhook subscription in HubSpot Developer Console pointing at ${sabflowReceiverUrl} with one or more of supportedEvents.`,
    },
    logs: [`HubSpot trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_hubspot_trigger',
  name: 'HubSpot Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + HubSpot event types n8n supports. Register the URL in HubSpot manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the HubSpot event slugs to subscribe to.',
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
          placeholder: '["contact.creation", "deal.propertyChange"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
