/**
 * Recipe: NPS score submission → branched follow-up.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'form-processing-nps',
  name: 'Form: NPS routing',
  category: 'support',
  description:
    'When an NPS score arrives, route promoters to a referral ask and detractors to a CSM.',
  tags: ['form', 'nps', 'support', 'feedback', 'routing'],
  trigger: {
    id: 't_nps',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/nps',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'user.email', defaultValue: '' },
    { id: 'v_score', name: 'score', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set',
      groupId: 'g_setup',
      type: 'set_variable',
      options: { variableName: 'score', value: '{{ $json.body.score }}' },
    },
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
                variableId: 'v_score',
                operator: 'Greater than or equal to',
                value: '9',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_promoter',
      groupId: 'g_promoter',
      type: 'send_email',
      options: {
        to: '{{user.email}}',
        subject: 'Could you share us with a friend?',
        body: 'Glad you\'re a fan — here\'s our referral link.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
