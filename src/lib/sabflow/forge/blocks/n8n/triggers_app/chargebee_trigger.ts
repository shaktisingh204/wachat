/**
 * Forge block: Chargebee Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Chargebee/ChargebeeTrigger.node.ts
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
  'card_added',
  'card_deleted',
  'card_expired',
  'card_expiring',
  'card_updated',
  'customer_changed',
  'customer_created',
  'customer_deleted',
  'invoice_created',
  'invoice_deleted',
  'invoice_generated',
  'invoice_updated',
  'payment_failed',
  'payment_initiated',
  'payment_refunded',
  'payment_succeeded',
  'refund_initiated',
  'subscription_activated',
  'subscription_cancellation_scheduled',
  'subscription_cancelled',
  'subscription_cancelling',
  'subscription_changed',
  'subscription_created',
  'subscription_deleted',
  'subscription_reactivated',
  'subscription_renewal_reminder',
  'subscription_renewed',
  'subscription_scheduled_cancellation_removed',
  'subscription_shipping_address_updated',
  'subscription_started',
  'subscription_trial_ending',
  'transaction_created',
  'transaction_deleted',
  'transaction_updated',
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
      service: 'Chargebee',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://www.chargebee.com/docs/2.0/events_and_webhooks.html',
      registrationInstructions:
        `In Chargebee dashboard → Settings → Webhooks, add a new webhook pointing at ${sabflowReceiverUrl} and select events from supportedEvents.`,
    },
    logs: [`Chargebee trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_chargebee_trigger',
  name: 'Chargebee Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Chargebee event types n8n supports. Register via the Chargebee dashboard manually.',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Chargebee events to subscribe to.',
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
          placeholder: '["subscription_created"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
