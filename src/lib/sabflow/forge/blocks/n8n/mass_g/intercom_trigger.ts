/**
 * Forge block: Intercom Trigger (info shim).
 *
 * Registration-info shim. Incoming webhooks are handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: Intercom developer hub webhooks.
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
  'conversation.user.created',
  'conversation.user.replied',
  'conversation.admin.replied',
  'conversation.admin.assigned',
  'conversation.admin.closed',
  'conversation.admin.opened',
  'conversation.admin.noted',
  'user.created',
  'user.deleted',
  'user.email.updated',
  'user.tag.created',
  'user.tag.deleted',
  'contact.created',
  'contact.deleted',
  'company.created',
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
      service: 'Intercom',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.intercom.com/building-apps/docs/webhooks',
      registrationInstructions:
        `In your Intercom app's Developer Hub, add a webhook subscription pointing at ${sabflowReceiverUrl} and select one or more of supportedEvents.`,
    },
    logs: [`Intercom trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_intercom_trigger',
  name: 'Intercom Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Intercom event types. Wire up an Intercom app webhook subscription manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Intercom event slugs to subscribe to.',
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
          placeholder: '["conversation.user.created", "user.created"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
