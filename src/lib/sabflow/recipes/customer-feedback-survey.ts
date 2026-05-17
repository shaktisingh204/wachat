/**
 * Recipe: Customer feedback survey.
 *
 * Three-question survey (NPS rating + free-text comment + email).  Result
 * is posted to a webhook for storage in your data warehouse, and emailed
 * to the operator when the NPS is a detractor (≤ 6) so they can act fast.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'customer-feedback-survey',
  name: 'Customer feedback survey',
  category: 'support',
  description:
    'NPS rating + comment + email, with low-score alerts routed to your team email.',
  tags: ['nps', 'survey', 'feedback', 'support'],
  trigger: {
    id: 't_start',
    type: 'start',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'flow_started',
  },
  variables: [
    { id: 'v_nps', name: 'nps', defaultValue: '' },
    { id: 'v_comment', name: 'comment', defaultValue: '' },
    { id: 'v_email', name: 'email', defaultValue: '' },
    { id: 'v_ops_email', name: 'opsEmail', defaultValue: 'ops@example.com' },
    { id: 'v_warehouse_url', name: 'warehouseUrl', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_intro',
      groupId: 'g_intro',
      type: 'text',
      options: { content: "Quick favour — three short questions. 90 seconds, promise." },
    },
    {
      id: 'b_rating',
      groupId: 'g_questions',
      type: 'rating_input',
      options: {
        length: 11,
        buttonType: 'Numbers',
        startsAt: 0,
        labels: { left: 'Not at all', right: 'Definitely', button: 'Submit' },
        variableId: 'v_nps',
      },
    },
    {
      id: 'b_comment',
      groupId: 'g_questions',
      type: 'text_input',
      options: {
        placeholder: 'Anything you want to add?',
        isLong: true,
        variableId: 'v_comment',
      },
    },
    {
      id: 'b_email',
      groupId: 'g_questions',
      type: 'email_input',
      options: {
        placeholder: 'your@email.com',
        variableId: 'v_email',
      },
    },
    {
      id: 'b_persist',
      groupId: 'g_persist',
      type: 'webhook',
      options: {
        url: '{{warehouseUrl}}',
        method: 'POST',
        body: {
          type: 'json',
          content: '{"nps":{{nps}},"comment":"{{comment}}","email":"{{email}}"}',
        },
      },
    },
    {
      id: 'b_alert',
      groupId: 'g_alert',
      type: 'send_email',
      options: {
        to: '{{opsEmail}}',
        subject: 'Detractor NPS — {{nps}}/10 from {{email}}',
        body:
          'A user just rated {{nps}}/10.\\n\\nComment:\\n{{comment}}\\n\\nReply-to: {{email}}',
      },
    },
    {
      id: 'b_thanks',
      groupId: 'g_done',
      type: 'text',
      options: { content: 'Thanks — every reply makes the product better 💛' },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
