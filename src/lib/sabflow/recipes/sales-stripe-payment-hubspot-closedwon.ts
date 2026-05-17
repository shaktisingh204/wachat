/**
 * Recipe: Stripe payment succeeded → mark HubSpot deal closed-won.
 *
 * Stripe's `checkout.session.completed` webhook arrives; we look up the
 * deal by email in HubSpot, PATCH it to `closedwon`, and write the
 * gross amount as the deal value.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'sales-stripe-payment-hubspot-closedwon',
  name: 'Sales: Stripe paid → HubSpot closedwon',
  category: 'sales',
  description:
    'On Stripe `checkout.session.completed`, find the HubSpot deal for that customer email and update the stage to `closedwon` with the gross payment amount.',
  tags: ['stripe', 'hubspot', 'sales', 'deal', 'payment'],
  trigger: {
    id: 't_stripe_paid',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'payment_succeeded',
    options: {
      path: '/webhooks/stripe/checkout-completed',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'Stripe-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_amount', name: 'payment.amount', defaultValue: '0' },
    { id: 'v_currency', name: 'payment.currency', defaultValue: 'USD' },
    { id: 'v_deal_id', name: 'hubspot.dealId', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_find',
      groupId: 'g_find',
      type: 'webhook',
      options: {
        url: 'https://api.hubapi.com/crm/v3/objects/deals/search',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{HUBSPOT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"filterGroups":[{"filters":[{"propertyName":"associated_contact_email","operator":"EQ","value":"{{customer.email}}"}]}],"limit":1}',
        },
        responseMappings: [
          { id: 'rm1', jsonPath: 'results.0.id', variableId: 'v_deal_id' },
        ],
      },
    },
    {
      id: 'b_update',
      groupId: 'g_update',
      type: 'webhook',
      options: {
        url: 'https://api.hubapi.com/crm/v3/objects/deals/{{hubspot.dealId}}',
        method: 'PATCH',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{HUBSPOT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"properties":{"dealstage":"closedwon","amount":"{{payment.amount}}","deal_currency_code":"{{payment.currency}}"}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
