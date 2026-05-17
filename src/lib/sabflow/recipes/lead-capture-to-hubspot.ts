/**
 * Recipe: Lead capture form → HubSpot contact.
 *
 * A public web form posts to a webhook; we drop the lead into HubSpot via the
 * CRM v3 contacts API and reply to the visitor with a confirmation.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'lead-capture-to-hubspot',
  name: 'Lead capture → HubSpot',
  category: 'crm',
  description:
    'Receive a lead from a public form via webhook, create the contact in HubSpot, and confirm the capture.',
  tags: ['lead', 'hubspot', 'crm', 'capture', 'form'],
  trigger: {
    id: 't_lead_form',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/leads/inbound',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'lead.email', defaultValue: '' },
    { id: 'v_first', name: 'lead.firstName', defaultValue: '' },
    { id: 'v_last', name: 'lead.lastName', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_normalize',
      groupId: 'g_prep',
      type: 'set_variable',
      options: {
        variableName: 'lead.email',
        value: '{{ $json.body.email }}',
      },
    },
    {
      id: 'b_hubspot',
      groupId: 'g_hubspot',
      type: 'webhook',
      options: {
        url: 'https://api.hubapi.com/crm/v3/objects/contacts',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{HUBSPOT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"properties":{"email":"{{lead.email}}","firstname":"{{lead.firstName}}","lastname":"{{lead.lastName}}"}}',
        },
      },
    },
    {
      id: 'b_thanks',
      groupId: 'g_thanks',
      type: 'text',
      options: { content: 'Thanks {{lead.firstName}} — we just added you to our CRM.' },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
