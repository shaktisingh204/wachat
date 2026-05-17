/**
 * Recipe: 3-step welcome email drip sequence.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'email-sequence-drip-3step',
  name: 'Email drip: 3-step welcome',
  category: 'marketing',
  description:
    'Send three emails over a week — a welcome, a feature highlight, and a "did you know" tip.',
  tags: ['email', 'drip', 'sequence', 'welcome', 'marketing'],
  trigger: {
    id: 't_subscribed',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'user_subscribed',
    options: {
      path: '/webhooks/subscribers/new',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'user.email', defaultValue: '' },
    { id: 'v_name', name: 'user.name', defaultValue: 'there' },
  ],
  blocks: [
    {
      id: 'b_email1',
      groupId: 'g_step1',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'Welcome to the family, {{user.name}}',
        body: 'Hi {{user.name}}, thanks for joining! Here\'s what to do next…',
      },
    },
    {
      id: 'b_wait1',
      groupId: 'g_wait1',
      type: 'wait',
      options: { secondsToWaitFor: 2 * 86400, seconds: 2 * 86400 },
    },
    {
      id: 'b_email2',
      groupId: 'g_step2',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'A favourite feature for you',
        body: 'Hi {{user.name}}, let me show you our most-loved feature…',
      },
    },
    {
      id: 'b_wait2',
      groupId: 'g_wait2',
      type: 'wait',
      options: { secondsToWaitFor: 4 * 86400, seconds: 4 * 86400 },
    },
    {
      id: 'b_email3',
      groupId: 'g_step3',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'A tip most users miss',
        body: 'Hi {{user.name}}, a power-user tip — did you know…',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
