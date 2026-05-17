/**
 * Recipe: New hire → provision Google Workspace + Slack + Linear.
 *
 * Triggered by an HRIS `new_hire` webhook. Creates a Google Workspace
 * user via Admin SDK, invites them to the Slack workspace, and creates
 * a Linear member assignment under their team.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'hr-new-hire-provision',
  name: 'HR: New hire → provision GWS + Slack + Linear',
  category: 'onboarding',
  description:
    'When HR fires `new_hire`, create the Google Workspace user, send a Slack workspace invite, and add the hire to Linear under their team.',
  tags: ['hr', 'onboarding', 'provisioning', 'google-workspace', 'slack', 'linear'],
  trigger: {
    id: 't_new_hire_prov',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'hr_new_hire',
    options: {
      path: '/webhooks/hr/new-hire-provision',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-HRIS-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_first', name: 'employee.firstName', defaultValue: '' },
    { id: 'v_last', name: 'employee.lastName', defaultValue: '' },
    { id: 'v_personal_email', name: 'employee.personalEmail', defaultValue: '' },
    { id: 'v_work_email', name: 'employee.workEmail', defaultValue: '' },
    { id: 'v_team_id', name: 'linear.teamId', defaultValue: '' },
    { id: 'v_temp_password', name: 'employee.tempPassword', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_gws',
      groupId: 'g_gws',
      type: 'webhook',
      options: {
        url: 'https://admin.googleapis.com/admin/directory/v1/users',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GWS_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"primaryEmail":"{{employee.workEmail}}","name":{"givenName":"{{employee.firstName}}","familyName":"{{employee.lastName}}"},"password":"{{employee.tempPassword}}","changePasswordAtNextLogin":true}',
        },
      },
    },
    {
      id: 'b_slack_invite',
      groupId: 'g_slack',
      type: 'webhook',
      options: {
        url: 'https://slack.com/api/users.admin.invite',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SLACK_ADMIN_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
        ],
        body: {
          type: 'json',
          content:
            '{"email":"{{employee.workEmail}}","first_name":"{{employee.firstName}}","last_name":"{{employee.lastName}}"}',
        },
      },
    },
    {
      id: 'b_linear',
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
            '{"query":"mutation($input: TeamMembershipCreateInput!){ teamMembershipCreate(input:$input){ success } }","variables":{"input":{"teamId":"{{linear.teamId}}","userId":"{{employee.workEmail}}"}}}',
        },
      },
    },
    {
      id: 'b_welcome_email',
      groupId: 'g_welcome',
      type: 'send_email',
      options: {
        to: '{{employee.personalEmail}}',
        subject: 'Welcome — your accounts are ready',
        bodyType: 'html',
        body:
          '<p>Hi {{employee.firstName}},</p>' +
          '<p>Your work email is <strong>{{employee.workEmail}}</strong>. ' +
          'Temporary password: <code>{{employee.tempPassword}}</code> ' +
          '(you\'ll be asked to change it on first login).</p>' +
          '<p>You\'ll also receive a Slack invite shortly. See you Monday!</p>',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
