/**
 * Recipe: Lead capture → Pipedrive person + deal.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'lead-capture-to-pipedrive',
  name: 'Lead capture → Pipedrive',
  category: 'crm',
  description:
    'Create a Pipedrive Person from a webhook payload, then attach a starter Deal.',
  tags: ['lead', 'pipedrive', 'crm', 'capture', 'deal'],
  trigger: {
    id: 't_pd_lead',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/leads/pipedrive',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_token', name: 'pd.apiToken', defaultValue: '' },
    { id: 'v_name', name: 'lead.name', defaultValue: '' },
    { id: 'v_email', name: 'lead.email', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_person',
      groupId: 'g_person',
      type: 'webhook',
      options: {
        url: 'https://api.pipedrive.com/v1/persons?api_token={{pd.apiToken}}',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"name":"{{lead.name}}","email":"{{lead.email}}"}',
        },
      },
    },
    {
      id: 'b_deal',
      groupId: 'g_deal',
      type: 'webhook',
      options: {
        url: 'https://api.pipedrive.com/v1/deals?api_token={{pd.apiToken}}',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"title":"New lead: {{lead.name}}","value":0,"currency":"USD"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
