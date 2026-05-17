/**
 * Recipe: Stripe webhook relay → internal endpoint + Slack heads-up.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'webhook-relay-stripe',
  name: 'Webhook relay: Stripe',
  category: 'finance',
  description:
    'Receive Stripe webhooks, forward them to an internal endpoint, and ping Slack with a summary.',
  tags: ['webhook', 'stripe', 'relay', 'finance', 'slack'],
  trigger: {
    id: 't_stripe_hook',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'stripe_event',
    options: {
      path: '/webhooks/stripe',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_internal', name: 'internal.url', defaultValue: 'https://api.internal/stripe/event' },
  ],
  blocks: [
    {
      id: 'b_forward',
      groupId: 'g_forward',
      type: 'webhook',
      options: {
        url: '{{internal.url}}',
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
        channel: '#payments',
        text: 'Stripe event: {{ $json.body.type }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
