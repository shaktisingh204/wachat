/**
 * Recipe: CSAT score drops below 3.5 → customer-success alert + ticket.
 *
 * Fires on the helpdesk's CSAT-recorded webhook. If the rating is below
 * the configured threshold, opens a CS follow-up ticket and pings the
 * customer-health Slack channel.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-csat-health-alert',
  name: 'Support: Customer health alert (low CSAT)',
  category: 'support',
  description:
    'When a CSAT response comes in below the configured threshold (default 3.5), open a customer-success follow-up ticket and alert the #customer-health channel.',
  tags: ['support', 'csat', 'health', 'churn', 'customer-success'],
  trigger: {
    id: 't_csat_recorded',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_csat_recorded',
    options: {
      path: '/webhooks/support/csat',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_rating', name: 'csat.rating', defaultValue: '0' },
    { id: 'v_threshold', name: 'csat.threshold', defaultValue: '3.5' },
    { id: 'v_account_id', name: 'account.id', defaultValue: '' },
    { id: 'v_email', name: 'requester.email', defaultValue: '' },
    { id: 'v_comment', name: 'csat.comment', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_check',
      groupId: 'g_check',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              {
                id: 'c1',
                variableId: 'v_rating',
                operator: 'Less than',
                value: '{{csat.threshold}}',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_open_cs_ticket',
      groupId: 'g_open_ticket',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"accountId":"{{account.id}}","subject":"Low CSAT from {{requester.email}} — please follow up","priority":"high","queue":"customer-success","body":"Rating: {{csat.rating}}/5 — \\"{{csat.comment}}\\""}',
        },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#customer-health',
        text:
          ':chart_with_downwards_trend: Low CSAT from *{{requester.email}}* (account {{account.id}}): {{csat.rating}}/5 — "{{csat.comment}}"',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
