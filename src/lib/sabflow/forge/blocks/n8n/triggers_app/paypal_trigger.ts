/**
 * Forge block: PayPal Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/PayPal/PayPalTrigger.node.ts
 *
 * PayPal's webhook event catalog is dynamic — it's served by
 * GET /v1/notifications/webhooks-event-types. The list below is the common
 * subset surfaced for autocomplete; use `*` to subscribe to every event.
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
  '*',
  'BILLING.PLAN.CREATED',
  'BILLING.PLAN.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.ORDER.COMPLETED',
  'CUSTOMER.DISPUTE.CREATED',
  'CUSTOMER.DISPUTE.RESOLVED',
  'CUSTOMER.DISPUTE.UPDATED',
  'INVOICING.INVOICE.CANCELLED',
  'INVOICING.INVOICE.PAID',
  'INVOICING.INVOICE.REFUNDED',
  'PAYMENT.AUTHORIZATION.CREATED',
  'PAYMENT.AUTHORIZATION.VOIDED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.DENIED',
  'PAYMENT.SALE.PENDING',
  'PAYMENT.SALE.REFUNDED',
  'PAYMENT.SALE.REVERSED',
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
      service: 'PayPal',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.paypal.com/api/rest/webhooks/',
      registrationInstructions:
        `POST to https://api-m.paypal.com/v1/notifications/webhooks with url=${sabflowReceiverUrl} and event_types=[{name: "EVENT_NAME"}, ...]. Use "*" to subscribe to every event. Production webhooks are signature-verified via /v1/notifications/verify-webhook-signature.`,
    },
    logs: [`PayPal trigger info → ${KNOWN_EVENTS.length} suggested events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_paypal_trigger',
  name: 'PayPal Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + PayPal event types n8n supports. Register the URL in PayPal manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the PayPal event slugs to subscribe to.',
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
          placeholder: '["CHECKOUT.ORDER.COMPLETED"]',
          helperText: `Use ["*"] to subscribe to all events, or pick from: ${KNOWN_EVENTS.join(', ')}. Full list is dynamic — fetch /v1/notifications/webhooks-event-types from PayPal for the live catalog.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
