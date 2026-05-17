/**
 * Recipe: Zendesk ticket tagged "engineering" → Linear issue.
 *
 * When a Zendesk ticket is escalated to engineering, mirror it as a
 * Linear issue under the Support inbox team and back-link both sides.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-zendesk-to-linear',
  name: 'Support: Zendesk → Linear sync',
  category: 'support',
  description:
    'Mirror Zendesk tickets tagged with "engineering" into Linear as new issues under the Support inbox team, with bidirectional URL back-links.',
  tags: ['zendesk', 'linear', 'support', 'escalation', 'sync'],
  trigger: {
    id: 't_zendesk_eng',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'zendesk_ticket_tagged',
    options: {
      path: '/webhooks/zendesk/engineering',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Zendesk-Webhook-Token',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_zd_id', name: 'zendesk.ticketId', defaultValue: '' },
    { id: 'v_zd_url', name: 'zendesk.ticketUrl', defaultValue: '' },
    { id: 'v_subject', name: 'zendesk.subject', defaultValue: '' },
    { id: 'v_description', name: 'zendesk.description', defaultValue: '' },
    { id: 'v_team_id', name: 'linear.teamId', defaultValue: 'TEAM_SUPPORT' },
    { id: 'v_linear_url', name: 'linear.issueUrl', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_create_linear',
      groupId: 'g_linear',
      type: 'webhook',
      options: {
        url: 'https://api.linear.app/graphql',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: '{{LINEAR_API_KEY}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"query":"mutation($input: IssueCreateInput!){ issueCreate(input:$input){ issue{ id url } } }","variables":{"input":{"teamId":"{{linear.teamId}}","title":"[ZD #{{zendesk.ticketId}}] {{zendesk.subject}}","description":"From Zendesk: {{zendesk.ticketUrl}}\\n\\n{{zendesk.description}}"}}}',
        },
        responseVariable: 'linear.issueUrl',
        responseMappings: [
          {
            id: 'rm1',
            jsonPath: 'data.issueCreate.issue.url',
            variableId: 'v_linear_url',
          },
        ],
      },
    },
    {
      id: 'b_backlink_zd',
      groupId: 'g_zendesk',
      type: 'webhook',
      options: {
        url: 'https://example.zendesk.com/api/v2/tickets/{{zendesk.ticketId}}.json',
        method: 'PUT',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Basic {{ZENDESK_BASIC}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"ticket":{"comment":{"body":"Tracked in Linear: {{linear.issueUrl}}","public":false}}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
