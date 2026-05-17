/**
 * Recipe: Shopify order webhook → CRM + ops Slack.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'webhook-relay-shopify-order',
  name: 'Webhook relay: Shopify order',
  category: 'ecommerce',
  description:
    'When Shopify fires order/create, mirror the order into the CRM and ping the ops channel.',
  tags: ['webhook', 'shopify', 'order', 'relay', 'ecommerce'],
  trigger: {
    id: 't_order',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'shopify_order_created',
    options: {
      path: '/webhooks/shopify/order-created',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#orders' },
  ],
  blocks: [
    {
      id: 'b_crm',
      groupId: 'g_crm',
      type: 'webhook',
      options: {
        url: '/api/crm/orders',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{{ $json.body }}' },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text: ':package: New order #{{ $json.body.id }} — {{ $json.body.total_price }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
