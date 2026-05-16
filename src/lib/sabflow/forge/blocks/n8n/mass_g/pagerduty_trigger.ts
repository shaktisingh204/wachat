/**
 * Forge block: PagerDuty Trigger (info shim).
 *
 * Registration-info shim. Incoming webhooks are handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: PagerDuty webhook V3.
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
  'incident.acknowledged',
  'incident.annotated',
  'incident.delegated',
  'incident.escalated',
  'incident.priority_updated',
  'incident.reassigned',
  'incident.reopened',
  'incident.resolved',
  'incident.responder.added',
  'incident.responder.replied',
  'incident.status_update_published',
  'incident.triggered',
  'incident.unacknowledged',
  'service.created',
  'service.deleted',
  'service.updated',
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
      service: 'PagerDuty',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.pagerduty.com/docs/webhooks/webhooks-overview',
      registrationInstructions:
        `Create a Webhook Subscription in PagerDuty pointing at ${sabflowReceiverUrl} subscribed to one or more of supportedEvents.`,
    },
    logs: [`PagerDuty trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_pagerduty_trigger',
  name: 'PagerDuty Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + PagerDuty event types. Register the URL in PagerDuty manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + PagerDuty event slugs to subscribe to.',
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
          placeholder: '["incident.triggered", "incident.resolved"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
