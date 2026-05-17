/**
 * Recipe: 90-day inactivity re-engagement campaign.
 *
 * Runs nightly. Pulls users whose `last_active_at` is older than 90 days from
 * the internal CDP, sends a 2-email "we miss you" sequence, and tags anyone
 * who clicks back into Mixpanel as `reactivated`.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'marketing-reengage-90day',
  name: 'Marketing: 90-day inactive re-engagement',
  category: 'marketing',
  description:
    'Nightly cron looks for users dormant 90+ days, sends a two-step "we miss you" sequence, and tracks who re-activates.',
  tags: ['marketing', 'reengagement', 'churn', 'mixpanel', 'cron'],
  trigger: {
    id: 't_nightly',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 9 * * *' },
  },
  variables: [
    { id: 'v_segment', name: 'segment.url', defaultValue: '/api/internal/users/dormant?days=90' },
    { id: 'v_user_email', name: 'user.email', defaultValue: '' },
    { id: 'v_user_first', name: 'user.firstName', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_pull',
      groupId: 'g_pull',
      type: 'webhook',
      options: {
        url: '{{segment.url}}',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{INTERNAL_TOKEN}}' }],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.users }}', itemVariable: 'user' },
    },
    {
      id: 'b_email1',
      groupId: 'g_email1',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'It\'s been 3 months, {{user.firstName}} — we miss you',
        body:
          'A lot has shipped since we last saw you. Here\'s a 30-second recap ' +
          'of the new features your account already has access to.',
      },
    },
    {
      id: 'b_wait_3d',
      groupId: 'g_wait_3d',
      type: 'wait',
      options: { secondsToWaitFor: 3 * 86400, seconds: 3 * 86400 },
    },
    {
      id: 'b_email2',
      groupId: 'g_email2',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'One click to pick up where you left off',
        body:
          'Your data is still here, ready to go. Log back in with this magic ' +
          'link — no password needed.',
      },
    },
    {
      id: 'b_mixpanel_tag',
      groupId: 'g_mixpanel',
      type: 'webhook',
      options: {
        url: 'https://api.mixpanel.com/track',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"event":"reengagement_sequence_sent","properties":{"token":"{{MIXPANEL_TOKEN}}","distinct_id":"{{user.email}}","days_inactive":90}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
