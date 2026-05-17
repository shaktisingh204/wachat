/**
 * Recipe: Deal won → Slack channel notification.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'slack-deal-won-alert',
  name: 'Slack alert: Deal won',
  category: 'sales',
  description:
    'When a deal moves to "Won" in the CRM, post a celebratory message to a Slack channel.',
  tags: ['slack', 'sales', 'deal', 'alert', 'crm'],
  trigger: {
    id: 't_deal_won',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'crm_deal_won',
    options: {
      path: '/webhooks/crm/deal-won',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#sales-wins' },
    { id: 'v_deal_name', name: 'deal.name', defaultValue: '' },
    { id: 'v_deal_value', name: 'deal.value', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text: ':tada: Deal won — *{{deal.name}}* for {{deal.value}}!',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
