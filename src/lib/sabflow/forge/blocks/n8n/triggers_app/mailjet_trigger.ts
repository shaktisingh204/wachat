/**
 * Forge block: Mailjet Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * register the URL via Mailjet's event API (eventcallbackurl).
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailjet/MailjetTrigger.node.ts
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
  'blocked',
  'bounce',
  'open',
  'sent',
  'spam',
  'unsub',
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
      service: 'Mailjet',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://dev.mailjet.com/email/guides/webhooks/',
      registrationInstructions:
        `POST one row per event to https://api.mailjet.com/v3/REST/eventcallbackurl with { EventType, Url: "${sabflowReceiverUrl}", Status: "alive", IsBackup: false }.`,
    },
    logs: [`Mailjet trigger info → ${KNOWN_EVENTS.length} known event types`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mailjet_trigger',
  name: 'Mailjet Trigger (info)',
  description:
    'Returns the SabFlow receiver URL + Mailjet event types. Register via POST /v3/REST/eventcallbackurl.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Mailjet event types to subscribe to.',
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
          placeholder: '["open", "bounce"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
