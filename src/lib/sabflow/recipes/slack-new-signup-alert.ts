/**
 * Recipe: New user signup → Slack notification.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'slack-new-signup-alert',
  name: 'Slack alert: New signup',
  category: 'ops',
  description:
    'Receive a webhook when a new user signs up and announce it to a Slack channel.',
  tags: ['slack', 'signup', 'alert', 'ops'],
  trigger: {
    id: 't_signup',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/users/signup',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#signups' },
    { id: 'v_email', name: 'user.email', defaultValue: '' },
    { id: 'v_plan', name: 'user.plan', defaultValue: 'free' },
  ],
  blocks: [
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text: ':wave: New signup: *{{user.email}}* on the *{{user.plan}}* plan.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
