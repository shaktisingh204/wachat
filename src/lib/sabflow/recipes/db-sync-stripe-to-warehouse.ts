/**
 * Recipe: Stripe charges → internal warehouse.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'db-sync-stripe-to-warehouse',
  name: 'DB sync: Stripe → warehouse',
  category: 'finance',
  description:
    'Pull recent Stripe charges and post them into your internal data warehouse endpoint.',
  tags: ['sync', 'stripe', 'warehouse', 'finance', 'database'],
  trigger: {
    id: 't_stripe_tick',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 */6 * * *' },
  },
  variables: [
    { id: 'v_warehouse', name: 'warehouse.url', defaultValue: 'https://warehouse.example.com/ingest/stripe' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: 'https://api.stripe.com/v1/charges?limit=100',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{STRIPE_SECRET}}' }],
      },
    },
    {
      id: 'b_push',
      groupId: 'g_push',
      type: 'webhook',
      options: {
        url: '{{warehouse.url}}',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{{ $json }}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
