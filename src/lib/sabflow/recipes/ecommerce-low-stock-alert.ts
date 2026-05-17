/**
 * Recipe: Low-stock product → Slack alert + ops email.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ecommerce-low-stock-alert',
  name: 'E-commerce: Low stock alert',
  category: 'ecommerce',
  description:
    'On a "low stock" webhook from the storefront, post to Slack and email the operations lead.',
  tags: ['ecommerce', 'inventory', 'stock', 'alert', 'slack'],
  trigger: {
    id: 't_low_stock',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'inventory_low',
    options: {
      path: '/webhooks/inventory/low',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_sku', name: 'product.sku', defaultValue: '' },
    { id: 'v_qty', name: 'product.qty', defaultValue: '' },
    { id: 'v_ops_email', name: 'ops.email', defaultValue: 'ops@example.com' },
  ],
  blocks: [
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#inventory',
        text: ':warning: Low stock — *{{product.sku}}* down to {{product.qty}} units.',
      },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{ops.email}}',
        subject: 'Low stock: {{product.sku}}',
        body: 'Only {{product.qty}} of {{product.sku}} left — reorder soon.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
