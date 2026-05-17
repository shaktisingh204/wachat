/**
 * Recipe: Sentry error-spike alert → create a Jira bug.
 *
 * Sentry posts to the webhook when an issue's event rate spikes. We
 * file a Jira bug in the BUG project with the stacktrace + Sentry URL
 * and reply to Sentry with the ticket id.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'devops-sentry-spike-to-jira',
  name: 'DevOps: Sentry spike → Jira bug',
  category: 'ops',
  description:
    'When Sentry reports an error-rate spike, open a Jira bug in the BUG project with stacktrace + Sentry permalink and back-comment Sentry with the ticket id.',
  tags: ['sentry', 'jira', 'devops', 'errors', 'spike'],
  trigger: {
    id: 't_sentry_spike',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/sentry/spike',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Sentry-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_issue_id', name: 'sentry.issueId', defaultValue: '' },
    { id: 'v_title', name: 'sentry.title', defaultValue: '' },
    { id: 'v_stack', name: 'sentry.stack', defaultValue: '' },
    { id: 'v_url', name: 'sentry.url', defaultValue: '' },
    { id: 'v_jira_key', name: 'jira.issueKey', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_jira_create',
      groupId: 'g_jira',
      type: 'webhook',
      options: {
        url: 'https://your-org.atlassian.net/rest/api/3/issue',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Basic {{JIRA_BASIC}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"fields":{"project":{"key":"BUG"},"issuetype":{"name":"Bug"},"summary":"[Sentry] {{sentry.title}}","description":"Sentry: {{sentry.url}}\\n\\n```\\n{{sentry.stack}}\\n```","labels":["sentry","auto-filed"]}}',
        },
        responseVariable: 'jira.issueKey',
        responseMappings: [
          { id: 'rm1', jsonPath: 'key', variableId: 'v_jira_key' },
        ],
      },
    },
    {
      id: 'b_sentry_comment',
      groupId: 'g_sentry',
      type: 'webhook',
      options: {
        url: 'https://sentry.io/api/0/issues/{{sentry.issueId}}/comments/',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SENTRY_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content: '{"data":{"text":"Tracking in Jira: {{jira.issueKey}}"}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
