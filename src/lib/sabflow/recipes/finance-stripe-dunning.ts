/**
 * Recipe: Stripe failed payment → dunning email + Slack to AR.
 *
 * Triggered by Stripe's `invoice.payment_failed` webhook. We email the
 * customer with a payment-method-update link and ping the finance team in
 * Slack so they can intervene on high-value invoices.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'finance-stripe-dunning',
  name: 'Finance: Stripe failed payment dunning',
  category: 'finance',
  description:
    'On a Stripe payment failure, email the customer a portal link to fix their card and notify the AR team in Slack with the invoice details.',
  tags: ['finance', 'stripe', 'dunning', 'slack', 'ar'],
  trigger: {
    id: 't_failed',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'stripe_event',
    options: {
      path: '/webhooks/stripe/invoice-payment-failed',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_invoice', name: 'invoice.id', defaultValue: '' },
    { id: 'v_amount', name: 'invoice.amount', defaultValue: '$0.00' },
    { id: 'v_portal', name: 'portal.url', defaultValue: 'https://billing.stripe.com/p/login/...' },
  ],
  blocks: [
    {
      id: 'b_extract_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'customer.email', value: '{{ $json.body.data.object.customer_email }}' },
    },
    {
      id: 'b_extract_amount',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'invoice.amount', value: '{{ $json.body.data.object.amount_due }}' },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Payment issue — your card was declined',
        body:
          'We had trouble charging your card for {{invoice.amount}}. Update ' +
          'your payment method here: {{portal.url}} — your service stays on as ' +
          'long as you fix it in the next 3 days.',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#ar-alerts',
        text:
          ':rotating_light: Payment failed — invoice `{{invoice.id}}` ({{invoice.amount}}) ' +
          'for `{{customer.email}}`. Dunning email sent. Review if this is a key account.',
      },
    },
    {
      id: 'b_log',
      groupId: 'g_log',
      type: 'webhook',
      options: {
        url: '/api/finance/dunning-log',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"invoiceId":"{{invoice.id}}","customer":"{{customer.email}}","amount":"{{invoice.amount}}","step":1,"sentAt":"{{ $now }}"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
