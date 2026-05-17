/**
 * Recipe: Newsletter signup.
 *
 * Collects an email address via a public form, then adds the subscriber
 * to your mailing-list provider (Mailchimp/SendGrid/Resend — configurable
 * via the HTTP endpoint at the end).
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'newsletter-signup',
  name: 'Newsletter signup',
  category: 'marketing',
  description:
    'Collect a subscriber email via a form, validate it, and push the address to your mailing-list provider.',
  tags: ['newsletter', 'email', 'subscribe', 'marketing'],
  trigger: {
    id: 't_signup',
    type: 'start',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'flow_started',
  },
  variables: [
    { id: 'v_email', name: 'email', defaultValue: '' },
    { id: 'v_list_id', name: 'listId', defaultValue: '' },
    { id: 'v_provider_endpoint', name: 'providerEndpoint', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_intro',
      groupId: 'g_capture',
      type: 'text',
      options: {
        content:
          'Welcome! Want updates from us? Drop your email below and we\'ll send the best stuff.',
      },
    },
    {
      id: 'b_email_input',
      groupId: 'g_capture',
      type: 'email_input',
      options: {
        placeholder: 'you@example.com',
        buttonLabel: 'Subscribe',
        variableId: 'v_email',
        retryMessageContent: 'Please enter a valid email address.',
      },
    },
    {
      id: 'b_subscribe_request',
      groupId: 'g_persist',
      type: 'webhook',
      options: {
        url: '{{providerEndpoint}}',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content: '{"email":"{{email}}","listId":"{{listId}}"}',
        },
      },
    },
    {
      id: 'b_confirm',
      groupId: 'g_done',
      type: 'text',
      options: { content: "You're in — see you in your inbox 🎉" },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
