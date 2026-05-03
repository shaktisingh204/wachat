/**
 * Recipe: Daily ad-spend monitor → Slack alert.
 *
 * Schedule fires once per day at 09:00.  The flow pulls the previous day's
 * spend from the ads platform via a webhook block, compares against a
 * threshold variable, and posts a Slack notification when exceeded.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ad-spend-alert',
  name: 'Ad Spend Alert',
  category: 'ads',
  description:
    'Once a day, check yesterday\'s ad spend.  If it exceeds your ' +
    'threshold, ping the marketing channel on Slack.',
  tags: ['ads', 'slack', 'alert', 'spend', 'monitoring'],
  trigger: {
    id: 't_daily_check',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_daily',
    options: {
      cronExpression: '0 9 * * *',
      timezone: 'UTC',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_spend', name: 'ads.spend', defaultValue: '0' },
    { id: 'v_threshold', name: 'spend.threshold', defaultValue: '500' },
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#marketing' },
  ],
  blocks: [
    // Step 1 — fetch ad spend from the ads platform
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: 'https://api.example.com/ads/spend?date=yesterday',
        method: 'GET',
        responseVariable: 'v_spend',
        responseMappings: [
          { id: 'rm_spend', jsonPath: 'totalSpend', variableId: 'v_spend' },
        ],
      },
    },
    // Step 2 — compare spend > threshold
    {
      id: 'b_compare',
      groupId: 'g_compare',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg_1',
            logicalOperator: 'AND',
            comparisons: [
              {
                id: 'cmp_1',
                variableId: 'v_spend',
                operator: 'Greater than',
                value: '{{spend.threshold}}',
              },
            ],
          },
        ],
      },
      items: [
        { id: 'cg_1', content: 'AND' },
      ],
    },
    // Step 3 — Slack alert
    {
      id: 'b_slack',
      groupId: 'g_alert',
      type: 'forge_slack',
      options: {
        action: 'message_send',
        channel: '{{slack.channel}}',
        text:
          ':rotating_light: Ad spend alert: yesterday spent ' +
          '${{ads.spend}} (threshold ${{spend.threshold}}).',
      },
    },
  ],
};

registerRecipe(recipe);

export default recipe;
