/**
 * Recipe: Free-trial nudge email (day 3 + day 10).
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'email-sequence-trial-nudge',
  name: 'Email drip: Free trial nudge',
  category: 'marketing',
  description:
    'After someone starts a free trial, send a day-3 check-in and a day-10 conversion nudge.',
  tags: ['email', 'trial', 'sequence', 'nudge', 'sales'],
  trigger: {
    id: 't_trial_started',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'trial_started',
    options: {
      path: '/webhooks/trial/started',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'user.email', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_wait1',
      groupId: 'g_wait1',
      type: 'wait',
      options: { secondsToWaitFor: 3 * 86400, seconds: 3 * 86400 },
    },
    {
      id: 'b_email1',
      groupId: 'g_email1',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'How\'s the trial going?',
        body: 'Just checking in — anything we can help with?',
      },
    },
    {
      id: 'b_wait2',
      groupId: 'g_wait2',
      type: 'wait',
      options: { secondsToWaitFor: 7 * 86400, seconds: 7 * 86400 },
    },
    {
      id: 'b_email2',
      groupId: 'g_email2',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'Your trial expires soon',
        body: 'Day 14 is around the corner. Lock in our launch price now — link inside.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
