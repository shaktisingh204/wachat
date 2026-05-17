/**
 * Recipe: Refund issued → email customer + log Sentry breadcrumb.
 *
 * Triggered on the `charge.refunded` Stripe event. We email a friendly
 * confirmation to the customer and post a Sentry "info" event tagged with
 * the order id — useful when refunds correlate with a buggy release.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'finance-refund-issued-sentry',
  name: 'Finance: Refund issued → Sentry context',
  category: 'finance',
  description:
    'On a Stripe refund, email the customer the receipt and post a Sentry event so engineers can correlate refunds with deploys.',
  tags: ['finance', 'refund', 'sentry', 'stripe', 'email'],
  trigger: {
    id: 't_refunded',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'stripe_event',
    options: {
      path: '/webhooks/stripe/charge-refunded',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_amount', name: 'refund.amount', defaultValue: '$0.00' },
    { id: 'v_charge', name: 'charge.id', defaultValue: '' },
    { id: 'v_order', name: 'order.id', defaultValue: '' },
    { id: 'v_sentry_dsn', name: 'sentry.dsn', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'customer.email', value: '{{ $json.body.data.object.billing_details.email }}' },
    },
    {
      id: 'b_set_amount',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'refund.amount', value: '{{ $json.body.data.object.amount_refunded }}' },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Your refund is on its way',
        body:
          'We refunded {{refund.amount}} to the card on file (charge {{charge.id}}). ' +
          'It usually shows up in 5–10 business days. Reply here if you need anything else.',
      },
    },
    {
      id: 'b_sentry',
      groupId: 'g_sentry',
      type: 'webhook',
      options: {
        url: '{{sentry.dsn}}',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Content-Type', value: 'application/json' },
          { id: 'h2', key: 'X-Sentry-Auth', value: 'Sentry sentry_version=7, sentry_key={{SENTRY_KEY}}' },
        ],
        body: {
          type: 'json',
          content:
            '{"level":"info","message":"Stripe refund issued","tags":{"order_id":"{{order.id}}","charge_id":"{{charge.id}}"},"extra":{"amount":"{{refund.amount}}","customer":"{{customer.email}}"}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
