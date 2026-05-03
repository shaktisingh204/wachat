/**
 * Recipe: Cart abandoned → SMS retry → WhatsApp follow-up.
 *
 * The trigger is the `ecommerce_cart_abandoned` webhook.  After 1 hour we
 * try SMS first; if no recovery has happened in another 23 hours, we send
 * a WhatsApp follow-up with a discount code.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'abandoned-cart',
  name: 'Abandoned Cart Recovery',
  category: 'ecommerce',
  description:
    'Wait one hour, send an SMS reminder.  If still abandoned after a day, ' +
    'follow up on WhatsApp with a discount code.',
  tags: ['ecommerce', 'cart', 'sms', 'whatsapp', 'recovery'],
  trigger: {
    id: 't_cart_abandoned',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'ecommerce_cart_abandoned',
    options: {
      path: '/webhooks/ecommerce/cart-abandoned',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_phone', name: 'customer.phone', defaultValue: '' },
    { id: 'v_name', name: 'customer.name', defaultValue: '' },
    { id: 'v_cart_url', name: 'cart.recoverUrl', defaultValue: '' },
    { id: 'v_discount', name: 'discount.code', defaultValue: 'COMEBACK10' },
  ],
  blocks: [
    // Step 1 — wait 1 hour after abandonment
    {
      id: 'b_wait_1h',
      groupId: 'g_wait_1h',
      type: 'wait',
      options: { secondsToWaitFor: 3600, seconds: 3600 },
    },
    // Step 2 — send SMS retry via Twilio
    {
      id: 'b_sms',
      groupId: 'g_sms',
      type: 'forge_twilio',
      options: {
        action: 'sms_send',
        to: '{{customer.phone}}',
        body:
          'Hey {{customer.name}}, you left items in your cart. ' +
          'Pick up where you left off: {{cart.recoverUrl}}',
      },
    },
    // Step 3 — wait 23 more hours (total 24h since abandonment)
    {
      id: 'b_wait_23h',
      groupId: 'g_wait_23h',
      type: 'wait',
      options: { secondsToWaitFor: 23 * 3600, seconds: 23 * 3600 },
    },
    // Step 4 — WhatsApp follow-up with a discount
    {
      id: 'b_wa',
      groupId: 'g_wa',
      type: 'forge_twilio',
      options: {
        action: 'whatsapp_send',
        to: '{{customer.phone}}',
        body:
          'Still thinking it over? Use code {{discount.code}} for 10% off — ' +
          'we saved your cart for you: {{cart.recoverUrl}}',
      },
    },
  ],
};

registerRecipe(recipe);

export default recipe;
