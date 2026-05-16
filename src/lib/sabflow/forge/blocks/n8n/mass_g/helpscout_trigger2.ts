/**
 * Forge block: Help Scout Trigger v2 (info shim).
 *
 * Registration-info shim — second instance kept in mass_g because the original
 * `triggers_app/helpscout_trigger.ts` already exists.
 *
 * Source: Help Scout Mailbox API webhooks.
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
  'convo.assigned',
  'convo.created',
  'convo.deleted',
  'convo.merged',
  'convo.moved',
  'convo.status',
  'convo.tags',
  'convo.customer.reply.created',
  'convo.agent.reply.created',
  'convo.note.created',
  'customer.created',
  'customer.updated',
  'rating.received',
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
      service: 'Help Scout',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.helpscout.com/webhooks/',
      registrationInstructions:
        `Create a Help Scout webhook (Manage → Apps → Webhooks) pointing at ${sabflowReceiverUrl} and subscribe to one or more of supportedEvents.`,
    },
    logs: [`Help Scout trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_helpscout_trigger2',
  name: 'Help Scout Trigger v2 (info)',
  description:
    'Returns the SabFlow webhook URL + Help Scout event types. Wire up the webhook in Help Scout manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Help Scout event slugs to subscribe to.',
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
          placeholder: '["convo.created", "convo.assigned"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
