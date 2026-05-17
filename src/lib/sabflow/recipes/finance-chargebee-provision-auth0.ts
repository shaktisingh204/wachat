/**
 * Recipe: New ChargeBee subscription → provision Auth0 user + welcome email.
 *
 * On a `subscription_created` event from ChargeBee, we create the matching
 * Auth0 account (and assign the role for that plan), then email a welcome
 * message with a password-set link.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'finance-chargebee-provision-auth0',
  name: 'Finance: ChargeBee → Auth0 provisioning',
  category: 'finance',
  description:
    'When a ChargeBee subscription is created, provision the user in Auth0 with the right role and email them a password-set link.',
  tags: ['finance', 'chargebee', 'auth0', 'provisioning', 'subscription'],
  trigger: {
    id: 't_chargebee_created',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/chargebee/subscription-created',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'customer.email', defaultValue: '' },
    { id: 'v_first', name: 'customer.firstName', defaultValue: '' },
    { id: 'v_plan', name: 'subscription.plan', defaultValue: 'pro_monthly' },
    { id: 'v_auth0_domain', name: 'auth0.domain', defaultValue: 'sabnode.auth0.com' },
  ],
  blocks: [
    {
      id: 'b_extract_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'customer.email', value: '{{ $json.body.content.customer.email }}' },
    },
    {
      id: 'b_extract_plan',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'subscription.plan', value: '{{ $json.body.content.subscription.plan_id }}' },
    },
    {
      id: 'b_create_user',
      groupId: 'g_auth0',
      type: 'webhook',
      options: {
        url: 'https://{{auth0.domain}}/api/v2/users',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{AUTH0_MGMT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"email":"{{customer.email}}","email_verified":false,"connection":"Username-Password-Authentication","given_name":"{{customer.firstName}}","app_metadata":{"plan":"{{subscription.plan}}"}}',
        },
      },
    },
    {
      id: 'b_password_ticket',
      groupId: 'g_password',
      type: 'webhook',
      options: {
        url: 'https://{{auth0.domain}}/api/v2/tickets/password-change',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{AUTH0_MGMT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content: '{"email":"{{customer.email}}","mark_email_as_verified":true,"ttl_sec":259200}',
        },
      },
    },
    {
      id: 'b_welcome',
      groupId: 'g_welcome',
      type: 'send_email',
      options: {
        to: '{{customer.email}}',
        subject: 'Welcome to SabNode {{subscription.plan}} — set your password',
        body:
          'Hi {{customer.firstName}}, your subscription is live. Set your password ' +
          'with this one-time link (expires in 72 hours): {{ $json.ticket }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
