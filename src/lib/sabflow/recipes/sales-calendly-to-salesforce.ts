/**
 * Recipe: Calendly meeting booked → log activity in Salesforce.
 *
 * On `invitee.created` from Calendly, create a Salesforce Task linked
 * to the lead/contact with the meeting details.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'sales-calendly-to-salesforce',
  name: 'Sales: Calendly meeting → Salesforce task',
  category: 'sales',
  description:
    'When a prospect books via Calendly, create a Salesforce Task on the matching Lead with the meeting time, host, and event type.',
  tags: ['calendly', 'salesforce', 'sales', 'meetings', 'logging'],
  trigger: {
    id: 't_calendly_booked',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/calendly/invitee-created',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'Calendly-Webhook-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_invitee_email', name: 'invitee.email', defaultValue: '' },
    { id: 'v_event_name', name: 'event.name', defaultValue: '' },
    { id: 'v_event_start', name: 'event.startTime', defaultValue: '' },
    { id: 'v_host_email', name: 'host.email', defaultValue: '' },
    { id: 'v_lead_id', name: 'salesforce.leadId', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_find_lead',
      groupId: 'g_find',
      type: 'webhook',
      options: {
        url: 'https://your-instance.my.salesforce.com/services/data/v60.0/query?q=SELECT+Id+FROM+Lead+WHERE+Email=%27{{invitee.email}}%27+LIMIT+1',
        method: 'GET',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SF_TOKEN}}' },
        ],
        responseMappings: [
          { id: 'rm1', jsonPath: 'records.0.Id', variableId: 'v_lead_id' },
        ],
      },
    },
    {
      id: 'b_task',
      groupId: 'g_task',
      type: 'webhook',
      options: {
        url: 'https://your-instance.my.salesforce.com/services/data/v60.0/sobjects/Task/',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SF_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"Subject":"Calendly: {{event.name}}","WhoId":"{{salesforce.leadId}}","ActivityDate":"{{event.startTime}}","Description":"Meeting booked with {{host.email}} via Calendly","Status":"Open","Priority":"Normal"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
