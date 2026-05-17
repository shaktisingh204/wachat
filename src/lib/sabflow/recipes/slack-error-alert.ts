/**
 * Recipe: Error webhook → Slack incident channel.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'slack-error-alert',
  name: 'Slack alert: Error / incident',
  category: 'ops',
  description:
    'Pipe error-reporting webhooks (Sentry, Cloudwatch, etc.) into a Slack incident channel.',
  tags: ['slack', 'error', 'alert', 'incident', 'ops'],
  trigger: {
    id: 't_error',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/alerts/error',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#incidents' },
    { id: 'v_service', name: 'service', defaultValue: 'api' },
  ],
  blocks: [
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text:
          ':rotating_light: *{{service}}* error — {{ $json.body.message }}\n```{{ $json.body.stack }}```',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
