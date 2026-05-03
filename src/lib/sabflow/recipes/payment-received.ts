/**
 * Recipe: Payment webhook → CRM deal won + receipt email.
 *
 * Triggered by a payment-success webhook (Stripe / Razorpay style).
 * Marks the matching CRM deal as won and emails a receipt to the buyer.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'payment-received',
  name: 'Payment Received → Deal Won + Receipt',
  category: 'finance',
  description:
    'When a payment succeeds, mark the CRM deal as won and send a ' +
    'professional receipt email to the customer.',
  tags: ['payment', 'crm', 'email', 'receipt', 'deal'],
  trigger: {
    id: 't_payment_received',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'payment_succeeded',
    options: {
      path: '/webhooks/payments/succeeded',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Webhook-Secret',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_deal_id', name: 'deal.id', defaultValue: '' },
    { id: 'v_customer_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_customer_name', name: 'customer.name', defaultValue: '' },
    { id: 'v_amount', name: 'payment.amount', defaultValue: '0' },
    { id: 'v_currency', name: 'payment.currency', defaultValue: 'USD' },
    { id: 'v_invoice', name: 'payment.invoiceUrl', defaultValue: '' },
  ],
  blocks: [
    // Step 1 — mark CRM deal as won
    {
      id: 'b_mark_won',
      groupId: 'g_crm',
      type: 'webhook',
      options: {
        url: '/api/crm/deals/{{deal.id}}',
        method: 'PATCH',
        body: {
          type: 'json',
          content: JSON.stringify({
            stage: 'won',
            wonAt: '{{$now}}',
            amount: '{{payment.amount}}',
            currency: '{{payment.currency}}',
          }),
        },
      },
    },
    // Step 2 — send receipt email
    {
      id: 'b_receipt',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Receipt for your payment',
        bodyType: 'html',
        body:
          '<p>Hi {{customer.name}},</p>' +
          '<p>Thanks for your payment of ' +
          '<strong>{{payment.amount}} {{payment.currency}}</strong>.</p>' +
          '<p><a href="{{payment.invoiceUrl}}">View / download invoice</a></p>',
      },
    },
    // Step 3 — internal notification
    {
      id: 'b_internal',
      groupId: 'g_internal',
      type: 'forge_slack',
      options: {
        action: 'message_send',
        channel: '#sales-wins',
        text:
          ':moneybag: Deal won — {{customer.name}} paid ' +
          '{{payment.amount}} {{payment.currency}} (deal {{deal.id}}).',
      },
    },
  ],
};

registerRecipe(recipe);

export default recipe;
