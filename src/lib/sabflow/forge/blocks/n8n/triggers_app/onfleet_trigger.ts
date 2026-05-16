/**
 * Forge block: Onfleet Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Onfleet/OnfleetTrigger.node.ts
 *
 * Onfleet webhook triggers use numeric "trigger" keys (0..17) mapped to event
 * names. See n8n-master/packages/nodes-base/nodes/Onfleet/WebhookMapping.ts.
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
  'taskStarted',
  'taskEta',
  'taskArrival',
  'taskCompleted',
  'taskFailed',
  'workerDuty',
  'taskCreated',
  'taskUpdated',
  'taskDeleted',
  'taskAssigned',
  'taskUnassigned',
  'taskDelayed',
  'taskCloned',
  'smsRecipientResponseMissed',
  'workerCreated',
  'workerDeleted',
  'SMSRecipientOptOut',
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
      service: 'Onfleet',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://docs.onfleet.com/reference/webhooks',
      registrationInstructions:
        `POST to https://onfleet.com/api/v2/webhooks with url=${sabflowReceiverUrl} and trigger=<numeric key> (e.g. 0=taskStarted, 3=taskCompleted). Onfleet hits the URL with GET ?check=<token> first — SabFlow's receiver echoes it back automatically.`,
    },
    logs: [`Onfleet trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_onfleet_trigger',
  name: 'Onfleet Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Onfleet event names n8n supports. Register the URL in Onfleet manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Onfleet event names to subscribe to.',
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
          placeholder: '["taskCompleted", "taskFailed"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
