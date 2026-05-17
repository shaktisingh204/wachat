/**
 * Recipe: Support ticket → AI categorisation + auto-tagging.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-ai-triage',
  name: 'Support: AI triage',
  category: 'support',
  description:
    'Ask OpenAI to read an inbound ticket body, return a category + urgency label, and tag the ticket.',
  tags: ['support', 'ai', 'openai', 'triage', 'tagging'],
  trigger: {
    id: 't_ticket',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_ticket_created',
    options: {
      path: '/webhooks/support/triage',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_id', name: 'ticket.id', defaultValue: '' },
    { id: 'v_body', name: 'ticket.body', defaultValue: '' },
    { id: 'v_tags', name: 'tags', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_ai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'You return a single JSON object: { "category": ..., "urgency": "low"|"medium"|"high" }',
        userMessage: 'Ticket body:\n{{ticket.body}}',
        temperature: 0,
        maxTokens: 80,
        responseVariable: 'tags',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_apply',
      groupId: 'g_apply',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets/{{ticket.id}}/tags',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{{tags}}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
