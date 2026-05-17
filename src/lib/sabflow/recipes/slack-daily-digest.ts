/**
 * Recipe: Daily metrics digest → Slack channel.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'slack-daily-digest',
  name: 'Slack: Daily digest',
  category: 'ops',
  description:
    'Every morning, pull yesterday\'s metrics from your reporting endpoint and post the summary to Slack.',
  tags: ['slack', 'digest', 'daily', 'metrics', 'schedule'],
  trigger: {
    id: 't_morning',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 9 * * *' },
  },
  variables: [
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#daily-digest' },
    { id: 'v_metrics_url', name: 'metricsUrl', defaultValue: 'https://api.example.com/metrics/daily' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '{{metricsUrl}}',
        method: 'GET',
      },
    },
    {
      id: 'b_post',
      groupId: 'g_post',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text:
          ':chart_with_upwards_trend: Daily digest — {{ $json.signups }} signups, {{ $json.revenue }} revenue.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
