/**
 * Forge block: Mailchimp Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailchimp/MailchimpTrigger.node.ts
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
  'subscribe',
  'unsubscribe',
  'profile',
  'cleaned',
  'upemail',
  'campaign',
] as const;

const KNOWN_SOURCES = ['user', 'admin', 'api'] as const;

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
      service: 'Mailchimp',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      supportedSources: KNOWN_SOURCES,
      selectedEvents: eventTypes,
      registrationDocs: 'https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/',
      registrationInstructions:
        `Open Mailchimp → Audience → Settings → Webhooks and add ${sabflowReceiverUrl}. Tick the boxes matching supportedEvents and choose sources from supportedSources.`,
    },
    logs: [`Mailchimp trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mailchimp_trigger',
  name: 'Mailchimp Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Mailchimp event types n8n supports. Register the URL in Mailchimp manually.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Mailchimp event types to subscribe to.',
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
          placeholder: '["subscribe", "unsubscribe"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
