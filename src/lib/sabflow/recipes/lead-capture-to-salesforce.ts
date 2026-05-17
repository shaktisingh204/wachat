/**
 * Recipe: Lead capture → Salesforce Lead object.
 *
 * Webhook receives a fresh lead and writes it to Salesforce via the REST API.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'lead-capture-to-salesforce',
  name: 'Lead capture → Salesforce',
  category: 'crm',
  description:
    'Capture an inbound lead from a webhook, create a Lead in Salesforce via REST.',
  tags: ['lead', 'salesforce', 'crm', 'capture'],
  trigger: {
    id: 't_sf_lead',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/leads/salesforce',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_instance', name: 'sf.instance', defaultValue: 'my.my.salesforce.com' },
    { id: 'v_email', name: 'lead.email', defaultValue: '' },
    { id: 'v_company', name: 'lead.company', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_setup',
      groupId: 'g_setup',
      type: 'set_variable',
      options: {
        variableName: 'lead.email',
        value: '{{ $json.body.email }}',
      },
    },
    {
      id: 'b_create',
      groupId: 'g_create',
      type: 'webhook',
      options: {
        url: 'https://{{sf.instance}}/services/data/v60.0/sobjects/Lead',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SF_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"Email":"{{lead.email}}","Company":"{{lead.company}}","LastName":"{{ $json.body.lastName }}"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
