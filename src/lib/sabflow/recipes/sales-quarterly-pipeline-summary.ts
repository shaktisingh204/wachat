/**
 * Recipe: Quarterly pipeline summary → executive email.
 *
 * On the first Monday of each quarter at 07:00, queries the CRM for
 * stage-bucketed pipeline totals, asks OpenAI to summarise trends, and
 * emails the leadership distribution list.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'sales-quarterly-pipeline-summary',
  name: 'Sales: Quarterly pipeline summary email',
  category: 'sales',
  description:
    'First Monday of each quarter, fetch pipeline totals by stage, ask OpenAI for a 200-word executive summary, and email leadership.',
  tags: ['sales', 'pipeline', 'quarterly', 'email', 'leadership'],
  trigger: {
    id: 't_quarterly',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_monthly',
    options: {
      // First Monday Jan/Apr/Jul/Oct at 07:00
      cronExpression: '0 7 1-7 1,4,7,10 1',
      timezone: 'America/New_York',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_pipeline_json', name: 'pipeline.json', defaultValue: '{}' },
    { id: 'v_summary', name: 'pipeline.summary', defaultValue: '' },
    {
      id: 'v_recipients',
      name: 'recipients',
      defaultValue: 'leadership@example.com',
    },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '/api/crm/pipeline/summary?bucketBy=stage',
        method: 'GET',
        responseVariable: 'v_pipeline_json',
        responseMappings: [
          { id: 'rm1', jsonPath: '$', variableId: 'v_pipeline_json' },
        ],
      },
    },
    {
      id: 'b_summarise',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'You are a sales-ops analyst. Produce a 200-word executive summary of the JSON below: highlight pipeline coverage, biggest movers, and risk areas. Plain text, no markdown.',
        userMessage: 'Pipeline data:\n{{pipeline.json}}',
        temperature: 0.3,
        maxTokens: 400,
        responseVariable: 'pipeline.summary',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{recipients}}',
        subject: 'Quarterly pipeline summary',
        bodyType: 'html',
        body:
          '<h2>Quarterly pipeline summary</h2>' +
          '<p>{{pipeline.summary}}</p>' +
          '<hr><pre>{{pipeline.json}}</pre>',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
