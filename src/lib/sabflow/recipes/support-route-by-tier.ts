/**
 * Recipe: Support ticket → route to queue by customer tier.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-route-by-tier',
  name: 'Support: Route by tier',
  category: 'support',
  description:
    'When a ticket arrives, branch on the customer tier and assign to the right queue.',
  tags: ['support', 'routing', 'tier', 'ticket', 'queue'],
  trigger: {
    id: 't_ticket_in',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_ticket_created',
    options: {
      path: '/webhooks/support/tickets',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_tier', name: 'customer.tier', defaultValue: 'free' },
    { id: 'v_id', name: 'ticket.id', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_branch',
      groupId: 'g_branch',
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
                variableId: 'v_tier',
                operator: 'Equal to',
                value: 'enterprise',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_assign_priority',
      groupId: 'g_enterprise',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets/{{ticket.id}}/assign',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{"queue":"priority"}' },
      },
    },
    {
      id: 'b_assign_default',
      groupId: 'g_default',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets/{{ticket.id}}/assign',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{"queue":"general"}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
