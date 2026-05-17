/**
 * Recipe: Post-delivery → review request email.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ecommerce-review-request',
  name: 'E-commerce: Review request',
  category: 'ecommerce',
  description:
    'Two days after delivery, ask the customer to leave a product review with a one-click link.',
  tags: ['ecommerce', 'review', 'email', 'post-purchase'],
  trigger: {
    id: 't_delivered',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'order_delivered',
    options: {
      path: '/webhooks/orders/delivered',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_link', name: 'review.link', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_wait',
      groupId: 'g_wait',
      type: 'wait',
      options: { secondsToWaitFor: 2 * 86400, seconds: 2 * 86400 },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'How are you liking it?',
        body: 'Quick favor — could you leave us a review? It only takes 30 seconds: {{review.link}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
