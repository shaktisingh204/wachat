/**
 * Recipe: Lead enrichment with Clearbit → HubSpot + Slack alert.
 *
 * When a new contact lands in HubSpot, we look them up in Clearbit's combined
 * person+company API, write the enriched fields back to HubSpot, and ping
 * #sales-signals when the company is above the ICP threshold (>=100 employees).
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'data-enrich-clearbit-hubspot',
  name: 'Data: Clearbit enrichment → HubSpot',
  category: 'crm',
  description:
    'Look up new HubSpot contacts in Clearbit, push the enriched company/title fields back, and alert sales when an ICP-fit prospect lands.',
  tags: ['enrichment', 'clearbit', 'hubspot', 'icp', 'sales'],
  trigger: {
    id: 't_hubspot_created',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/hubspot/contact-created',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'contact.email', defaultValue: '' },
    { id: 'v_hubspot_id', name: 'contact.hubspotId', defaultValue: '' },
    { id: 'v_icp_min', name: 'icp.minEmployees', defaultValue: '100' },
  ],
  blocks: [
    {
      id: 'b_extract',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'contact.email', value: '{{ $json.body.properties.email.value }}' },
    },
    {
      id: 'b_clearbit',
      groupId: 'g_clearbit',
      type: 'webhook',
      options: {
        url: 'https://person-stream.clearbit.com/v2/combined/find?email={{contact.email}}',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{CLEARBIT_KEY}}' }],
      },
    },
    {
      id: 'b_write_back',
      groupId: 'g_write',
      type: 'webhook',
      options: {
        url: 'https://api.hubapi.com/crm/v3/objects/contacts/{{contact.hubspotId}}',
        method: 'PATCH',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{HUBSPOT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"properties":{"jobtitle":"{{ $json.person.employment.title }}","company":"{{ $json.company.name }}","numemployees":"{{ $json.company.metrics.employees }}","industry":"{{ $json.company.category.industry }}","linkedinbio":"{{ $json.person.linkedin.handle }}"}}',
        },
      },
    },
    {
      id: 'b_icp_check',
      groupId: 'g_icp',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              {
                id: 'c1',
                variableId: 'v_icp_min',
                operator: 'Greater than or equal',
                value: '{{ $json.company.metrics.employees }}',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#sales-signals',
        text:
          ':dart: ICP hit — *{{ $json.person.name.fullName }}* ({{ $json.person.employment.title }}) ' +
          'at *{{ $json.company.name }}* ({{ $json.company.metrics.employees }} employees) just signed up. ' +
          'HubSpot: {{contact.hubspotId}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
