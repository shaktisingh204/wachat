/**
 * Forge block: Iterable Trigger (info shim).
 *
 * Registration-info shim. Incoming webhooks are handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: Iterable webhooks (System Webhooks / Workflow Webhooks).
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
  'emailSend',
  'emailOpen',
  'emailClick',
  'emailBounce',
  'emailComplaint',
  'emailUnsubscribe',
  'emailSubscribe',
  'smsSend',
  'smsReceived',
  'pushSend',
  'pushOpen',
  'inAppSend',
  'inAppOpen',
  'inAppClick',
  'inAppDelete',
  'workflowEntry',
  'workflowExit',
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
      service: 'Iterable',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://support.iterable.com/hc/en-us/articles/204780589-Setting-up-Webhooks',
      registrationInstructions:
        `In Iterable, go to Integrations → Webhooks, create a new webhook with URL ${sabflowReceiverUrl} and tick one or more of supportedEvents.`,
    },
    logs: [`Iterable trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_iterable_trigger',
  name: 'Iterable Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Iterable event types. Wire up the webhook in Iterable manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Iterable event slugs.',
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
          placeholder: '["emailSend", "emailOpen"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
