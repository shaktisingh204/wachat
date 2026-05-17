/**
 * Recipe: Trial-user drip campaign delivered through Klaviyo.
 *
 * On signup, the user is added to Klaviyo's "Trial Day 0" list. A short wait
 * lets Klaviyo's own flow fire, then we send a "Day 3" check-in email and a
 * "Day 7" pre-expiry nudge directly from SabFlow so the cadence is owned by
 * the workflow even if marketing turns the Klaviyo flow off.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'marketing-trial-drip-klaviyo',
  name: 'Marketing: Trial drip via Klaviyo',
  category: 'marketing',
  description:
    'When a user starts a trial, push them into a Klaviyo list and chase with Day-3 and Day-7 reminder emails before the trial expires.',
  tags: ['marketing', 'drip', 'klaviyo', 'trial', 'email'],
  trigger: {
    id: 't_trial_started',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/trials/started',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'user.email', defaultValue: '' },
    { id: 'v_first', name: 'user.firstName', defaultValue: '' },
    { id: 'v_list', name: 'klaviyo.listId', defaultValue: 'XyZ123' },
    { id: 'v_plan', name: 'trial.plan', defaultValue: 'Pro' },
  ],
  blocks: [
    {
      id: 'b_set_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'user.email', value: '{{ $json.body.email }}' },
    },
    {
      id: 'b_set_name',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'user.firstName', value: '{{ $json.body.first_name }}' },
    },
    {
      id: 'b_klaviyo_subscribe',
      groupId: 'g_klaviyo',
      type: 'webhook',
      options: {
        url: 'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Klaviyo-API-Key {{KLAVIYO_API_KEY}}' },
          { id: 'h2', key: 'revision', value: '2024-10-15' },
          { id: 'h3', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"data":{"type":"profile-subscription-bulk-create-job","attributes":{"profiles":{"data":[{"type":"profile","attributes":{"email":"{{user.email}}","first_name":"{{user.firstName}}","properties":{"trial_plan":"{{trial.plan}}"}}}]}},"relationships":{"list":{"data":{"type":"list","id":"{{klaviyo.listId}}"}}}}}',
        },
      },
    },
    {
      id: 'b_wait_day3',
      groupId: 'g_wait_day3',
      type: 'wait',
      options: { secondsToWaitFor: 3 * 86400, seconds: 3 * 86400 },
    },
    {
      id: 'b_day3_email',
      groupId: 'g_day3',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'Day 3 of your {{trial.plan}} trial — quick wins to try',
        body:
          'Hi {{user.firstName}}, three days in! Most teams set up their first ' +
          'automation by now — here are three templates that take under 5 minutes.',
      },
    },
    {
      id: 'b_wait_day7',
      groupId: 'g_wait_day7',
      type: 'wait',
      options: { secondsToWaitFor: 4 * 86400, seconds: 4 * 86400 },
    },
    {
      id: 'b_day7_email',
      groupId: 'g_day7',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'Your trial ends in 7 days, {{user.firstName}}',
        body:
          'Lock in the launch price for {{trial.plan}} before your trial ends — ' +
          'upgrade now to keep your workflows running without interruption.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
