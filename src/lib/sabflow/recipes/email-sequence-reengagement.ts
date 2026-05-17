/**
 * Recipe: Re-engagement email for dormant users.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'email-sequence-reengagement',
  name: 'Email: Dormant user re-engagement',
  category: 'marketing',
  description:
    'On a webhook firing for dormant users (30 days inactive), send a "we miss you" message with a return CTA.',
  tags: ['email', 'reengagement', 'dormant', 'churn', 'marketing'],
  trigger: {
    id: 't_dormant',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'user_dormant',
    options: {
      path: '/webhooks/users/dormant',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'user.email', defaultValue: '' },
    { id: 'v_offer', name: 'offer.code', defaultValue: 'COMEBACK20' },
  ],
  blocks: [
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'We miss you',
        body: 'It\'s been a while — here\'s 20% off ({{offer.code}}) to welcome you back.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
