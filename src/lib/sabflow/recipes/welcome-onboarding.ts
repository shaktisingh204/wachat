/**
 * Recipe: New contact → 5-step drip sequence over 7 days.
 *
 * The trigger fires when a contact is added.  Days 0/1/3/5/7 each send a
 * scheduled email tailored to a stage of the onboarding journey.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const DAY = 24 * 3600;

const recipe: Recipe = {
  id: 'welcome-onboarding',
  name: 'Welcome Onboarding (5-step drip)',
  category: 'onboarding',
  description:
    '5-message email drip over a week — sent on day 0, 1, 3, 5 and 7 ' +
    'after the contact joins.  Increases activation without manual work.',
  tags: ['onboarding', 'drip', 'email', 'sequence', 'welcome'],
  trigger: {
    id: 't_contact_created',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'crm_contact_created',
    options: {
      path: '/webhooks/crm/contact-created',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'contact.email', defaultValue: '' },
    { id: 'v_first_name', name: 'contact.firstName', defaultValue: '' },
  ],
  blocks: [
    // Day 0 — welcome email (immediate)
    {
      id: 'b_email_0',
      groupId: 'g_day0',
      type: 'send_email',
      options: {
        to: '{{contact.email}}',
        subject: 'Welcome aboard, {{contact.firstName}}!',
        body:
          'Hi {{contact.firstName}}, glad to have you. Here\'s how to get ' +
          'the most out of your first day...',
      },
    },
    // Day 1 — wait 1 day, send tip #1
    {
      id: 'b_wait_1',
      groupId: 'g_day1_wait',
      type: 'wait',
      options: { secondsToWaitFor: DAY, seconds: DAY },
    },
    {
      id: 'b_email_1',
      groupId: 'g_day1_send',
      type: 'send_email',
      options: {
        to: '{{contact.email}}',
        subject: 'Tip #1: your first integration',
        body: 'Connect your first tool in under 60 seconds...',
      },
    },
    // Day 3 — wait 2 more days, send case-study
    {
      id: 'b_wait_2',
      groupId: 'g_day3_wait',
      type: 'wait',
      options: { secondsToWaitFor: 2 * DAY, seconds: 2 * DAY },
    },
    {
      id: 'b_email_3',
      groupId: 'g_day3_send',
      type: 'send_email',
      options: {
        to: '{{contact.email}}',
        subject: 'How Acme Co saved 12 hours/week',
        body: 'Real customers share their results...',
      },
    },
    // Day 5 — wait 2 more days, send feature tour
    {
      id: 'b_wait_3',
      groupId: 'g_day5_wait',
      type: 'wait',
      options: { secondsToWaitFor: 2 * DAY, seconds: 2 * DAY },
    },
    {
      id: 'b_email_5',
      groupId: 'g_day5_send',
      type: 'send_email',
      options: {
        to: '{{contact.email}}',
        subject: 'Five features you haven\'t tried yet',
        body: 'Power-user toolkit unlocked...',
      },
    },
    // Day 7 — wait 2 more days, send upgrade nudge
    {
      id: 'b_wait_4',
      groupId: 'g_day7_wait',
      type: 'wait',
      options: { secondsToWaitFor: 2 * DAY, seconds: 2 * DAY },
    },
    {
      id: 'b_email_7',
      groupId: 'g_day7_send',
      type: 'send_email',
      options: {
        to: '{{contact.email}}',
        subject: 'Ready to upgrade, {{contact.firstName}}?',
        body: 'Your trial unlocks more on the Pro plan...',
      },
    },
  ],
};

registerRecipe(recipe);

export default recipe;
