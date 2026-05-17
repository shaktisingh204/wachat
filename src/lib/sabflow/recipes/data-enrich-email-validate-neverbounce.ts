/**
 * Recipe: Email validation on signup via NeverBounce → MongoDB.
 *
 * Every new signup gets a NeverBounce verify call. Valid emails are stored
 * in MongoDB as `verified`; risky/invalid ones are flagged so the welcome
 * sequence doesn't burn sender reputation.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'data-enrich-email-validate-neverbounce',
  name: 'Data: Email validation (NeverBounce)',
  category: 'ops',
  description:
    'Run new signups through NeverBounce; record the result in MongoDB and short-circuit nurture sequences when the address is invalid.',
  tags: ['enrichment', 'email-validation', 'neverbounce', 'mongo', 'deliverability'],
  trigger: {
    id: 't_signup',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/signup/validate-email',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'signup.email', defaultValue: '' },
    { id: 'v_user_id', name: 'signup.userId', defaultValue: '' },
    { id: 'v_result', name: 'verify.result', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'signup.email', value: '{{ $json.body.email }}' },
    },
    {
      id: 'b_verify',
      groupId: 'g_verify',
      type: 'webhook',
      options: {
        url: 'https://api.neverbounce.com/v4/single/check?key={{NEVERBOUNCE_KEY}}&email={{signup.email}}',
        method: 'GET',
      },
    },
    {
      id: 'b_capture',
      groupId: 'g_capture',
      type: 'set_variable',
      options: { variableName: 'verify.result', value: '{{ $json.result }}' },
    },
    {
      id: 'b_store',
      groupId: 'g_store',
      type: 'webhook',
      options: {
        url: '/api/internal/mongo/email-verifications',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{INTERNAL_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"userId":"{{signup.userId}}","email":"{{signup.email}}","result":"{{verify.result}}","verifiedAt":"{{ $now }}","flags":{{ $json.flags }}}',
        },
      },
    },
    {
      id: 'b_branch_invalid',
      groupId: 'g_branch',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              { id: 'c1', variableId: 'v_result', operator: 'Equal to', value: 'invalid' },
            ],
          },
        ],
      },
    },
    {
      id: 'b_flag',
      groupId: 'g_flag',
      type: 'webhook',
      options: {
        url: '/api/users/{{signup.userId}}/email-bounce',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{"reason":"neverbounce_invalid"}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
