/**
 * Recipe: Weekly on-call hand-off reminder.
 *
 * Every Monday at 09:00, fetches the active on-call engineer from the
 * scheduling API and posts the rotation roster to the #oncall channel
 * plus an SMS to the new primary.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-oncall-rotation-reminder',
  name: 'Support: On-call rotation reminder',
  category: 'support',
  description:
    'Every Monday at 09:00, fetch the current on-call schedule, post the roster to Slack, and SMS the new primary engineer with their shift window.',
  tags: ['oncall', 'rotation', 'support', 'slack', 'reminder'],
  trigger: {
    id: 't_oncall_weekly',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_weekly',
    options: {
      cronExpression: '0 9 * * 1',
      timezone: 'America/Los_Angeles',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_primary_name', name: 'oncall.primaryName', defaultValue: '' },
    { id: 'v_primary_phone', name: 'oncall.primaryPhone', defaultValue: '' },
    { id: 'v_secondary_name', name: 'oncall.secondaryName', defaultValue: '' },
    { id: 'v_shift_window', name: 'oncall.shiftWindow', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: 'https://api.pagerduty.com/oncalls?escalation_policy_ids[]=PESC123&earliest=true',
        method: 'GET',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Token token={{PAGERDUTY_TOKEN}}' },
          { id: 'h2', key: 'Accept', value: 'application/vnd.pagerduty+json;version=2' },
        ],
        responseMappings: [
          { id: 'rm1', jsonPath: 'oncalls.0.user.summary', variableId: 'v_primary_name' },
          { id: 'rm2', jsonPath: 'oncalls.0.user.phone', variableId: 'v_primary_phone' },
          { id: 'rm3', jsonPath: 'oncalls.1.user.summary', variableId: 'v_secondary_name' },
          { id: 'rm4', jsonPath: 'oncalls.0.end', variableId: 'v_shift_window' },
        ],
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#oncall',
        text:
          ':alarm_clock: This week\'s on-call rotation:\n• *Primary:* {{oncall.primaryName}}\n• *Secondary:* {{oncall.secondaryName}}\n• *Shift ends:* {{oncall.shiftWindow}}',
      },
    },
    {
      id: 'b_sms',
      groupId: 'g_sms',
      type: 'forge_twilio',
      options: {
        action: 'sms_send',
        to: '{{oncall.primaryPhone}}',
        body: 'You\'re primary on-call this week (ends {{oncall.shiftWindow}}). Slack channel #oncall.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
