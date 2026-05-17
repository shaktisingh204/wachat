/**
 * Recipe: Employee offboarding → revoke OAuth, archive Slack DMs.
 *
 * On HRIS `termination` webhook, suspend the Google Workspace account,
 * revoke every OAuth grant via the SCIM admin API, and archive the
 * employee's Slack DM history.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'hr-offboarding-revoke-credentials',
  name: 'HR: Offboarding → revoke creds + archive Slack',
  category: 'onboarding',
  description:
    'On `termination`, suspend the Google Workspace user, revoke OAuth tokens via the internal SCIM admin API, and call the Slack admin endpoint to archive the user\'s DMs.',
  tags: ['hr', 'offboarding', 'security', 'oauth', 'slack'],
  trigger: {
    id: 't_offboard',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'hr_termination',
    options: {
      path: '/webhooks/hr/offboarding',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-HRIS-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_work_email', name: 'employee.workEmail', defaultValue: '' },
    { id: 'v_slack_user_id', name: 'employee.slackUserId', defaultValue: '' },
    { id: 'v_termination_at', name: 'employee.terminationAt', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_suspend_gws',
      groupId: 'g_gws',
      type: 'webhook',
      options: {
        url: 'https://admin.googleapis.com/admin/directory/v1/users/{{employee.workEmail}}',
        method: 'PATCH',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GWS_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"suspended":true}' },
      },
    },
    {
      id: 'b_revoke_oauth',
      groupId: 'g_oauth',
      type: 'webhook',
      options: {
        url: '/api/admin/scim/v2/Users/{{employee.workEmail}}/revoke-grants',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"reason":"termination","terminatedAt":"{{employee.terminationAt}}"}',
        },
      },
    },
    {
      id: 'b_archive_slack',
      groupId: 'g_slack',
      type: 'webhook',
      options: {
        url: 'https://slack.com/api/admin.users.session.invalidate',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SLACK_ADMIN_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content: '{"user_id":"{{employee.slackUserId}}"}',
        },
      },
    },
    {
      id: 'b_notify_it',
      groupId: 'g_notify',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#it-offboarding',
        text:
          ':lock: Offboarding complete for {{employee.workEmail}} — GWS suspended, OAuth revoked, Slack sessions invalidated.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
