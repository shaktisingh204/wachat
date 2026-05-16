/**
 * Forge block: Brevo Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Brevo/BrevoTrigger.node.ts
 *
 * Brevo (formerly Sendinblue) webhooks are scoped to one of three
 * categories — `transactional`, `marketing`, or `inbound`. Each category
 * exposes a different event slug set; the union is exported here.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_CATEGORIES = ['transactional', 'marketing', 'inbound'] as const;

const KNOWN_EVENTS = [
  // transactional
  'blocked',
  'click',
  'deferred',
  'delivered',
  'hardBounce',
  'invalid',
  'spam',
  'opened',
  'request',
  'softBounce',
  'uniqueOpened',
  'unsubscribed',
  // marketing (overlaps with transactional but kept as one set)
  'listAddition',
  // inbound
  'inboundEmailProcessed',
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
      service: 'Brevo',
      sabflowReceiverUrl,
      supportedCategories: KNOWN_CATEGORIES,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.brevo.com/reference/createwebhook',
      registrationInstructions:
        `POST to https://api.brevo.com/v3/webhooks with url=${sabflowReceiverUrl}, type (transactional|marketing|inbound), and events from supportedEvents.`,
    },
    logs: [`Brevo trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_brevo_trigger',
  name: 'Brevo Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Brevo event types n8n supports. Register via the Brevo API manually.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Brevo events to subscribe to.',
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
          placeholder: '["delivered","opened"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
