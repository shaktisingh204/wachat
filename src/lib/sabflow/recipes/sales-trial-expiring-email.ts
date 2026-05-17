/**
 * Recipe: Trial expiring in 3 days → personalised upgrade email.
 *
 * Daily cron pulls accounts whose trial ends in three days, asks
 * OpenAI to draft a one-sentence personalised opener using usage
 * stats, and emails the primary contact with a checkout link.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'sales-trial-expiring-email',
  name: 'Sales: Trial expiring in 3 days → personalised email',
  category: 'sales',
  description:
    'Each morning, find trials ending in 3 days, generate a personalised opener with OpenAI using the account\'s usage stats, and email the primary contact with the checkout link.',
  tags: ['sales', 'trial', 'email', 'openai', 'expiring'],
  trigger: {
    id: 't_trial_3day',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_daily',
    options: {
      cronExpression: '0 14 * * *',
      timezone: 'UTC',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_accounts', name: 'accounts', defaultValue: '[]' },
    { id: 'v_account_id', name: 'account.id', defaultValue: '' },
    { id: 'v_email', name: 'account.email', defaultValue: '' },
    { id: 'v_first_name', name: 'account.firstName', defaultValue: '' },
    { id: 'v_usage_stats', name: 'account.usageStats', defaultValue: '' },
    { id: 'v_opener', name: 'email.opener', defaultValue: '' },
    {
      id: 'v_checkout_url',
      name: 'checkoutUrl',
      defaultValue: 'https://example.com/billing/checkout',
    },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '/api/billing/trials/expiring?inDays=3',
        method: 'GET',
        responseMappings: [
          { id: 'rm1', jsonPath: 'accounts', variableId: 'v_accounts' },
        ],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: {
        sourceVariable: 'accounts',
        iteratorVariable: 'account',
      },
    },
    {
      id: 'b_personalise',
      groupId: 'g_personalise',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'Write a single warm sentence (max 25 words) referencing the user\'s usage stats to open an upgrade email. No greeting, no signature.',
        userMessage: 'First name: {{account.firstName}}\nUsage: {{account.usageStats}}',
        temperature: 0.6,
        maxTokens: 80,
        responseVariable: 'email.opener',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_send',
      groupId: 'g_send',
      type: 'send_email',
      options: {
        to: '{{account.email}}',
        subject: 'Your trial wraps in 3 days, {{account.firstName}}',
        bodyType: 'html',
        body:
          '<p>Hi {{account.firstName}},</p>' +
          '<p>{{email.opener}}</p>' +
          '<p>Lock in your plan before the trial ends — <a href="{{checkoutUrl}}?account={{account.id}}">Upgrade now</a>.</p>',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
