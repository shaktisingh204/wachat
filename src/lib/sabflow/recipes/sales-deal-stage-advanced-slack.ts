/**
 * Recipe: CRM deal stage advanced → ping the deal's AE on Slack.
 *
 * When a deal moves to a new stage in the CRM, post a deep-link card
 * to the AE's Slack DM with stage, amount and a one-click "open in CRM"
 * link.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'sales-deal-stage-advanced-slack',
  name: 'Sales: Deal stage advanced → notify AE',
  category: 'sales',
  description:
    'When a CRM deal advances stages, send a Slack DM to the assigned AE with the deal name, new stage, amount and a "open in CRM" deep link.',
  tags: ['sales', 'slack', 'deal', 'pipeline', 'crm'],
  trigger: {
    id: 't_deal_stage_changed',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'crm_deal_stage_changed',
    options: {
      path: '/webhooks/crm/deal-stage-changed',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_deal_id', name: 'deal.id', defaultValue: '' },
    { id: 'v_deal_name', name: 'deal.name', defaultValue: '' },
    { id: 'v_stage', name: 'deal.stage', defaultValue: '' },
    { id: 'v_amount', name: 'deal.amount', defaultValue: '0' },
    { id: 'v_ae_slack', name: 'ae.slackUserId', defaultValue: '' },
    { id: 'v_crm_url', name: 'deal.crmUrl', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_slack_dm',
      groupId: 'g_dm',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{ae.slackUserId}}',
        text:
          ':rocket: Your deal *{{deal.name}}* moved to *{{deal.stage}}* (${{deal.amount}}).\nOpen in CRM: {{deal.crmUrl}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
