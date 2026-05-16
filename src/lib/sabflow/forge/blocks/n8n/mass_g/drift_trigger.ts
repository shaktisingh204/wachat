/**
 * Forge block: Drift Trigger (info shim).
 *
 * Registration-info shim. Incoming webhooks are handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: Drift Dev Platform webhooks.
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
  'new_message',
  'new_conversation',
  'conversation_status_change',
  'new_email',
  'phone_call_event',
  'meeting',
  'attribute_change',
  'contact_identified',
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
      service: 'Drift',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://devdocs.drift.com/docs/webhooks-overview',
      registrationInstructions:
        `Register a Drift webhook in your Dev App with the callback URL set to ${sabflowReceiverUrl} and subscribe to one or more of supportedEvents.`,
    },
    logs: [`Drift trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_drift_trigger',
  name: 'Drift Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Drift event types. Wire up a Drift Dev App webhook subscription manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Drift event slugs to subscribe to.',
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
          placeholder: '["new_message", "new_conversation"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
