/**
 * Forge block: Stripe Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Stripe/StripeTrigger.node.ts
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
  'account.updated',
  'account.application.authorized',
  'account.application.deauthorized',
  'account.external_account.created',
  'account.external_account.deleted',
  'account.external_account.updated',
  'application_fee.created',
  'application_fee.refunded',
  'application_fee.refund.updated',
  'balance.available',
  'capability.updated',
  'charge.captured',
  'charge.expired',
  'charge.failed',
  'charge.pending',
  'charge.refunded',
  'charge.succeeded',
  'charge.updated',
  'charge.dispute.closed',
  'charge.dispute.created',
  'charge.dispute.funds_reinstated',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.updated',
  'charge.refund.updated',
  'checkout.session.completed',
  'coupon.created',
  'coupon.deleted',
  'coupon.updated',
  'credit_note.created',
  'credit_note.updated',
  'credit_note.voided',
  'customer.created',
  'customer.deleted',
  'customer.updated',
  'customer.discount.created',
  'customer.discount.deleted',
  'customer.discount.updated',
  'customer.source.created',
  'customer.source.deleted',
  'customer.source.expiring',
  'customer.source.updated',
  'customer.subscription.created',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'customer.subscription.updated',
  'customer.tax_id.created',
  'customer.tax_id.deleted',
  'customer.tax_id.updated',
  'file.created',
  'invoice.created',
  'invoice.deleted',
  'invoice.finalized',
  'invoice.marked_uncollectible',
  'invoice.paid',
  'invoice.payment_action_required',
  'invoice.payment_failed',
  'invoice_payment.paid',
  'invoice.payment_succeeded',
  'invoice.sent',
  'invoice.upcoming',
  'invoice.updated',
  'invoice.voided',
  'invoiceitem.created',
  'invoiceitem.deleted',
  'invoiceitem.updated',
  'issuing_authorization.created',
  'issuing_authorization.request',
  'issuing_authorization.updated',
  'issuing_card.created',
  'issuing_card.updated',
  'issuing_cardholder.created',
  'issuing_cardholder.updated',
  'issuing_dispute.created',
  'issuing_dispute.updated',
  'issuing_settlement.created',
  'issuing_settlement.updated',
  'issuing_transaction.created',
  'issuing_transaction.updated',
  'order.created',
  'order.payment_failed',
  'order.payment_succeeded',
  'order.updated',
  'order_return.created',
  'payment_intent.amount_capturable_updated',
  'payment_intent.canceled',
  'payment_intent.created',
  'payment_intent.payment_failed',
  'payment_intent.succeeded',
  'payment_intent.requires_action',
  'payment_method.attached',
  'payment_method.card_automatically_updated',
  'payment_method.detached',
  'payment_method.updated',
  'payout.canceled',
  'payout.created',
  'payout.failed',
  'payout.paid',
  'payout.updated',
  'person.created',
  'person.deleted',
  'person.updated',
  'plan.created',
  'plan.deleted',
  'plan.updated',
  'product.created',
  'product.deleted',
  'product.updated',
  'radar.early_fraud_warning.created',
  'radar.early_fraud_warning.updated',
  'recipient.created',
  'recipient.deleted',
  'recipient.updated',
  'reporting.report_run.failed',
  'reporting.report_run.succeeded',
  'reporting.report_type.updated',
  'review.closed',
  'review.opened',
  'setup_intent.canceled',
  'setup_intent.created',
  'setup_intent.setup_failed',
  'setup_intent.succeeded',
  'sigma.scheduled_query_run.created',
  'sku.created',
  'sku.deleted',
  'sku.updated',
  'source.canceled',
  'source.chargeable',
  'source.failed',
  'source.mandate_notification',
  'source.refund_attributes_required',
  'source.transaction.created',
  'source.transaction.updated',
  'subscription_schedule.aborted',
  'subscription_schedule.canceled',
  'subscription_schedule.completed',
  'subscription_schedule.created',
  'subscription_schedule.expiring',
  'subscription_schedule.released',
  'subscription_schedule.updated',
  'tax_rate.created',
  'tax_rate.updated',
  'topup.canceled',
  'topup.created',
  'topup.failed',
  'topup.reversed',
  'topup.succeeded',
  'transfer.created',
  'transfer.failed',
  'transfer.paid',
  'transfer.reversed',
  'transfer.updated',
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
      service: 'Stripe',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://stripe.com/docs/webhooks',
      registrationInstructions:
        `Open the Stripe Dashboard → Developers → Webhooks and add ${sabflowReceiverUrl}. Select events from supportedEvents (or use "*" to receive all).`,
    },
    logs: [`Stripe trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_stripe_trigger',
  name: 'Stripe Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Stripe event types n8n supports. Register the URL in Stripe manually.',
  iconName: 'LuCreditCard',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Stripe event types to subscribe to.',
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
          placeholder: '["charge.succeeded", "invoice.paid"]',
          helperText: 'See supportedEvents in the output for the full list (or use "*").',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
