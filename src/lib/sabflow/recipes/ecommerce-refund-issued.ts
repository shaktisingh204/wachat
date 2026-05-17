/**
 * Recipe: Refund issued → customer email + CS Slack heads-up.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ecommerce-refund-issued',
  name: 'E-commerce: Refund issued',
  category: 'ecommerce',
  description:
    'On a refund webhook, email the customer the refund confirmation and notify customer-success in Slack.',
  tags: ['ecommerce', 'refund', 'support', 'slack', 'email'],
  trigger: {
    id: 't_refund',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'order_refunded',
    options: {
      path: '/webhooks/orders/refunded',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_amount', name: 'refund.amount', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Refund processed',
        body: 'We refunded {{refund.amount}} to your card — it should appear in 5–10 days.',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#customer-success',
        text: ':money_with_wings: Refund: {{refund.amount}} to {{customer.email}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
