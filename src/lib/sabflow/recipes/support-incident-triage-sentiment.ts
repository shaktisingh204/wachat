/**
 * Recipe: Inbound ticket → AI sentiment triage → priority queue routing.
 *
 * Reads sentiment + urgency from the ticket body via OpenAI, then routes
 * negative/urgent tickets to a priority queue while letting neutral
 * tickets fall through to the normal queue.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-incident-triage-sentiment',
  name: 'Support: Triage by sentiment',
  category: 'support',
  description:
    'Score inbound tickets with OpenAI for sentiment + urgency, then auto-route negative/urgent tickets into a priority queue and tag them in the helpdesk.',
  tags: ['support', 'sentiment', 'triage', 'openai', 'priority'],
  trigger: {
    id: 't_ticket_sentiment',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'support_ticket_created',
    options: {
      path: '/webhooks/support/triage-sentiment',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_ticket_id', name: 'ticket.id', defaultValue: '' },
    { id: 'v_ticket_body', name: 'ticket.body', defaultValue: '' },
    { id: 'v_requester', name: 'ticket.requesterEmail', defaultValue: '' },
    { id: 'v_sentiment', name: 'ticket.sentiment', defaultValue: 'neutral' },
  ],
  blocks: [
    {
      id: 'b_score',
      groupId: 'g_score',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'Return a single JSON object: { "sentiment": "negative"|"neutral"|"positive", "urgency": "low"|"medium"|"high" }. No prose.',
        userMessage: 'Ticket body:\n{{ticket.body}}',
        temperature: 0,
        maxTokens: 60,
        responseVariable: 'ticket.sentiment',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_branch',
      groupId: 'g_branch',
      type: 'condition',
      options: {
        logicalOperator: 'OR',
        conditionGroups: [
          {
            id: 'cg_neg',
            logicalOperator: 'OR',
            comparisons: [
              {
                id: 'c_neg',
                variableId: 'v_sentiment',
                operator: 'Contains',
                value: 'negative',
              },
              {
                id: 'c_high',
                variableId: 'v_sentiment',
                operator: 'Contains',
                value: 'high',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_priority_assign',
      groupId: 'g_priority',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets/{{ticket.id}}/assign',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"queue":"priority","tags":["sentiment:negative"]}',
        },
      },
    },
    {
      id: 'b_alert',
      groupId: 'g_alert',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#support-priority',
        text:
          ':warning: Negative-sentiment ticket #{{ticket.id}} from {{ticket.requesterEmail}} routed to priority queue.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
