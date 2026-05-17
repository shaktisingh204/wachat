/**
 * Recipe: 3-email cart-abandonment recovery sequence over 7 days.
 *
 * Branded as the "long" cart sequence — the existing `abandoned-cart` recipe
 * is short and SMS-first. This one is email-only and is the cadence most DTC
 * brands actually want: 1h, 24h, then 6d with an escalating discount.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'marketing-cart-abandon-7day',
  name: 'Marketing: Cart abandonment 7-day sequence',
  category: 'marketing',
  description:
    'Three emails over a week to win back abandoned carts — gentle nudge, social-proof, then a 15% discount before letting the cart die.',
  tags: ['marketing', 'cart', 'abandonment', 'email', 'sequence'],
  trigger: {
    id: 't_cart_abandoned',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'ecommerce_cart_abandoned',
    options: {
      path: '/webhooks/cart/abandoned-long',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_first', name: 'customer.firstName', defaultValue: '' },
    { id: 'v_recover', name: 'cart.recoverUrl', defaultValue: '' },
    { id: 'v_total', name: 'cart.total', defaultValue: '$0.00' },
    { id: 'v_code', name: 'discount.code', defaultValue: 'COMEBACK15' },
  ],
  blocks: [
    {
      id: 'b_wait_1h',
      groupId: 'g_wait_1h',
      type: 'wait',
      options: { secondsToWaitFor: 3600, seconds: 3600 },
    },
    {
      id: 'b_email1',
      groupId: 'g_email1',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'You left something behind, {{customer.firstName}}',
        body:
          'Your cart is still here — {{cart.total}} worth of goodies. ' +
          'Finish checkout: {{cart.recoverUrl}}',
      },
    },
    {
      id: 'b_wait_23h',
      groupId: 'g_wait_23h',
      type: 'wait',
      options: { secondsToWaitFor: 23 * 3600, seconds: 23 * 3600 },
    },
    {
      id: 'b_email2',
      groupId: 'g_email2',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Loved by 12,847 customers — your pick is almost gone',
        body:
          'These are flying off the shelves. Here\'s what fellow shoppers said ' +
          'about your cart items. Grab them before stock runs out: {{cart.recoverUrl}}',
      },
    },
    {
      id: 'b_wait_5d',
      groupId: 'g_wait_5d',
      type: 'wait',
      options: { secondsToWaitFor: 5 * 86400, seconds: 5 * 86400 },
    },
    {
      id: 'b_email3',
      groupId: 'g_email3',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Last chance — 15% off with code {{discount.code}}',
        body:
          'We saved your cart one more time. Use {{discount.code}} for 15% off ' +
          'at checkout — expires in 24 hours: {{cart.recoverUrl}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
