/**
 * Recipe: Shopify customers → HubSpot contacts.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'db-sync-shopify-to-hubspot',
  name: 'DB sync: Shopify → HubSpot',
  category: 'crm',
  description:
    'On a webhook from Shopify customer/create, mirror the customer into HubSpot CRM as a contact.',
  tags: ['sync', 'shopify', 'hubspot', 'crm', 'ecommerce'],
  trigger: {
    id: 't_shopify_customer',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/shopify/customer-created',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
  ],
  blocks: [
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
            '{"properties":{"email":"{{ $json.body.email }}","firstname":"{{ $json.body.first_name }}","lastname":"{{ $json.body.last_name }}","lifecyclestage":"customer"}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
