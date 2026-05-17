/**
 * Recipe: Shopify order fulfilled → shipping email + WhatsApp ping.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ecommerce-order-fulfilled',
  name: 'E-commerce: Order fulfilled',
  category: 'ecommerce',
  description:
    'When an order is marked fulfilled, send the customer a shipping email and a WhatsApp ping.',
  tags: ['ecommerce', 'shipping', 'order', 'whatsapp', 'email'],
  trigger: {
    id: 't_fulfilled',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'order_fulfilled',
    options: {
      path: '/webhooks/orders/fulfilled',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_phone', name: 'customer.phone', defaultValue: '' },
    { id: 'v_track', name: 'tracking.url', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Your order is on its way',
        body: 'Track it here: {{tracking.url}}',
      },
    },
    {
      id: 'b_wa',
      groupId: 'g_wa',
      type: 'forge_twilio',
      options: {
        action: 'whatsapp_send',
        to: '{{customer.phone}}',
        body: 'Your order shipped — track at {{tracking.url}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
